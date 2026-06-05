# Huong Dan Capacitor Phase 1

Phase 1 chi boc CRM thanh app native shell. Chua them native push, chua doi logic lead, chua doi database.

## Muc tieu

- Web hien tai van chay nhu cu.
- App Android/iOS dung chung frontend React trong `dist`.
- App native goi API ve `https://crm-iqi.id.vn/api`.
- Socket.IO native goi ve `https://crm-iqi.id.vn`.
- PWA service worker/web push khong dang ky khi chay trong Capacitor.

## Lenh chinh

Build web cho native:

```bash
npm run build:mobile
```

Dong bo file build vao native project:

```bash
npm run cap:sync
```

Mo Android Studio:

```bash
npm run cap:open:android
```

Mo Xcode tren may Mac:

```bash
npm run cap:open:ios
```

## Cau hinh API

File `.env.capacitor` dang dat:

```bash
VITE_API_BASE_URL=https://crm-iqi.id.vn/api
VITE_SOCKET_URL=https://crm-iqi.id.vn
```

Neu test bang domain khac, sua 2 gia tri nay roi chay lai `npm run cap:sync`.

## CORS tren VPS

Neu VPS co khoa CORS bang `ALLOWED_ORIGINS`, them cac origin sau:

```bash
ALLOWED_ORIGINS=https://crm-iqi.id.vn,https://localhost,capacitor://localhost
```

Neu bien nay de trong thi server hien tai cho phep moi origin.

## Gioi han phase 1

- Chua co native push notification.
- Chua co am thanh rieng khi app dong nen.
- Chua tao Firebase/APNs.
- iOS can may Mac/Xcode de build va test.

Sau khi phase 1 test on dinh, phase 2 moi them native push token va FCM/APNs.
