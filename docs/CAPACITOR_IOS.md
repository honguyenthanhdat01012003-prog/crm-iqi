# Capacitor iOS — LUX IQI CRM

## Yêu cầu phiên bản (test trên Mac cũ)
- **Capacitor 5.7.x** — mở được với **Xcode 14** (macOS 13)
- API: `https://crm-iqi.id.vn/api`
- Auth Bearer JWT

> Capacitor 8 cần Xcode 16 — đã hạ xuống Cap 5 để test trên VM/Mac cũ.

## Build & sync
```bash
git pull
npm install
npm run build:capacitor
npx cap sync ios
npx cap open ios
```

Mở **`ios/App/App.xcworkspace`** (không mở `.xcodeproj` nếu có CocoaPods).

## Xcode 14
1. Signing → Team
2. Bundle ID: `vn.id.crmiqi.app`
3. Product → Clean Build Folder
4. Xóa app trên simulator/máy → Run

## Checklist đã gắn
- `base: './'` khi mode capacitor
- `VITE_API_BASE_URL` tuyệt đối + CapacitorHttp
- Bearer; login xóa token cũ; không `Content-Type` trên GET
- SW tắt trên native
