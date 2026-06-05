# Huong Dan Capacitor Phase 1

Phase 1 boc CRM thanh app native shell. Phase 2 da them khung native push token va server ban song song web push/native push khi co cau hinh FCM. Khong doi logic lead.

## Muc tieu

- Web hien tai van chay nhu cu.
- App Android/iOS dung chung frontend React trong `dist`.
- App native goi API ve `https://crm-iqi.id.vn/api`.
- Socket.IO native goi ve `https://crm-iqi.id.vn`.
- PWA service worker/web push khong dang ky khi chay trong Capacitor.
- App native dang ky token bang `@capacitor/push-notifications`.
- Server luu token native vao bang `native_push_tokens`.

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
VITE_NATIVE_PUSH_ENABLED=false
```

Neu test bang domain khac, sua 2 gia tri nay roi chay lai `npm run cap:sync`.

## CORS tren VPS

Neu VPS co khoa CORS bang `ALLOWED_ORIGINS`, them cac origin sau:

```bash
ALLOWED_ORIGINS=https://crm-iqi.id.vn,https://localhost,capacitor://localhost
```

Neu bien nay de trong thi server hien tai cho phep moi origin.

## Phase 2 native push

Code da co:

- API `POST /api/native-push/register` de luu token app.
- Server goi FCM HTTP v1 song song voi web push trong cac luong lead moi/chia lead.
- App xin quyen thong bao va dang ky token khi chay trong Capacitor.

Can cau hinh them tren VPS de native push that su ban khi app dong/nen:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Android can them file Firebase:

```text
android/app/google-services.json
```

Sau khi Firebase da cau hinh day du moi doi:

```bash
VITE_NATIVE_PUSH_ENABLED=true
```

Neu bat bien nay khi Android chua co `google-services.json`, app co the vang/crash luc dang ky push native.

Sau khi them/sua Firebase config, chay lai:

```bash
npm run cap:sync
```

Luu y: am thanh rieng khi app dang dong/nen phu thuoc notification channel cua Android va APNs cua iOS. Hien tai native push dung am thanh he thong; am MP3 rieng van phat khi app dang mo.

iOS can may Mac/Xcode, Apple Developer account va cau hinh APNs trong Firebase de test tren thiet bi that.

Xem chi tiet cac buoc Firebase/FCM tai:

```text
HUONG_DAN_FIREBASE_NATIVE_PUSH.md
```
