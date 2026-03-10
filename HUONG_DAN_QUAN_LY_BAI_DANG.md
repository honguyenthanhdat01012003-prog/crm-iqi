# 📝 HƯỚNG DẪN SỬ DỤNG - QUẢN LÝ BÀI ĐĂNG FACEBOOK

> **Dành cho người mới bắt đầu** - Hướng dẫn từng bước một, ai đọc cũng hiểu!

---

## 📑 MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Cách truy cập](#2-cách-truy-cập-chức-năng)
3. [Quản lý Page Facebook](#3-quản-lý-page-facebook)
4. [Quản lý bài đăng](#4-quản-lý-bài-đăng)
5. [Lịch đăng bài](#5-lịch-đăng-bài)
6. [Quy trình đăng bài hoàn chỉnh](#6-quy-trình-đăng-bài-hoàn-chỉnh-từ-a-đến-z)
7. [Giải thích trạng thái bài đăng](#7-giải-thích-trạng-thái-bài-đăng)
8. [Câu hỏi thường gặp (FAQ)](#8-câu-hỏi-thường-gặp)

---

## 1. TỔNG QUAN HỆ THỐNG

### Hệ thống này làm gì?

Hệ thống giúp bạn **đăng bài lên nhiều Fanpage Facebook cùng lúc** mà không cần mở từng Fanpage để đăng thủ công.

### Ví dụ thực tế:
> Bạn có 5 Fanpage bất động sản (Vinhomes Grand Park, The Global City, Masteri...). Thay vì phải mở từng Fanpage → viết bài → đăng x5 lần, bạn chỉ cần:
> 1. Viết bài 1 lần
> 2. Chọn tick vào 5 Fanpage
> 3. Bấm "Đăng ngay" → Bài tự động lên cả 5 Fanpage!

### Có 3 trang chức năng chính:

| Trang | Chức năng | Ví dụ |
|-------|-----------|-------|
| 📄 **Quản lý Page** | Thêm/xóa các Fanpage Facebook | Thêm Fanpage "Vinhomes Grand Park Official" |
| 📋 **Tất cả bài** | Tạo, sửa, xóa, đăng bài | Viết bài "Căn hộ Vinhomes giá tốt" rồi đăng |
| 📅 **Lịch đăng bài** | Xem lịch các bài theo ngày | Xem ngày 12/03 có mấy bài cần đăng |

---

## 2. CÁCH TRUY CẬP CHỨC NĂNG

### Bước 1: Đăng nhập

1. Mở trình duyệt, vào địa chỉ web (VD: `http://localhost:4000`)
2. Nhập **Tên đăng nhập**: `admin`
3. Nhập **Mật khẩu**: `admin123`
4. Bấm nút **"Đăng nhập"**

> ⚠️ **Lưu ý**: Chỉ tài khoản **Admin** mới thấy mục "Quản lý bài đăng". Tài khoản Sale sẽ KHÔNG thấy.

### Bước 2: Tìm mục "Quản lý bài đăng" ở thanh bên trái

Sau khi đăng nhập, nhìn **thanh bên trái** (sidebar), bạn sẽ thấy danh sách menu:

```
📊 Dashboard
👥 Khách hàng
🏗️ Dự án
📢 Chiến dịch
🏆 Sale
👤 Quản lý tài khoản
📝 Quản lý bài đăng  ← BẤM VÀO ĐÂY
```

### Bước 3: Bấm vào "📝 Quản lý bài đăng"

Khi bấm, menu sẽ **mở ra 3 mục con** giống như một cái thư mục:

```
📝 Quản lý bài đăng  ▼     ← Bấm để mở/đóng
   📋 Tất cả bài            ← Trang quản lý bài viết
   📄 Quản lý Page           ← Trang quản lý Fanpage
   📅 Lịch đăng bài          ← Trang xem lịch
```

- Bấm mũi tên **▼** để đóng/mở danh sách con
- Bấm vào từng mục con để vào trang đó
- Mục đang được chọn sẽ có **viền xanh dương** bên trái

> 💡 **Mẹo**: Nếu sidebar bị thu nhỏ (chỉ thấy icon), bấm vào icon **☰** ở góc trái trên để mở rộng sidebar ra.

---

## 3. QUẢN LÝ PAGE FACEBOOK

### 3.1. Page Facebook là gì?

**Page Facebook** (Fanpage) là trang kinh doanh trên Facebook. VD: "Vinhomes Grand Park Official" là một Fanpage.

Để hệ thống có thể đăng bài lên Fanpage, bạn cần **khai báo** (thêm) Fanpage vào hệ thống trước.

### 3.2. Cách vào trang Quản lý Page

Bấm: **📝 Quản lý bài đăng** → **📄 Quản lý Page**

### 3.3. Giao diện trang Quản lý Page

Bạn sẽ thấy:

```
┌──────────────────────────────────────────────────────┐
│ Quản lý Page Facebook           [＋ Thêm Page mới]  │
├──────────────────────────────────────────────────────┤
│ 💡 Hướng dẫn: Để lấy Access Token, truy cập...      │
├──────────────────────────────────────────────────────┤
│ Ảnh | Tên Page      | Facebook ID | Token  | Active | Thao tác │
│ 🖼️  | Vinhomes GP   | 12345...    | ✅ OK  | 🟢 ON  | ✏️ 🗑️   │
│ 🖼️  | The Global    | 67890...    | ❌     | 🔴 OFF | ✏️ 🗑️   │
└──────────────────────────────────────────────────────┘
```

### 3.4. Thêm Page mới (QUAN TRỌNG - Làm đầu tiên!)

**Tại sao phải thêm Page?** Vì nếu không có Page nào trong hệ thống, bạn sẽ không thể chọn "đăng lên đâu" khi tạo bài.

#### Bước 1: Bấm nút [＋ Thêm Page mới]

Một cửa sổ popup sẽ hiện ra với 4 ô cần điền:

#### Bước 2: Điền thông tin

| Ô nhập | Bắt buộc? | Giải thích | Ví dụ |
|--------|-----------|------------|-------|
| **Tên Page** | ✅ Bắt buộc | Tên Fanpage của bạn, đặt tên gì cũng được để bạn nhận ra | `Vinhomes Grand Park Official` |
| **Facebook Page ID** | Nên có | Dãy số ID của Fanpage. Cách lấy: xem phần 3.6 bên dưới | `105432789012345` |
| **Access Token** | Nên có | Mã bí mật để hệ thống có quyền đăng bài lên Fanpage. Cách lấy: xem phần 3.7 bên dưới | `EAAGm0PX4ZCps...` (rất dài) |
| **URL Ảnh đại diện** | Không bắt buộc | Link ảnh đại diện của Page (để hiển thị đẹp hơn) | `https://...avatar.jpg` |

#### Bước 3: Bấm [Lưu]

Done! Page đã được thêm vào hệ thống.

### 3.5. Giải thích các cột trong bảng

| Cột | Ý nghĩa |
|-----|---------|
| **Ảnh** | Ảnh đại diện của Page (nếu có) |
| **Tên Page** | Tên bạn đã đặt |
| **Facebook ID** | Mã ID của Fanpage trên Facebook |
| **Trạng thái Token** | 🟢 "Đã kết nối" = có token, sẵn sàng đăng bài. 🔴 "Chưa cập nhật" = chưa nhập token, KHÔNG đăng bài được |
| **Active** | Nút gạt bật/tắt. Bật = Page hoạt động. Tắt = tạm ngưng (không hiện khi chọn Page để đăng) |
| **Thao tác** | ✏️ = Sửa thông tin Page, 🗑️ = Xóa Page |

### 3.6. Cách lấy Facebook Page ID

**Cách 1 - Dễ nhất:**
1. Mở Fanpage của bạn trên Facebook
2. Bấm vào **"Giới thiệu"** (About)
3. Kéo xuống dưới → Tìm dòng **"Page ID"** → Copy dãy số

**Cách 2 - Dùng công cụ:**
1. Vào trang https://findmyfbid.in/
2. Dán link Fanpage vào
3. Bấm "Find" → Copy số ID

### 3.7. Cách tạo ứng dụng Facebook & lấy Access Token (QUAN TRỌNG NHẤT!)

> ⚠️ **Access Token** là "chìa khóa" để hệ thống đăng bài lên Fanpage. Không có token = KHÔNG đăng được!

---

#### 🔶 PHẦN A: TẠO ỨNG DỤNG FACEBOOK (Chỉ làm 1 lần)

##### A1. Truy cập Meta for Developers
1. Mở trình duyệt → Vào: https://developers.facebook.com/
2. Đăng nhập bằng tài khoản Facebook **đang quản lý Fanpage** của bạn
3. Bấm nút **"Ứng dụng của tôi"** (My Apps) ở góc phải trên

##### A2. Tạo ứng dụng mới
1. Bấm nút **"Tạo ứng dụng"** (Create App)
2. Chọn loại ứng dụng: **"Doanh nghiệp"** (Business) hoặc **"Không"** (None) → Bấm **Tiếp**
3. Điền thông tin:
   - **Tên ứng dụng**: Đặt tên gì cũng được, VD: `Automation Post To Page API`
   - **Email liên hệ**: Email của bạn
4. Bấm **"Tạo ứng dụng"** (Create App)
5. Xác minh bảo mật (nhập mật khẩu hoặc mã xác thực)

> ✅ Sau khi tạo xong, bạn sẽ thấy **Bảng điều khiển** (Dashboard) của ứng dụng.

---

#### 🔶 PHẦN B: CẤU HÌNH QUYỀN CHO ỨNG DỤNG

> 💡 Đây là bước quan trọng nhất! Ứng dụng cần được cấp quyền để đăng bài lên Page.

##### B1. Tùy chỉnh trường hợp sử dụng

Ở Bảng điều khiển, bạn sẽ thấy mục **"Tùy chỉnh ứng dụng và các yêu cầu"**:

```
┌────────────────────────────────────────────────────────────┐
│ Tùy chỉnh ứng dụng và các yêu cầu                         │
│                                                            │
│ ⊙ Tùy chỉnh trường hợp sử dụng Quản lý mọi thứ trên Trang │ ← BẤM VÀO ĐÂY
│ ⊙ Thử nghiệm trường hợp sử dụng                           │
│ ⊙ Kiểm tra để đảm bảo bạn đã hoàn tất mọi yêu cầu...     │
└────────────────────────────────────────────────────────────┘
```

1. Bấm vào **"Tùy chỉnh trường hợp sử dụng Quản lý mọi thứ trên Trang"**
2. Bạn sẽ thấy danh sách các **quyền** (Permissions) có thể thêm

##### B2. Thêm các quyền cần thiết

Tìm và bấm **"Thêm"** (Add) cho các quyền sau:

| Quyền | Tên tiếng Anh | Mục đích |
|-------|---------------|----------|
| ✅ **Đăng bài lên Page** | `pages_manage_posts` | Cho phép hệ thống tạo bài đăng trên Fanpage |
| ✅ **Đọc nội dung Page** | `pages_read_engagement` | Cho phép đọc thông tin bài đăng, tương tác |
| ✅ **Xem danh sách Page** | `pages_show_list` | Cho phép xem danh sách Page bạn quản lý |
| ✅ **Quản lý Page** | `pages_manage_metadata` | Cho phép quản lý thông tin Page |
| ✅ **Đọc user profile** | `pages_read_user_content` | Cho phép đọc nội dung người dùng trên Page |

**Cách thêm quyền:**
- Mỗi quyền có nút **"Thêm"** (Add) bên phải → Bấm từng cái một
- Sau khi thêm, quyền sẽ hiện tick ✅ xanh

> ⚠️ **Lưu ý**: Một số quyền cần **xét duyệt** (App Review) mới dùng được cho người khác. Nhưng nếu bạn là **Admin/Developer** của ứng dụng VÀ là Admin của Fanpage, bạn có thể dùng ngay mà KHÔNG cần xét duyệt!

##### B3. (Tùy chọn) Thêm người thử nghiệm

Nếu muốn người khác cũng dùng được ứng dụng (trước khi xét duyệt):
1. Ở sidebar trái → Bấm **"Vai trò trong ứng dụng"** (App Roles)
2. Bấm **"Thêm người"** (Add People)
3. Nhập tên/email Facebook của họ
4. Chọn vai trò **"Nhà phát triển"** (Developer) hoặc **"Người thử nghiệm"** (Tester)
5. Người đó cần vào https://developers.facebook.com/requests/ để **chấp nhận lời mời**

---

#### 🔶 PHẦN C: LẤY ACCESS TOKEN

##### C1. Vào công cụ Graph API Explorer
1. Truy cập: https://developers.facebook.com/tools/explorer/
2. Hoặc từ Bảng điều khiển → Menu trên cùng → **"Công cụ"** (Tools) → **"Graph API Explorer"**

##### C2. Chọn đúng ứng dụng
```
┌─────────────────────────────────────────────────────┐
│ Graph API Explorer                                   │
│                                                     │
│ Facebook App: [Automation Post To Page API  ▼]  ← CHỌN ỨNG DỤNG CỦA BẠN │
│                                                     │
│ User or Page: [User Token ▼]                        │
│                                                     │
│ Permissions: [                              ]       │
│              [+ Add a Permission]                   │
│                                                     │
│ Access Token: [EAAxxxxxxxxxxxxxxx...]   [Generate]  │
└─────────────────────────────────────────────────────┘
```

- Ở dropdown **"Facebook App"** → Chọn **"Automation Post To Page API"** (tên ứng dụng bạn đã tạo)

##### C3. Thêm quyền vào Token
1. Bấm **"Add a Permission"** (Thêm quyền)
2. Mở mục **"Pages"** và tick chọn:
   - ✅ `pages_manage_posts`
   - ✅ `pages_read_engagement`
   - ✅ `pages_show_list`
   - ✅ `pages_read_user_content`

##### C4. Tạo User Token
1. Bấm nút **"Generate Access Token"** (Tạo Access Token)
2. Popup đăng nhập Facebook hiện ra → **Đăng nhập**
3. Popup xin quyền hiện ra → **Cho phép tất cả** các quyền được liệt kê
4. Chọn **tất cả Fanpage** bạn muốn quản lý → Bấm **Xong/Done**
5. Bạn sẽ thấy chuỗi token dài xuất hiện trong ô "Access Token"

> ⚠️ Đây mới chỉ là **User Token** (token người dùng). Cần chuyển sang **Page Token** ở bước tiếp theo!

##### C5. Chuyển sang Page Token (QUAN TRỌNG!)
1. Ở dropdown **"User or Page"** → Đổi từ **"User Token"** sang **tên Fanpage** của bạn
   ```
   User or Page: [User Token          ▼]
                  User Token
                  ─────────────────────
                  📘 Vinhomes Grand Park    ← CHỌN PAGE NÀY
                  📘 The Global City
                  📘 Masteri Centre Point
   ```
2. Token trong ô sẽ **thay đổi** → Đây mới là **Page Token** đúng!
3. **Copy token này** (bấm vào ô token → Ctrl+A → Ctrl+C)

##### C6. (Khuyến nghị) Đổi sang Token vĩnh viễn

Token vừa lấy chỉ có hạn **1-2 giờ** (VD: Debug Tool hiện "Expires: in 54 minutes"). Nếu dùng token này, sau 1-2h sẽ hết hạn và không đăng bài được nữa!

> ⚠️ **QUAN TRỌNG**: Phải gia hạn token, nếu không sau vài giờ là phải lấy lại token mới!

**🅰️ CÁCH NHANH (Token 60 ngày - Đơn giản, khuyến nghị cho người mới):**

1. Ở bước C5 bạn đã có **Page Token** (khi chọn tên Page ở dropdown)
2. Vào: https://developers.facebook.com/tools/debug/accesstoken/
3. Dán **Page Token** vào ô → Bấm **"Debugging"**
4. Xem dòng **"Expired"**: Ghi "(in XX minutes)" → Token ngắn hạn
5. Kéo xuống dưới cùng → Bấm nút **"Extended access code"** (nút xanh dương)
6. Một token mới dài hơn hiện ra → **Copy token mới này**
7. ✅ Đây là **Page Token dài hạn (~60 ngày)** → Dán vào CRM dùng được luôn!
8. Sau 60 ngày hết hạn → Làm lại từ bước C4

> 💡 **Cách này dễ nhất**, phù hợp nếu bạn không ngại 2 tháng lấy token 1 lần.

---

**🅱️ CÁCH NÂNG CAO (Token VĨNH VIỄN - Không bao giờ hết hạn):**

> ⚠️ **QUAN TRỌNG**: Phải gia hạn **USER Token** (KHÔNG phải Page Token)! Nếu bạn gia hạn Page Token rồi gọi `me/accounts` → Sẽ bị lỗi `"(#100) Tried accessing nonexisting field (accounts)"`.

**Bước 1 - Lấy User Token dài hạn:**

1. Quay lại **Graph API Explorer** (https://developers.facebook.com/tools/explorer/)
2. Đổi dropdown **"User or Page"** về **"User Token"** hoặc **"User ID"**
3. Bấm **"Generate Access Token"** → Cho phép → Chọn Page → Done
4. **GIỮ NGUYÊN** dropdown ở "User Token/User ID" (⚠️ KHÔNG đổi sang tên Page!)
5. **Copy token** trong ô Access code → Đây là **User Token ngắn hạn**
6. Vào **Debug Tool**: https://developers.facebook.com/tools/debug/accesstoken/
7. Dán **User Token** vào → Bấm **"Debugging"** → Kiểm tra dòng **"Type"** phải ghi **"User"** (KHÔNG phải "Page")
8. Bấm **"Extended access code"** → Copy token mới → Đây là **Long-lived USER Token**

**Bước 2 - Dùng Long-lived User Token gọi me/accounts:**

1. Quay lại **Graph API Explorer**
2. Dán **Long-lived User Token** (vừa copy) vào ô **"Access code"**
3. Kiểm tra dropdown **"User or Page"** = **"User ID"** (⚠️ KHÔNG được chọn tên Page!)
4. Trong ô request, gõ: `me/accounts`
5. Bấm **Send**
6. Kết quả trả về JSON có token Page vĩnh viễn:
   ```json
   {
     "data": [
       {
         "name": "Sun Group Real Estate",
         "access_token": "EAAxxxxxx...rất_dài...",  ← COPY CÁI NÀY
         "id": "861080645003795"
       }
     ]
   }
   ```
7. **Copy token** trong trường `access_token` của Page bạn muốn
8. Vào Debug Tool kiểm tra → Dòng "Expired" ghi **"Never"** → Token vĩnh viễn! ✅

> ⚠️ **SAI LẦM HAY GẶP**: Extend **Page Token** → dán vào Explorer → gọi `me/accounts` → BỊ LỖI! Vì `me/accounts` chỉ chấp nhận **User Token**. Phải extend **User Token** mới đúng!

> 💡 **Mẹo phân biệt**: Vào Debug Tool → Xem dòng **"Type"**. Nếu ghi "User" = đúng. Nếu ghi "Page" = sai, cần lấy lại User Token.

##### C7. Dán Token vào hệ thống CRM

1. Quay lại web CRM (http://localhost:4000)
2. Đăng nhập Admin
3. Vào **📄 Quản lý Page**
4. Bấm ✏️ (sửa) Page cần cập nhật token
5. Dán token vào ô **"Access Token"**
6. Bấm **[Lưu]**
7. Kiểm tra cột "Trạng thái Token" → Phải hiện 🟢 **"Đã kết nối"**

> ✅ **XONG!** Bây giờ bạn có thể đăng bài lên Fanpage từ hệ thống CRM!

---

#### 🔶 PHẦN D: KIỂM TRA THỬ (TEST)

##### D1. Test nhanh Token có hoạt động không

1. Mở Graph API Explorer
2. Chọn đúng ứng dụng + Page Token
3. Trong ô request, đổi method thành **POST**
4. Gõ: `{PAGE_ID}/feed` (thay `{PAGE_ID}` bằng ID Fanpage)
5. Ở phần Body, thêm field: `message` = `Test từ API`
6. Bấm **Submit**
7. Nếu trả về `{ "id": "123456_789..." }` → ✅ Token hoạt động!
8. Vào Fanpage kiểm tra → Sẽ thấy bài "Test từ API" đã được đăng

> ⚠️ Sau khi test xong, nhớ **xóa bài test** trên Fanpage!

##### D2. Test từ hệ thống CRM

1. Vào **📋 Tất cả bài** → Bấm **[＋ Tạo bài mới]**
2. Viết nội dung test VD: "Bài test từ CRM"
3. Chọn Page đã nhập token
4. Bấm **[✅ Sẵn sàng đăng]**
5. Ở bảng danh sách, bấm 🚀
6. Nếu trạng thái chuyển thành 🟢 "Đã đăng" → **Mọi thứ hoạt động!** 🎉

---

#### 🔶 PHẦN E: XỬ LÝ LỖI THƯỜNG GẶP KHI CẤU HÌNH

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| "App Not Set Up" | Ứng dụng chưa cấu hình xong | Quay lại Phần B, thêm đủ quyền |
| "(#100) Tried accessing nonexisting field (accounts)" | Bạn đang dùng **Page Token** để gọi `me/accounts`. Endpoint này chỉ chấp nhận **User Token** | Đổi dropdown **"User or Page"** về lại **"User Token"** → rồi mới gọi `me/accounts` |
| "(#200) Requires either publish_to_groups or manage_pages" | Thiếu quyền | Thêm quyền `pages_manage_posts` ở Graph API Explorer |
| "Error validating access token" | Token hết hạn | Lấy token mới (Phần C) |
| "Page token expired" | Token ngắn hạn đã hết hạn | Lấy token vĩnh viễn (Phần C6) |
| "The user hasn't authorized the application" | Chưa cho phép ứng dụng | Bấm Generate Token → Cho phép lại |
| "(#10) This post cannot be published" | Fanpage bị hạn chế | Kiểm tra Fanpage có bị Facebook hạn chế không |
| "Invalid OAuth access token" | Token sai hoặc copy thiếu | Copy lại token, đảm bảo copy đủ (không thừa/thiếu ký tự) |
| Dropdown "User or Page" không hiện Page nào | Chưa Generate Token hoặc khi Generate không chọn Page nào | Bấm lại **Generate Access Token** → ở popup phải **tick chọn tất cả Fanpage** → Done |
| Graph API Explorer chỉ hiện 2 quyền (pages_show_list, business_management) | Chưa thêm quyền ở **Dashboard ứng dụng** | Vào Dashboard app → Tùy chỉnh trường hợp sử dụng → Thêm đủ quyền (Phần B) → Quay lại Explorer |

---

#### 🔶 TÓM TẮT CÁC LINK QUAN TRỌNG

| Link | Mục đích |
|------|----------|
| https://developers.facebook.com/ | Trang chủ Meta for Developers |
| https://developers.facebook.com/apps/ | Danh sách ứng dụng của bạn |
| https://developers.facebook.com/tools/explorer/ | Lấy Access Token |
| https://developers.facebook.com/tools/debug/accesstoken/ | Kiểm tra & gia hạn token |
| https://developers.facebook.com/docs/pages-api/ | Tài liệu chính thức Pages API |

### 3.8. Nút gạt Active (Bật/Tắt)

- **Bật (xanh lá 🟢)**: Page này đang hoạt động, sẽ xuất hiện khi bạn tạo bài đăng mới
- **Tắt (xám ⚪)**: Page tạm ngưng, không hiển thị khi tạo bài

**Khi nào tắt?** VD: Token của Page hết hạn mà chưa kịp cập nhật → tắt đi để không bị lỗi khi đăng bài.

### 3.9. Sửa thông tin Page

1. Bấm icon ✏️ (bút chì) ở cột "Thao tác"
2. Popup hiện ra với thông tin hiện tại
3. Sửa bất kỳ ô nào bạn muốn
4. Bấm **[Lưu]**

### 3.10. Xóa Page

1. Bấm icon 🗑️ (thùng rác) ở cột "Thao tác"
2. Hệ thống hỏi: "Xóa Page này?" → Bấm **OK** để xác nhận
3. Page sẽ bị xóa vĩnh viễn

> ⚠️ **Lưu ý**: Xóa Page KHÔNG ảnh hưởng đến Fanpage thật trên Facebook. Chỉ xóa thông tin trong hệ thống CRM thôi.

---

## 4. QUẢN LÝ BÀI ĐĂNG

### 4.1. Cách vào

Bấm: **📝 Quản lý bài đăng** → **📋 Tất cả bài**

### 4.2. Giao diện tổng quan

```
┌──────────────────────────────────────────────────────────────┐
│ Quản lý bài đăng                        [＋ Tạo bài mới]    │
├──────────────────────────────────────────────────────────────┤
│ ┌────────┐  ┌────────┐  ┌──────────────┐                    │
│ │ Bài    │  │ Tổng   │  │ Bài đã đăng  │   ← 3 ô thống kê │
│ │ đang   │  │ số     │  │ hôm nay      │                    │
│ │ chờ: 5 │  │ trang: │  │ 3            │                    │
│ │        │  │ 20     │  │              │                    │
│ └────────┘  └────────┘  └──────────────┘                    │
├──────────────────────────────────────────────────────────────┤
│ [🔍 Tìm kiếm] [Dự án ▼] [Trạng thái ▼] [Page ▼]           │
├──────────────────────────────────────────────────────────────┤
│ Xem trước │ Tiêu đề     │ Dự án │ Ngày │ Page  │ TT  │ ⚡  │
│ 🖼️ ảnh    │ Căn hộ VH.. │ VH GP │ 12/3 │📘FB  │ SẴN │✏🗑🚀│
│ 🖼️ ảnh    │ Đất nền...  │ TGC   │ 11/3 │📘IG  │NHÁP │✏🗑🚀│
├──────────────────────────────────────────────────────────────┤
│ [← Trước] [1] [2] [3] [Sau →]              Hiển thị: [20▼] │
├──────────────────────────────────────────────────────────────┤
│ 📅 Sắp đăng bài                                             │
│ • Căn hộ Vinhomes giá tốt - 12/03/2026 09:00                │
│ • Đất nền The Global City - 12/03/2026 14:00                 │
└──────────────────────────────────────────────────────────────┘
```

### 4.3. Giải thích 3 ô thống kê nhanh (phía trên)

| Ô | Ý nghĩa |
|---|---------|
| **Bài đang chờ** | Số bài ở trạng thái "Bản nháp" (Draft) - chưa sẵn sàng đăng |
| **Tổng số trang** | Tổng số bài đăng trong hệ thống |
| **Bài đã đăng hôm nay** | Số bài đã đăng thành công lên Facebook trong ngày hôm nay |

### 4.4. Bộ lọc (Filter) - Tìm bài nhanh

Có 4 bộ lọc, giúp bạn tìm bài nhanh khi có nhiều bài:

| Bộ lọc | Cách dùng | Ví dụ |
|--------|-----------|-------|
| **🔍 Tìm kiếm** | Gõ từ khóa bất kỳ → Lọc theo tiêu đề hoặc nội dung | Gõ "Vinhomes" → Chỉ hiện bài có chữ Vinhomes |
| **Dự án** | Chọn dropdown → Lọc bài theo dự án bất động sản | Chọn "Vinhomes Grand Park" → Chỉ hiện bài dự án đó |
| **Trạng thái** | Chọn dropdown → Lọc theo trạng thái | Chọn "Sẵn sàng" → Chỉ hiện bài đã sẵn sàng đăng |
| **Page** | Chọn dropdown → Lọc bài theo Fanpage đích | Chọn "VH GP Official" → Chỉ hiện bài đăng lên Page đó |

> 💡 Bạn có thể kết hợp nhiều bộ lọc cùng lúc!

### 4.5. Giải thích các cột trong bảng

| Cột | Ý nghĩa |
|-----|---------|
| **Xem trước** | Ảnh thumbnail (ảnh nhỏ) của bài đăng. Nếu không có ảnh → hiện icon 📷 |
| **Tiêu đề** | Dòng 1: Tiêu đề bài. Dòng 2: Vài chữ đầu của nội dung |
| **Dự án** | Bài này thuộc dự án nào (VD: Vinhomes Grand Park) |
| **Ngày tạo** | Ngày bạn tạo bài này |
| **Trang đăng** | Danh sách Fanpage được chọn để đăng (có icon 📘) |
| **Trạng thái** | Xem phần 7 bên dưới để hiểu chi tiết |
| **Thao tác** | Các nút hành động: ✏️ Sửa, 🗑️ Xóa, 🚀 Đăng ngay |

### 4.6. TẠO BÀI MỚI (Chi tiết từng bước)

#### Bước 1: Bấm nút [＋ Tạo bài mới]

Một popup lớn sẽ hiện ra:

```
┌──────────────────────────────────────┐
│ Tạo bài đăng mới                  ✕ │
├──────────────────────────────────────┤
│ Tiêu đề:                            │
│ [________________________________]   │
│                                      │
│ Nội dung:                            │
│ [________________________________]   │
│ [________________________________]   │
│ [________________________________]   │
│                          120 ký tự   │
│                                      │
│ Hình ảnh / Video:                    │
│ [🖼️ ảnh1] [🖼️ ảnh2] [✕]            │
│ [URL hình ảnh...        ] [Thêm URL]│
│ [📁 Tải lên từ máy]                 │
│                                      │
│ Chọn Page đăng:                      │
│ ┌──────────────────────────────┐     │
│ │ ☑ 📘 Vinhomes Grand Park    │     │
│ │ ☐ 📘 The Global City        │     │
│ │ ☑ 📘 Masteri Centre Point   │     │
│ └──────────────────────────────┘     │
│                                      │
│ Dự án:        │ Hẹn giờ đăng:       │
│ [VH GP    ▼]  │ [12/03/2026 09:00]  │
│                                      │
│ Link (nếu có):                       │
│ [https://...                    ]    │
│                                      │
│ [💾 Lưu nháp] [✅ Sẵn sàng] [Hủy]  │
└──────────────────────────────────────┘
```

#### Bước 2: Điền tiêu đề

- Ô **"Tiêu đề"**: Đặt tên cho bài đăng để bạn dễ nhận ra
- VD: `Căn hộ Vinhomes Grand Park giá tốt`
- Tiêu đề này chỉ hiển thị trong hệ thống CRM, KHÔNG hiển thị trên Facebook

#### Bước 3: Viết nội dung

- Ô **"Nội dung"**: Đây là nội dung SẼ HIỂN THỊ trên Facebook
- Ở góc phải dưới có **bộ đếm ký tự** (VD: "120 ký tự")
- VD:
```
🏢 CĂN HỘ VINHOMES GRAND PARK - GIÁ CHỈ TỪ 2.5 TỶ!
✅ Vị trí đắc địa Q9
✅ Tiện ích đẳng cấp 5 sao
✅ Ngân hàng hỗ trợ vay 70%
📞 Liên hệ: 0909.xxx.xxx
```

#### Bước 4: Thêm hình ảnh (có 2 cách)

**Cách 1 - Dán URL hình ảnh:**
1. Copy đường link ảnh từ Internet (VD: từ Google Drive, Imgur...)
2. Dán vào ô "Dán URL hình ảnh..."
3. Bấm nút **[Thêm URL]** hoặc nhấn Enter
4. Ảnh sẽ hiện ra ngay bên trên để xem trước

**Cách 2 - Tải lên từ máy tính:**
1. Bấm nút **[📁 Tải lên từ máy]**
2. Chọn 1 hoặc nhiều file ảnh từ máy tính
3. Ảnh sẽ hiện ra ngay để xem trước

**Xóa ảnh:** Bấm nút ✕ (đỏ) ở góc phải trên của ảnh cần xóa.

> 💡 Có thể thêm **nhiều ảnh** - hệ thống sẽ đăng dạng album ảnh lên Facebook.

#### Bước 5: Chọn Page đăng

- Danh sách tất cả Fanpage bạn đã thêm sẽ hiện ra
- **Tick ☑** vào Page nào bạn muốn đăng bài lên
- Có thể chọn **nhiều Page cùng lúc** → Bài sẽ đăng lên TẤT CẢ Page đã chọn!

> ⚠️ Nếu danh sách trống ("Chưa có Page nào"), bạn cần thêm Page trước (xem phần 3).

#### Bước 6: Chọn Dự án

- Dropdown **"Dự án"**: Chọn bài này thuộc dự án nào
- Giúp phân loại và lọc bài sau này

#### Bước 7: Hẹn giờ đăng (TÙY CHỌN)

- Ô **"Hẹn giờ đăng"**: Bấm vào → Chọn ngày giờ bạn muốn đăng
- **Có thể bỏ trống** nếu không cần hẹn giờ
- VD: Chọn `12/03/2026 09:00` → Bài sẽ được hẹn đăng lúc 9h sáng ngày 12/3

> 📌 **Lưu ý**: Hiện tại hẹn giờ chỉ đánh dấu thời gian, việc đăng tự động cần tích hợp thêm Make.com/App Script.

#### Bước 8: Thêm Link (TÙY CHỌN)

- Ô **"Link"**: Nếu bài đăng có kèm link (VD: link bài viết, link đăng ký...)
- **Có thể bỏ trống**

#### Bước 9: Lưu bài

Có **3 nút** ở cuối popup:

| Nút | Ý nghĩa | Khi nào bấm? |
|-----|---------|--------------|
| **💾 Lưu nháp** | Lưu bài ở trạng thái "Bản nháp" → Chưa sẵn sàng đăng | Khi bạn viết dở, muốn quay lại sửa sau |
| **✅ Sẵn sàng đăng** | Lưu bài ở trạng thái "Sẵn sàng" → Có thể đăng bất cứ lúc nào | Khi bạn đã viết xong, kiểm tra kỹ rồi |
| **Hủy** | Đóng popup, KHÔNG lưu gì cả | Khi bạn đổi ý, không muốn tạo bài nữa |

### 4.7. SỬA BÀI ĐÃ TẠO

1. Tìm bài cần sửa trong bảng
2. Bấm icon ✏️ (bút chì) ở cột "Thao tác"
3. Popup hiện ra giống hệt popup tạo bài, nhưng đã điền sẵn thông tin cũ
4. Sửa bất kỳ ô nào bạn muốn
5. Bấm **[💾 Lưu nháp]** hoặc **[✅ Sẵn sàng đăng]**

### 4.8. XÓA BÀI

1. Bấm icon 🗑️ (thùng rác) ở cột "Thao tác"
2. Hộp thoại hỏi: "Xóa bài đăng này?" → Bấm **OK**
3. Bài bị xóa khỏi hệ thống

> ⚠️ **Xóa là vĩnh viễn!** Không thể khôi phục. Hãy cân nhắc kỹ trước khi xóa.
> ⚠️ Xóa trong CRM KHÔNG xóa bài đã đăng trên Facebook.

### 4.9. ĐĂNG BÀI LÊN FACEBOOK (Nút 🚀)

**Đây là chức năng chính!** Khi bấm 🚀, hệ thống sẽ tự động đăng bài lên TẤT CẢ Fanpage đã chọn.

#### Cách đăng:

1. Tìm bài muốn đăng (trạng thái phải là "Bản nháp" hoặc "Sẵn sàng")
2. Bấm icon 🚀 (tên lửa) ở cột "Thao tác"
3. Hộp thoại hỏi: "Đăng bài này lên Facebook ngay?" → Bấm **OK**
4. Đợi vài giây...
5. Kết quả:
   - ✅ **Thành công**: Trạng thái chuyển thành "Đã đăng" (xanh lá) + Link xem bài
   - ❌ **Lỗi**: Trạng thái chuyển thành "Lỗi" (đỏ) + Thông báo lỗi

#### Hệ thống đăng bài lên Facebook như thế nào?

Phía sau, hệ thống sẽ:

1. **Kiểm tra** bài đăng có chọn Page nào không
2. **Lấy Access Token** của từng Page đã chọn
3. **Nếu có ảnh**: Upload từng ảnh lên Facebook dưới dạng "chưa công khai" → Sau đó tạo bài đăng gộp tất cả ảnh thành album
4. **Nếu không có ảnh**: Tạo bài đăng chỉ có text (+ link nếu có)
5. **Gửi lên Facebook** qua Facebook Graph API
6. Cập nhật trạng thái trong hệ thống

#### Khi nào đăng bị lỗi?

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| "Thiếu Access Token" | Page chưa nhập token | Vào Quản lý Page → Sửa → Nhập token |
| Token hết hạn | Token đã quá 1-2 giờ | Lấy token mới từ Graph API Explorer |
| Lỗi upload ảnh | URL ảnh sai hoặc không truy cập được | Kiểm tra lại URL ảnh |
| Quyền không đủ | Token không có quyền `pages_manage_posts` | Lấy token mới với đủ quyền |

### 4.10. CHUYỂN ĐỔI TRẠNG THÁI (Toggle)

Trong cột "Trạng thái", bài ở trạng thái **"Bản nháp"** hoặc **"Sẵn sàng"** có thể BẤM VÀO để chuyển đổi:

- Bấm **[Bản nháp]** → Chuyển thành **[Sẵn sàng]** (xanh dương)
- Bấm **[Sẵn sàng]** → Chuyển thành **[Bản nháp]** (xám)

> 💡 Giống như nút gạt ON/OFF vậy!

### 4.11. PHÂN TRANG

Khi có nhiều bài (hơn 20), bảng sẽ được chia trang:

- **[← Trước]** : Quay lại trang trước
- **[1] [2] [3]**: Bấm số trang
- **[Sau →]**: Sang trang kế
- **Dropdown [20▼]**: Chọn hiển thị 20, 50, hoặc 100 bài/trang

### 4.12. Panel "Sắp đăng bài"

Ở cuối trang (trên máy tính), có panel hiển thị **5 bài đăng gần nhất** đang ở trạng thái "Sẵn sàng" VÀ có hẹn giờ, sắp xếp theo thời gian.

---

## 5. LỊCH ĐĂNG BÀI

### 5.1. Cách vào

Bấm: **📝 Quản lý bài đăng** → **📅 Lịch đăng bài**

### 5.2. Giao diện

```
┌──────────────────────────────────────────────┐
│ 📅 Lịch đăng bài    [◀] Tháng 3 2026 [▶]   │
├──────────────────────────────────────────────┤
│  CN   T2   T3   T4   T5   T6   T7          │
│                            1    2           │
│   3    4    5    6    7    8    9           │
│  10   [11]  12   13   14   15   16          │
│       ^^                                     │
│    HÔM NAY                                   │
│  17   18   19   20   21   22   23          │
│  24   25   26   27   28   29   30          │
│  31                                          │
├──────────────────────────────────────────────┤
│ ⬜ Bản nháp  🟦 Sẵn sàng  🟩 Đã đăng  🟥 Lỗi│
└──────────────────────────────────────────────┘
```

### 5.3. Cách đọc lịch

- Mỗi ô là **1 ngày** trong tháng
- Trong mỗi ô, các bài đăng sẽ hiển thị dưới dạng **thanh nhỏ màu sắc**:
  - Thanh **xám** = Bản nháp
  - Thanh **xanh dương** = Sẵn sàng
  - Thanh **xanh lá** = Đã đăng
  - Thanh **đỏ** = Lỗi
- **Ngày hôm nay** được highlight nền xanh nhạt + số đậm màu xanh
- Nếu 1 ngày có nhiều hơn 3 bài, sẽ hiện "+N bài" (VD: "+2 bài")

### 5.4. Điều hướng tháng

- Bấm **[◀]** để xem **tháng trước**
- Bấm **[▶]** để xem **tháng sau**
- Tên tháng và năm hiển thị ở giữa (VD: "Tháng 3 2026")

### 5.5. Bài hiển thị theo ngày nào?

- Nếu bài có **hẹn giờ** → Hiển thị theo ngày hẹn giờ
- Nếu bài **không hẹn giờ** → Hiển thị theo ngày tạo bài

### 5.6. Chú thích màu (Legend)

Ở dưới lịch có bảng chú thích 4 màu:
- ⬜ Bản nháp (xám)
- 🟦 Sẵn sàng (xanh dương)
- 🟩 Đã đăng (xanh lá)
- 🟥 Lỗi (đỏ)

---

## 6. QUY TRÌNH ĐĂNG BÀI HOÀN CHỈNH (Từ A đến Z)

Đây là quy trình **từ đầu đến cuối** cho người mới dùng lần đầu:

### Lần đầu sử dụng (chỉ cần làm 1 lần):

```
Bước 1: Đăng nhập (admin / admin123)
         ↓
Bước 2: Vào "📄 Quản lý Page"
         ↓
Bước 3: Bấm [＋ Thêm Page mới]
         ↓
Bước 4: Điền tên Page + Page ID + Access Token
         ↓
Bước 5: Bấm [Lưu]
         ↓
✅ XONG! Page đã sẵn sàng.
```

### Mỗi lần đăng bài:

```
Bước 1: Vào "📋 Tất cả bài"
         ↓
Bước 2: Bấm [＋ Tạo bài mới]
         ↓
Bước 3: Viết tiêu đề + nội dung
         ↓
Bước 4: Thêm hình ảnh (nếu có)
         ↓
Bước 5: Tick chọn Page muốn đăng
         ↓
Bước 6: Chọn dự án
         ↓
Bước 7: (Tùy chọn) Hẹn giờ đăng
         ↓
Bước 8: Bấm [✅ Sẵn sàng đăng]
         ↓
Bước 9: Ở bảng danh sách, bấm 🚀 (tên lửa) để đăng ngay
         ↓
Bước 10: Xác nhận "OK"
         ↓
✅ BÀI ĐÃ ĐĂNG LÊN FACEBOOK!
```

---

## 7. GIẢI THÍCH TRẠNG THÁI BÀI ĐĂNG

Mỗi bài đăng có 1 trong 4 trạng thái:

### 📝 Bản nháp (Draft) - Màu XÁM

```
Ý nghĩa: Bài đang viết dở, chưa hoàn chỉnh
Có thể: Sửa, Xóa, Chuyển sang "Sẵn sàng", Đăng ngay
VD: Bạn viết bài nhưng chưa có ảnh → Lưu nháp, mai thêm ảnh sau
```

### ✅ Sẵn sàng (Ready) - Màu XANH DƯƠNG

```
Ý nghĩa: Bài đã viết xong, đã kiểm tra, sẵn sàng đăng bất cứ lúc nào
Có thể: Sửa, Xóa, Chuyển lại "Bản nháp", Đăng ngay
VD: Bài đã hoàn chỉnh, đợi sếp duyệt xong sẽ đăng
```

### 🟢 Đã đăng (Posted) - Màu XANH LÁ

```
Ý nghĩa: Bài đã được đăng thành công lên Facebook
Có thể: Xem bài trên Facebook (bấm vào "Đã đăng ↗"), Sửa (trong CRM), Xóa (trong CRM)
KHÔNG thể: Đăng lại
VD: Bấm "Đã đăng ↗" → Mở Facebook → Xem bài đã đăng
```

### ❌ Lỗi (Error) - Màu ĐỎ

```
Ý nghĩa: Đăng bài thất bại, có lỗi xảy ra
Có thể: Xem lỗi (hover chuột vào dòng lỗi đỏ), Sửa bài, Thử đăng lại
VD: Token hết hạn → Cập nhật token mới → Sửa bài → Đăng lại
```

### Sơ đồ chuyển đổi trạng thái:

```
                    Bấm toggle
    📝 Bản nháp ◄──────────────► ✅ Sẵn sàng
         │                              │
         │         Bấm 🚀              │         Bấm 🚀
         └──────────────┬───────────────┘
                        ↓
              ┌─── Đăng Facebook ───┐
              ↓                     ↓
        🟢 Đã đăng              ❌ Lỗi
        (thành công)            (thất bại)
```

---

## 8. CÂU HỎI THƯỜNG GẶP

### ❓ Tôi tạo bài nhưng không thấy danh sách Page để chọn?

**Trả lời:** Bạn chưa thêm Page nào. Vào **📄 Quản lý Page** → Bấm **[＋ Thêm Page mới]** → Điền thông tin → Lưu.

---

### ❓ Đăng bài bị lỗi "Thiếu Access Token"?

**Trả lời:** Page bạn chọn chưa nhập Access Token. Vào **📄 Quản lý Page** → Bấm ✏️ sửa Page đó → Nhập token → Lưu.

---

### ❓ Token hết hạn thì sao?

**Trả lời:** Vào https://developers.facebook.com/tools/explorer/ → Lấy token mới → Cập nhật vào Page.

---

### ❓ Tôi muốn đăng 1 bài lên 5 Fanpage cùng lúc?

**Trả lời:** Khi tạo bài, tick chọn cả 5 Page → Bấm đăng → Bài sẽ lên cả 5 Page!

---

### ❓ Đăng bài có ảnh từ máy tính lên Facebook được không?

**Trả lời:** Có! Khi tạo bài, bấm **[📁 Tải lên từ máy]** → Chọn ảnh. Tuy nhiên, ảnh sẽ được chuyển thành dạng base64 (dữ liệu nhúng), nên **khuyến nghị dùng URL ảnh** (từ Google Drive, Imgur...) để đảm bảo chất lượng và tốc độ.

---

### ❓ Bài "Bản nháp" có bị đăng lên Facebook không?

**Trả lời:** KHÔNG. Chỉ khi bạn chủ động bấm 🚀 thì bài mới đăng. Bản nháp chỉ lưu trong hệ thống CRM.

---

### ❓ Xóa bài trong CRM thì bài trên Facebook có mất không?

**Trả lời:** KHÔNG. Bài đã đăng trên Facebook vẫn còn nguyên. Xóa trong CRM chỉ xóa bản ghi quản lý thôi.

---

### ❓ Tôi không thấy mục "Quản lý bài đăng" trong menu?

**Trả lời:** Chỉ tài khoản **Admin** mới thấy. Nếu bạn đăng nhập bằng tài khoản Sale, sẽ không có mục này.

---

### ❓ Hẹn giờ đăng có tự đăng không?

**Trả lời:** Hiện tại chức năng hẹn giờ chỉ **đánh dấu thời gian** để bạn nhớ. Việc tự động đăng theo giờ cần tích hợp thêm với Make.com hoặc Google Apps Script.

---

### ❓ Có đăng được lên Instagram không?

**Trả lời:** Hiện tại hệ thống chỉ hỗ trợ **Facebook Page**. Để đăng Instagram cần tích hợp thêm Instagram Graph API.

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề không giải quyết được, hãy:
1. Chụp màn hình lỗi
2. Ghi lại bước bạn đang thực hiện
3. Liên hệ quản trị viên hệ thống

---

> 📅 Tài liệu cập nhật: 11/03/2026
> 📌 Phiên bản: 1.0
