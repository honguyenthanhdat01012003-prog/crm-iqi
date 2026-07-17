# Capacitor iOS — LUX IQI CRM

## Yêu cầu phiên bản
- **Capacitor 5.7.x**
- API: `https://crm-iqi.id.vn/api`
- Bundle ID: `vn.id.crmiqi.app`

## Push khi tắt app (iPhone)

Quyền thông báo **không đủ**. Khi app tắt cần **FCM + APNs**.

### Checklist bắt buộc
1. Firebase: app iOS + `GoogleService-Info.plist`
2. Firebase Cloud Messaging: upload APNs `.p8` vào **Development + Production**
3. File plist trong `ios/App/App/` + Target Membership **App**
4. **Firebase SDK trên iOS** (quan trọng):
   ```bash
   # Mac, trong thư mục project
   bash scripts/patch-ios-firebase-push.sh
   ```
   Script thêm `Firebase/Messaging` + `FirebaseApp.configure()` vào AppDelegate.
   **Thiếu bước này** → app lấy token APNs thô → server FCM gửi fail → tắt app im.
5. Xcode Capabilities:
   - Push Notifications
   - Background Modes → Remote notifications
6. Build **TestFlight mới** → gắn vào Internal → Update trên iPhone
7. VPS đã có `FIREBASE_*` / `secrets/firebase-service-account.json` (cùng project Android)

### Kiểm tra trên iPhone
1. Mở app → login
2. Menu **chuông** phải hiện: **Đã đăng ký FCM**
3. Nếu hiện "Chưa đăng ký FCM" / lỗi token → chưa patch Firebase / chưa rebuild

### Test push từ server
Lấy Bearer token CRM (login web), rồi:
```bash
curl -s -H "Authorization: Bearer TOKEN" https://crm-iqi.id.vn/api/native-push/status
# Cần: tokenCount >= 1, platform = ios, last_error rỗng

curl -s -X POST -H "Authorization: Bearer TOKEN" https://crm-iqi.id.vn/api/native-push/test
```
**Tắt hẳn app** rồi mới gọi test. App đang mở có thể dùng socket, không chứng minh push nền.

### Lưu ý
- **Simulator** không nhận remote push khi kill app
- Mỗi build TestFlight mới phải **Add vào group** rồi bấm **Update** trong app TestFlight
- Internal: không chờ Apple duyệt; External: cần review

## Build & sync
```bash
git pull
npm install
npm run build:capacitor
npx cap sync ios
bash scripts/patch-ios-firebase-push.sh
npx cap open ios
```

Mở **`ios/App/App.xcworkspace`**.

## Xcode
1. Signing → Team, Bundle ID `vn.id.crmiqi.app`
2. Capabilities: Push + Remote notifications
3. Clean → Archive → Upload
