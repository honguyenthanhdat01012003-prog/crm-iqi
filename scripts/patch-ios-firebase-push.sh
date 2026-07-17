#!/usr/bin/env bash
# Chạy trên Mac sau khi đã có GoogleService-Info.plist trong ios/App/App/
# Bật Firebase Messaging để Capacitor nhận FCM token (không phải raw APNs).
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
    # Chèn vào trong target 'App' do
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

# --- AppDelegate: Firebase + forward APNs token ---
if ! grep -q "Messaging.messaging().apnsToken" "$DELEGATE" 2>/dev/null; then
  echo "==> Ghi AppDelegate.swift (Firebase + APNs→FCM)"
  cat > "$DELEGATE" <<'SWIFT'
import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
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
else
  echo "==> AppDelegate đã forward APNs token"
fi

echo "==> pod install"
cd "$ROOT/ios/App"
pod install

echo ""
echo "Done. Tiếp theo trong Xcode:"
echo "  1) Signing & Capabilities → Push Notifications + Background Modes (Remote notifications)"
echo "  2) Clean → Archive → Upload TestFlight (build mới)"
echo "  3) Gắn build vào Internal → Update trên iPhone"
echo "  4) Mở app → login → menu chuông phải thấy 'Đã đăng ký FCM'"
echo "  5) Tắt app → web gửi test / chia lead"
