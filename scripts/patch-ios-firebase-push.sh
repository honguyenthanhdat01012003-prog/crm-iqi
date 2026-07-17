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

echo "==> pod install"
cd "$ROOT/ios/App"
pod install

echo ""
echo "Done. Kiểm tra AppDelegate có dòng: Messaging.messaging().token"
echo "Rồi: Clean → Archive → Upload TestFlight → Update trên iPhone"
echo "Sau Update: mở app → Đăng ký lại FCM → VUỐT TẮT app → web chia lead"
