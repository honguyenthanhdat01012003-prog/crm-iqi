# Huong Dan Firebase Native Push

Muc tieu: app Android/iOS van nhan thong bao khi app dang dong hoac chay nen.

Native push khong the hoat dong neu thieu Firebase. Local notification chi hien khi app dang mo/chay, khong thay the duoc FCM khi app da dong.

## 1. Tao Firebase Android app

Vao Firebase Console, tao project hoac dung project co san.

Them Android app voi package name:

```text
vn.id.crmiqi.app
```

Tai file:

```text
google-services.json
```

Dat vao:

```text
android/app/google-services.json
```

Khong commit file nay len git neu project Firebase la private/san pham that.

## 2. Tao Service Account cho VPS

Trong Firebase Console:

```text
Project settings > Service accounts > Generate new private key
```

Tu file JSON tai ve, lay 3 gia tri:

```bash
FIREBASE_PROJECT_ID=project_id
FIREBASE_CLIENT_EMAIL=client_email
FIREBASE_PRIVATE_KEY=private_key
```

Tren VPS/aapanel them bien moi truong:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Luu y `FIREBASE_PRIVATE_KEY` phai giu ky tu `\n` hoac xuong dong dung nhu private key.

**Cach on dinh nhat (khuyen dung tren VPS):** upload file JSON tu Firebase:

```text
/www/wwwroot/crm-iqi/secrets/firebase-service-account.json
```

(Tai tu Firebase Console → Project settings → Service accounts → Generate new private key)

Server tu doc file nay, khong can dan private key vao `.env`.

Kiem tra key tren VPS:

```bash
cd /www/wwwroot/crm-iqi
node server/check-firebase-key.js
```

Neu aaPanel Node co muc Environment Variables rieng, **xoa** `FIREBASE_PRIVATE_KEY` o do (neu co) — no ghi de `.env` va hay bi loi format.

## 3. Bat native push trong app build

Sau khi da co `android/app/google-services.json`, sua file:

```text
.env.capacitor
```

Doi:

```bash
VITE_NATIVE_PUSH_ENABLED=false
```

Thanh:

```bash
VITE_NATIVE_PUSH_ENABLED=true
```

Sau do chay:

```bash
npm.cmd install
npm.cmd run cap:sync
```

Build APK moi trong Android Studio va cai lai app.

## 4. Restart server VPS

Sau khi them bien `FIREBASE_*`, restart Node app tren aapanel.

Khi server len lai, DB se co bang:

```text
native_push_tokens
```

## 5. Test

Dang nhap app tren dien thoai that (uu tien hon BlueStacks). Khi mo app lan dau:

1. Man hinh giai thich "Nhan thong bao lead" se hien truoc
2. Bam **Cho phep thong bao** → hop thoai he thong Android (POST_NOTIFICATIONS) → chon **Cho phep**
3. Dang nhap → app tu dang ky FCM token len server

Tren Android 13+, thong bao mac dinh **tat** cho den khi nguoi dung cap quyen. Neu da tu choi, vao menu chuong → **Mo cai dat** de bat lai.

Kiem tra token:

```bash
curl -H "Authorization: Bearer TOKEN_CRM" https://crm-iqi.id.vn/api/native-push/status
```

Test native push:

```bash
curl -X POST -H "Authorization: Bearer TOKEN_CRM" https://crm-iqi.id.vn/api/native-push/test
```

Neu thanh cong, man hinh thong bao Android se co thong bao test.

## 6. Luu y thiet bi dang nhap

Code hien tai chi giu native push token cho thiet bi dang ky moi nhat cua cung tai khoan CRM. Neu cung mot tai khoan login tren thiet bi khac, token thiet bi cu se bi xoa de tranh nhan nham thong bao.

## 7. Neu app bi crash khi login

Kiem tra lai:

- `android/app/google-services.json` co dung package `vn.id.crmiqi.app` khong.
- `.env.capacitor` chi bat `VITE_NATIVE_PUSH_ENABLED=true` sau khi co Firebase file.
- Da chay lai `npm.cmd run cap:sync` sau khi sua env/file.
- Da build va cai lai APK moi.
