# HƯỚNG DẪN TRIỂN KHAI CRM TỪ VERCEL SANG VPS (TURSO DB) BẰNG aaPanel

> Dành cho người mới, từng bước một, không cần biết code!

---

## 1. Đăng nhập aaPanel

- Mở trình duyệt, nhập IP VPS (VD: http://103.200.20.113:8081)
- Đăng nhập bằng tài khoản aaPanel

## 2. Cài mã nguồn CRM qua git clone (Cực chi tiết)

### 2.1. Mở aaPanel
- Mở trình duyệt, nhập IP VPS (VD: http://103.200.20.113:8081)
- Đăng nhập bằng tài khoản aaPanel (username/password do nhà cung cấp gửi)

### 2.2. Mở Terminal
- Nhìn menu bên trái, kéo xuống tìm mục **Terminal** (icon hình màn hình)
- Bấm vào **Terminal**
- Chờ hiện cửa sổ dòng lệnh (có thể mất vài giây)

### 2.3. Di chuyển đến thư mục web
- Gõ lệnh:
  ```
  cd /www/wwwroot/
  ```
- Bấm **Enter** trên bàn phím

### 2.4. Clone mã nguồn từ Github
- Gõ lệnh:
  ```
  git clone <link-repo-github>
  ```
  (VD: git clone https://github.com/tenuser/my-react-app.git)
- Bấm **Enter**
- Chờ tải xong (có thể mất 10-60 giây tùy mạng)
- Sau khi xong sẽ có thư mục mới (VD: my-react-app)

### 2.5. Đổi tên thư mục (nếu muốn)
- Gõ lệnh:
  ```
  mv my-react-app crm-iqi
  ```
- Bấm **Enter**
- Thư mục sẽ đổi tên thành crm-iqi

### 2.6. Kiểm tra thư mục
- Gõ lệnh:
  ```
  ls
  ```
- Bấm **Enter**
- Xem danh sách thư mục, đảm bảo có crm-iqi hoặc tên bạn vừa đặt

### 2.7. Di chuyển vào thư mục mã nguồn
- Gõ lệnh:
  ```
  cd crm-iqi
  ```
- Bấm **Enter**
- Đã vào đúng thư mục mã nguồn

### 2.8. Tiếp tục các bước bên dưới
- Đã xong phần clone, chuyển sang bước cấu hình Node Project

## 3. Cấu hình Node Project

- Vào menu **Node** > **Node Project**
- Bấm **Add Node project**
- Chọn thư mục mã nguồn vừa upload (VD: /www/wwwroot/crm-<tên>)
- Chọn file khởi động: `server/index.js`
- Chọn Node version: v22.x (hoặc bản phù hợp)
- Bấm **Submit** để tạo project

## 4. Cấu hình biến môi trường Turso (Cực chi tiết)

### 4.1. Mở menu Files
- Nhìn menu bên trái, bấm vào **Files** (icon hình thư mục)
- Chờ hiện danh sách thư mục

### 4.2. Mở thư mục mã nguồn
- Bấm vào thư mục **wwwroot**
- Bấm vào thư mục dự án (VD: crm-iqi)

### 4.3. Tạo file .env
- Bấm nút **New File** (góc trên bên phải)
- Nhập tên: `.env` rồi bấm **OK**

### 4.4. Sửa file .env
- Bấm vào file `.env` vừa tạo
- Dán vào nội dung:
  ```
  TURSO_URL=libsql://db-xxxx.turso.io
  TURSO_AUTH_TOKEN=eyJhbGciOi...
  ```
- Bấm **Save** (góc trên bên phải)

### 4.5. Kiểm tra lại file .env
- Đảm bảo file .env nằm đúng thư mục dự án (VD: /www/wwwroot/crm-iqi/.env)

---

## 5. Cài đặt package (Cực chi tiết)

### 5.1. Mở menu Node
- Nhìn menu bên trái, bấm vào **Node** (icon hình chữ N)
- Bấm vào **Node Project**

### 5.2. Chọn project
- Tìm project vừa tạo (VD: crm-iqi)
- Bấm vào hàng project để hiện chi tiết

### 5.3. Cài package
- Bấm nút **Modify** (cột bên phải)
- Trong popup, bấm nút **Install dependencies** (màu xanh)
- Chờ chạy xong (có thể mất 10-60 giây)
- Nếu báo lỗi, kiểm tra log hoặc dùng Terminal chạy:
  ```
  cd /www/wwwroot/crm-iqi
  npm install
  ```

---

## 6. Khởi động và restart project (Cực chi tiết)

### 6.1. Khởi động lần đầu
- Vào menu **Node** > **Node Project**
- Tìm project (VD: crm-iqi)
- Bấm nút **Start** (cột bên phải, màu xanh)
- Chờ trạng thái chuyển thành **Running** (màu xanh)

### 6.2. Restart khi cập nhật code
- Mỗi lần cập nhật code (git pull, upload file mới):
  - Vào menu **Node** > **Node Project**
  - Tìm project
  - Bấm nút **Restart** (cột bên phải, màu vàng)
- Chờ trạng thái chuyển lại **Running**

### 6.3. Kiểm tra log khi lỗi
- Bấm nút **Logs** (cột bên phải, màu xám)
- Xem thông báo lỗi, gửi cho quản trị viên nếu cần

---

## 7. Cập nhật code tự động

- Nếu dùng git:
  - Vào menu **Terminal**
  - Chạy:
    ```
    cd /www/wwwroot/crm-<tên>
    git pull
    npm install
    ```
  - Vào Node Project > bấm **Restart**

## 8. Kiểm tra hoạt động

- Vào menu **Node** > **Node Project**
- Xem trạng thái: Running (màu xanh)
- Xem log: bấm **Logs** để kiểm tra lỗi
- Truy cập web: http://<IP-VPS>:<port> (port do aaPanel cấp)
- Kiểm tra endpoint: http://<IP-VPS>:<port>/api/health

## 9. Cấu hình domain (nếu cần)

- Vào menu **Domains** > Add domain
- Trỏ domain về IP VPS
- Cấu hình proxy/nginx nếu muốn chạy port 80/443

## 10. Hoàn tất!

- Mỗi lần muốn cập nhật code, chỉ cần upload file mới hoặc git pull, rồi bấm **Restart** trên Node Project là web tự động cập nhật.

---

### Lưu ý:
- Luôn dùng TURSO_URL và TURSO_AUTH_TOKEN mới nhất.
- Nếu lỗi, kiểm tra log Node Project, file `.env`, và quyền truy cập DB.
- Nếu cần hỗ trợ, liên hệ quản trị viên hoặc gửi ảnh lỗi.

> Tài liệu này dành cho người mới, làm từng bước sẽ thành công!

# HƯỚNG DẪN TRIỂN KHAI CRM TỪ VERCEL SANG VPS (TURSO DB)

> Dành cho người mới, từng bước một, không cần biết code!

---

## 1. Chuẩn bị VPS

- Đăng ký VPS (VD: Vultr, DigitalOcean, AZDIGI...)
- Lấy thông tin IP, user, password để đăng nhập
- Đăng nhập VPS bằng SSH (VD: dùng PuTTY, Terminal)

## 2. Cài đặt Node.js

- Trên VPS, chạy lệnh:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  ```
- Kiểm tra:
  ```bash
  node -v
  npm -v
  ```

## 3. Tải mã nguồn CRM lên VPS

- Dùng lệnh git clone:
  ```bash
  git clone <link-repo-github>
  cd my-react-app
  ```
- Hoặc upload file zip, giải nén:
  ```bash
  unzip my-react-app.zip
  cd my-react-app
  ```

## 4. Cài đặt Turso DB

- Đăng nhập https://dashboard.turso.tech/
- Tạo database mới (nếu chưa có)
- Lấy 2 thông tin:
  - TURSO_URL (libsql://db-xxxx.turso.io)
  - TURSO_AUTH_TOKEN (token dài)

## 5. Cấu hình biến môi trường

- Tạo file `.env` trong thư mục gốc dự án (my-react-app):
  ```env
  TURSO_URL=libsql://db-xxxx.turso.io
  TURSO_AUTH_TOKEN=eyJhbGciOi...
  ```
- Lưu file `.env`

## 6. Cài đặt các package cần thiết

- Chạy lệnh:
  ```bash
  npm install
  ```

## 7. Chạy backend

- Chạy lệnh:
  ```bash
  node server/index.js
  ```
- Nếu có lỗi, kiểm tra log và đảm bảo đã cấu hình đúng `.env`

## 8. Chạy frontend (React)

- Chạy lệnh:
  ```bash
  npm run dev
  ```
- Truy cập: `http://<IP-VPS>:5173` (hoặc port khác nếu cấu hình)

## 9. Kiểm tra kết nối Turso DB

- Truy cập: `http://<IP-VPS>:4000/api/health`
- Nếu hiện `tursoConfigured:true` và số lượng bản ghi đúng, đã kết nối thành công.

---

## 10. Cập nhật code và deploy tự động (giống Vercel)

### A. Cấu hình Git để cập nhật code

- Đảm bảo đã clone repo từ Github:
  ```bash
  git clone <link-repo-github>
  cd my-react-app
  ```
- Khi muốn cập nhật code mới:
  ```bash
  git pull
  npm install
  ```

### B. Tự động restart server khi code thay đổi

- Cài package pm2 để quản lý process:
  ```bash
  npm install -g pm2
  ```
- Khởi động backend bằng pm2:
  ```bash
  pm2 start server/index.js --name crm-backend
  ```
- Khởi động frontend bằng pm2:
  ```bash
  pm2 start "npm run dev" --name crm-frontend
  ```
- Khi cập nhật code:
  ```bash
  git pull
  npm install
  pm2 restart crm-backend
  pm2 restart crm-frontend
  ```

### C. Tự động hóa (nâng cao)

- Có thể dùng Github Actions, webhook, hoặc script để tự động pull code và restart server mỗi khi push lên Github.
- Hoặc dùng script đơn giản:
  ```bash
  # update.sh
  cd /path/to/my-react-app
  git pull
  npm install
  pm2 restart crm-backend
  pm2 restart crm-frontend
  ```
- Chạy script này mỗi khi muốn cập nhật code.

---

## 11. Cấu hình domain (nếu cần)

- Trỏ domain về IP VPS
- Cài nginx hoặc apache để proxy port 4000/5173 ra domain
- Ví dụ cấu hình nginx:
  ```nginx
  server {
    listen 80;
    server_name yourdomain.com;
    location / {
      proxy_pass http://localhost:5173;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  ```

---

## 12. Hoàn tất!

- Đăng nhập CRM, kiểm tra dữ liệu, sử dụng bình thường.
- Mỗi lần muốn cập nhật code, chỉ cần pull code và restart pm2 là web tự động cập nhật giống Vercel.

---

### Lưu ý:
- Luôn dùng TURSO_URL và TURSO_AUTH_TOKEN mới nhất.
- Nếu lỗi, kiểm tra log backend, file `.env`, và quyền truy cập DB.
- Nếu cần hỗ trợ, liên hệ quản trị viên hoặc gửi ảnh lỗi.

> Tài liệu này dành cho người mới, làm từng bước sẽ thành công!
