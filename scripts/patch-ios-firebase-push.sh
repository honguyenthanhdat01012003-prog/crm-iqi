#!/usr/bin/env bash
# Chạy trên Mac sau khi đã có GoogleService-Info.plist trong ios/App/App/
# Bắt buộc: đẩy FCM token (String) cho Capacitor — KHÔNG đẩy raw APNs Data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/ios/App/App"
PODFILE="$ROOT/ios/App/Podfile"
DELEGATE="$APP_DIR/AppDelegate.swift"
PLIST="$APP_DIR/GoogleService-Info.plist"

if [ ! -f "$PLIST" ]; then
  echo "ERROR: thiếu $PLIST"
  echo "Tải từ Firebase → kéo vào ios/App/App/ (target App)."
  exit 1
fi

if [ ! -f "$DELEGATE" ]; then
  echo "ERROR: thiếu AppDelegate.swift — chạy: npx cap sync ios"
  exit 1
fi

# --- Podfile: thêm Firebase/Messaging ---
if [ -f "$PODFILE" ]; then
  if ! grep -q "Firebase/Messaging" "$PODFILE"; then
    echo "==> Thêm pod Firebase/Messaging vào Podfile"
    if grep -q "target 'App'" "$PODFILE"; then
      perl -i -0pe "s/(target 'App' do\\n)/\$1  pod 'Firebase\/Messaging'\\n/" "$PODFILE" || true
    fi
    if ! grep -q "Firebase/Messaging" "$PODFILE"; then
      echo "  pod 'Firebase/Messaging'" >> "$PODFILE"
    fi
  else
    echo "==> Podfile đã có Firebase/Messaging"
  fi
else
  echo "WARN: không thấy Podfile"
fi

echo "==> Ghi AppDelegate.swift (FCM token String + banner foreground)"
cat > "$DELEGATE" <<'SWIFT'
import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // Banner + tiếng khi app đang mở (iOS 13 dùng .alert)
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .sound, .badge])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
    }

    // QUAN TRỌNG: phải đẩy FCM token (String), không đẩy APNs Data
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
                return
            }
            guard let token = token, !token.isEmpty else {
                NotificationCenter.default.post(
                    name: .capacitorDidFailToRegisterForRemoteNotifications,
                    object: NSError(domain: "FCM", code: -1, userInfo: [NSLocalizedDescriptionKey: "Empty FCM token"])
                )
                return
            }
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
SWIFT

# --- Âm thanh riêng cho thông báo iOS: convert mp3 → caf ---
echo "==> Tạo file âm thanh .caf cho iOS (afconvert)"
SOUND_OK=0
if command -v afconvert >/dev/null 2>&1; then
  convert_sound() {
    local src="$ROOT/public/sounds/$1"
    local dst="$APP_DIR/$2"
    if [ -f "$src" ]; then
      afconvert -f caff -d ima4 "$src" "$dst" && echo "  + $2"
    else
      echo "  WARN: thiếu $src"
    fi
  }
  convert_sound "lead-sale.mp3" "lead_sale.caf"
  convert_sound "lead-manager.mp3" "lead_manager.caf"
  convert_sound "lead-recall.mp3" "lead_recall.caf"
  convert_sound "lead-update.mp3" "lead_update.caf"
  SOUND_OK=1
else
  echo "  WARN: không có afconvert — bỏ qua âm thanh riêng (iOS sẽ dùng tiếng mặc định)"
fi

echo "==> pod install"
cd "$ROOT/ios/App"
pod install

echo ""
echo "Done. Kiểm tra AppDelegate có dòng: Messaging.messaging().token"
if [ "$SOUND_OK" = "1" ]; then
  echo ""
  echo "QUAN TRỌNG — thêm âm thanh vào Xcode (1 lần duy nhất):"
  echo "  1. Mở Xcode → kéo 4 file lead_sale.caf, lead_manager.caf, lead_recall.caf, lead_update.caf"
  echo "     (nằm trong ios/App/App/) vào folder App (bên dưới App màu xanh)"
  echo "  2. Tick 'Copy items if needed' + tick target 'App' → Finish"
fi
echo ""
echo "Rồi: Clean → Archive → Upload TestFlight → Update trên iPhone"
echo "Sau Update: mở app → VUỐT TẮT app → web chia lead → phải có banner + tiếng riêng"
