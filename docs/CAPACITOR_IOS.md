# Capacitor iOS — LUX IQI CRM

## Yêu cầu
- Mac + Xcode (Archive / Simulator)
- API production HTTPS: `https://crm-iqi.id.vn/api`
- Auth Bearer JWT (đã có sẵn trên server)

## Build & sync (Windows hoặc Mac)
```bash
cd /www/wwwroot/crm-iqi   # hoặc clone local
npm install
npm run build:capacitor
npx cap sync ios
```

Chỉ mở file workspace:
```text
ios/App/App.xcworkspace
```
(Không mở `.xcodeproj` khi dùng CocoaPods.)

## Xcode
1. Signing → Team (Personal Team = chỉ máy mình; Apple Developer $99 = TestFlight)
2. Bundle ID: `vn.id.crmiqi.app`
3. Clean Build Folder → xóa app trên simulator/máy → Run
4. Archive: chọn **Any iOS Device**, không chọn Simulator

## Checklist lỗi đã tránh
- `base: './'` khi mode capacitor (không màn đen)
- `VITE_API_BASE_URL` tuyệt đối — không `/api` trên native
- `CapacitorHttp` bật + mọi `apiFetch` đi native HTTP
- Không gắn `Content-Type` trên GET
- Login xóa token cũ trước khi gọi `/login`
- Service worker không chạy trên Capacitor

## Debug dashboard/list = 0 nhưng web OK
1. `.env.capacitor` đúng domain?
2. Sau login có `crm_token`?
3. Request có header `Authorization: Bearer`?
4. `/api/version` trả JSON (không HTML)?
