# 🏗️ SƠ ĐỒ CHI TIẾT HỆ THỐNG CRM IQI

> **Phiên bản:** 2.0 — Cập nhật: 10/04/2026  
> Mở trên GitHub hoặc VS Code (Ctrl+Shift+V) để xem Mermaid dạng hình.

---

## 📑 Mục lục

1. [Kiến trúc tổng quan toàn hệ thống](#1-kiến-trúc-tổng-quan-toàn-hệ-thống)
2. [Luồng dữ liệu chính (Data Flow)](#2-luồng-dữ-liệu-chính)
3. [Đồng bộ Google Sheet chi tiết](#3-đồng-bộ-google-sheet-chi-tiết)
4. [Vòng đời Lead hoàn chỉnh](#4-vòng-đời-lead-hoàn-chỉnh)
5. [Hệ thống trạng thái Lead (21 status)](#5-hệ-thống-trạng-thái-lead)
6. [Auto-Rotate & Lịch chia tự động](#6-auto-rotate--lịch-chia-tự-động)
7. [Telegram Bot Flow](#7-telegram-bot-flow)
8. [Facebook Integration](#8-facebook-integration)
9. [AI & Machine Learning](#9-ai--machine-learning)
10. [Hệ thống phân quyền 3 cấp](#10-hệ-thống-phân-quyền-3-cấp)
11. [Database Schema](#11-database-schema)
12. [Background Jobs & Scheduled Tasks](#12-background-jobs--scheduled-tasks)
13. [Real-time & Socket.IO](#13-real-time--socketio)
14. [Frontend Pages & Components](#14-frontend-pages--components)
15. [Backup, Restore & An toàn dữ liệu](#15-backup-restore--an-toàn-dữ-liệu)
16. [API Endpoints Map](#16-api-endpoints-map)

---

## 1. Kiến trúc tổng quan toàn hệ thống

```mermaid
flowchart TB
    classDef external fill:#FFF3E0,stroke:#E65100,color:#000
    classDef server fill:#E8F5E9,stroke:#2E7D32,color:#000
    classDef db fill:#E3F2FD,stroke:#1565C0,color:#000
    classDef frontend fill:#F3E5F5,stroke:#6A1B9A,color:#000
    classDef infra fill:#ECEFF1,stroke:#37474F,color:#000

    subgraph INTERNET["🌐 NGUỒN BÊN NGOÀI"]
        direction LR
        GS["📊 Google Sheets\n─────────────\n• Dữ liệu lead từ QC\n• Sheet bài đăng MKT\n• Sheet chi phí QC"]:::external
        TG["📱 Telegram Bot\n─────────────\n• Bot CRM (id=2)\n• Webhook callback\n• Inline keyboard"]:::external
        FB["📘 Facebook Platform\n─────────────\n• Graph API v21.0\n• Ads API\n• Messenger API\n• CAPI (Conversions)"]:::external
        AI_EXT["🤖 AI Services\n─────────────\n• OpenAI GPT-4o\n• Perplexity sonar-pro\n• Google Gemini"]:::external
        NEWS_SRC["📰 Nguồn tin BĐS\n─────────────\n• Batdongsan.com.vn\n• Cho Tot\n• Tin tức thị trường"]:::external
    end

    subgraph VPS["🖥️ VPS 103.200.20.113"]
        direction TB

        subgraph NGINX["Nginx Reverse Proxy"]
            SSL["HTTPS crm-iqi.id.vn\n→ localhost:4000"]:::infra
        end

        subgraph NODE["⚙️ Node.js Server (Express 5.1 · Port 4000)"]
            direction TB

            subgraph AUTH_LAYER["🔐 Authentication Layer"]
                JWT["JWT Token\nverifyToken middleware"]
                ROLES["Role Check\nadmin · manager · sale"]
                RATE["Rate Limiter\nexpress-rate-limit"]
            end

            subgraph CORE["📋 Core Business Logic"]
                SYNC["🔄 Sync Engine\nsyncAllProjects()"]
                LEAD_OPS["📝 Lead Operations\nchia · xáo · feedback · recall"]
                ROTATE["🔁 Auto-Rotate\nautoRotateLeads()"]
                SCHEDULE["📅 Lịch chia\nautoSchedule()"]
                POST_FIX["🔧 Post-sync Fix\npostSyncStatusFix()"]
            end

            subgraph INTEGRATIONS["🔌 Integrations"]
                TG_HANDLER["Telegram Handler\nwebhook · notify · callback"]
                FB_HANDLER["Facebook Handler\nads · messenger · pages · CAPI"]
                AI_HANDLER["AI Handler\ncontent review · advisor · news"]
                SHEET_POST["Sheet Posts\nbài đăng · lịch đăng"]
            end

            subgraph DATA_LAYER["📊 Data Layer"]
                READ_DATA["readData()\nĐọc leads + history + campaigns"]
                FILTER["filterDataForRole()\nLọc theo vai trò"]
                ANALYTICS["Analytics Engine\nthống kê · báo cáo · CPL"]
            end

            SOCKET_IO["🔌 Socket.IO Server\nReal-time push"]
            BACKUP_SYS["💾 Backup System\nauto 8h · manual · selective"]
        end

        subgraph DATABASE["🗄️ SQLite Database"]
            direction LR
            DB_MAIN["crm.db\n─────────\n20+ tables\n~500MB"]:::db
            DB_BACKUP["backup/\n─────────\ncrm_*.db\nGiữ 7 ngày"]:::db
        end
    end

    subgraph CLIENTS["🖥️ Frontend (React 19 + Vite)"]
        direction LR
        ADMIN_UI["👑 Admin View\n12 tabs đầy đủ"]:::frontend
        MGR_UI["👔 Manager View\nDự án được gán"]:::frontend
        SALE_UI["👤 Sale View\nLead của mình"]:::frontend
    end

    %% External connections
    GS -->|"API v4\n3 phút/lần"| SYNC
    TG -->|"Webhook HTTPS"| TG_HANDLER
    FB -->|"Graph API\nOAuth Token"| FB_HANDLER
    AI_EXT -->|"REST API"| AI_HANDLER
    NEWS_SRC -->|"Scraping"| AI_HANDLER

    %% Server to DB
    CORE --> DB_MAIN
    DATA_LAYER --> DB_MAIN
    BACKUP_SYS --> DB_BACKUP

    %% Auth flow
    SSL --> AUTH_LAYER
    AUTH_LAYER --> CORE
    AUTH_LAYER --> DATA_LAYER
    AUTH_LAYER --> INTEGRATIONS

    %% Real-time
    SOCKET_IO -->|"WebSocket"| CLIENTS

    %% Data flow to frontend
    FILTER --> SOCKET_IO
```

---

## 2. Luồng dữ liệu chính

```mermaid
flowchart LR
    classDef source fill:#FFF9C4,stroke:#F57F17,color:#000
    classDef process fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef store fill:#BBDEFB,stroke:#1565C0,color:#000
    classDef output fill:#E1BEE7,stroke:#6A1B9A,color:#000

    subgraph INPUT["📥 DỮ LIỆU VÀO"]
        direction TB
        S1["Google Sheet\n(Lead từ QC FB)"]:::source
        S2["Facebook Ads API\n(Chi phí · metrics)"]:::source
        S3["Telegram\n(Feedback sale)"]:::source
        S4["CRM UI\n(Admin thao tác)"]:::source
        S5["AI Services\n(Phân tích · đánh giá)"]:::source
    end

    subgraph PROCESS["⚙️ XỬ LÝ"]
        direction TB
        P1["Sync Engine\n4-tier matching\nphone · name · adsId"]:::process
        P2["Post-sync Fix\nKhôi phục status\ntừ CRM history"]:::process
        P3["filterDataForRole\nAdmin: tất cả\nManager: dự án\nSale: lead mình"]:::process
        P4["Auto-Rotate\n3 ngày check\nRound-robin"]:::process
        P5["Analytics\nCPL · tỉ lệ chốt\nLead quality"]:::process
    end

    subgraph STORE["🗄️ LƯU TRỮ"]
        direction TB
        D1["leads\n(status · sale · manager)"]:::store
        D2["lead_history\n(timeline feedback)"]:::store
        D3["campaigns\n(FB Ads data)"]:::store
        D4["telegram_pending\n(chờ feedback)"]:::store
        D5["chat_messages\n(tin nhắn nội bộ)"]:::store
    end

    subgraph OUTPUT["📤 ĐẦU RA"]
        direction TB
        O1["Dashboard\n(Donut chart · Cards)"]:::output
        O2["Lead Table\n(Filter · Sort · Search)"]:::output
        O3["Thống kê Sale\n(Kanban · Leaderboard)"]:::output
        O4["Telegram Notify\n(Thông báo lead mới)"]:::output
        O5["Facebook CAPI\n(Event tracking)"]:::output
        O6["Báo cáo\n(Excel export)"]:::output
    end

    S1 --> P1
    S2 --> P5
    S3 --> P2
    S4 --> P2
    S5 --> P5

    P1 --> D1
    P1 --> D2
    P2 --> D1
    P3 --> O1
    P3 --> O2
    P3 --> O3
    P4 --> D1
    P4 --> D2
    P5 --> O6

    D1 --> P3
    D2 --> P3
    D1 --> P4
    D2 --> P5

    P1 -->|"Lead mới"| O4
    P2 -->|"Status đổi"| O5
```

---

## 3. Đồng bộ Google Sheet chi tiết

```mermaid
flowchart TD
    classDef trigger fill:#FFECB3,stroke:#FF8F00,color:#000
    classDef action fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef decision fill:#FFF9C4,stroke:#F57F17,color:#000
    classDef data fill:#BBDEFB,stroke:#1565C0,color:#000
    classDef error fill:#FFCDD2,stroke:#C62828,color:#000

    START["⏰ Trigger\n─────────\n• Auto: mỗi 3 phút\n• Manual: Admin bấm Sync"]:::trigger

    subgraph PHASE1["📥 PHASE 1: Đọc dữ liệu từ Sheet"]
        READ["Đọc Google Sheet API v4\n(spreadsheets.values.get)\nLấy tất cả rows của sheet"]:::action
        PARSE["Parse dữ liệu\n─────────\n• Detect cột: Tên, SĐT, Trạng thái...\n• Detect Sale blocks\n  (Nhận Lead → Feedback)\n• extractSaleHistory()"]:::action
    end

    subgraph PHASE2["💾 PHASE 2: Backup & Matching"]
        BACKUP_HIST["Backup CRM history\n─────────\nSELECT * FROM lead_history\nWHERE source != 'sheet'\n  → crmHistMap (theo phone)"]:::data

        subgraph MATCHING["🔍 4-Tier Matching (Tìm lead cũ)"]
            TIER1["Tier 1: ads_id\n(Facebook Ads ID)\nChính xác nhất"]:::decision
            TIER2["Tier 2: phone + name\n(Chuẩn hóa +84)"]:::decision
            TIER3["Tier 3: phone only\n(Bỏ qua tên)"]:::decision
            TIER4["Tier 4: name only\n(Cùng dự án · fallback)"]:::decision
        end

        RESTORE_DATA["Khôi phục từ lead cũ\n─────────\n• sale_id, sale_name\n• manager_name\n• notes, is_hot\n• CRM history entries"]:::action
    end

    subgraph PHASE3["🔄 PHASE 3: Replace Data"]
        DELETE["DELETE FROM leads\nWHERE project_id = ?\n\nDELETE FROM lead_history\nWHERE lead_id IN (deleted)"]:::action
        INSERT_LEADS["INSERT leads\n─────────\n• Sheet data + khôi phục\n• Status: từ DATE-FIX hoặc sheet"]:::action
        INSERT_HIST["INSERT lead_history\n─────────\n1. Sheet history (seq thấp)\n2. CRM history (seq cao)\n→ CRM luôn ưu tiên hơn"]:::action
    end

    subgraph PHASE4["🔧 PHASE 4: Post-sync Status Fix"]
        LOAD_HIST["Load TẤT CẢ history\ncủa dự án vừa sync"]:::data
        SORT_DATE["Sort theo ngày giảm dần\n(parseContactDate)\nMới nhất → Cũ nhất"]:::action

        subgraph WALK["Duyệt history mỗi lead"]
            CHECK_SOURCE{"source = 'sheet'?"}
            CHECK_CHIA{"action = 'Chia lead'?"}
            CHECK_STATUS{"Có status?"}
            APPLY_FIX["UPDATE leads\nSET status = ?\nWHERE id = ?"]:::action
            SKIP["Bỏ qua\n(continue)"]
            BOUNDARY["Dừng duyệt\n(break tại Chia lead\ntừ nguồn CRM)"]
        end
    end

    subgraph PHASE5["📢 PHASE 5: Thông báo"]
        DETECT_NEW["Detect lead MỚI\n(Không match bất kỳ tier)"]:::action
        NOTIFY_TG["Gửi Telegram\n─────────\n• Tên · SĐT · Dự án\n• Nút: Quan tâm · Hẹn xem\n  KBM · Spam · Không nghe máy"]:::action
        EMIT_SOCKET["Socket.IO emit\n'data-changed'"]:::action
    end

    START --> READ
    READ --> PARSE
    PARSE --> BACKUP_HIST
    BACKUP_HIST --> TIER1
    TIER1 -->|"Match"| RESTORE_DATA
    TIER1 -->|"No match"| TIER2
    TIER2 -->|"Match"| RESTORE_DATA
    TIER2 -->|"No match"| TIER3
    TIER3 -->|"Match"| RESTORE_DATA
    TIER3 -->|"No match"| TIER4
    TIER4 -->|"Match"| RESTORE_DATA
    TIER4 -->|"No match"| RESTORE_DATA

    RESTORE_DATA --> DELETE
    DELETE --> INSERT_LEADS
    INSERT_LEADS --> INSERT_HIST
    INSERT_HIST --> LOAD_HIST
    LOAD_HIST --> SORT_DATE

    SORT_DATE --> CHECK_SOURCE
    CHECK_SOURCE -->|"Có → bỏ"| SKIP
    CHECK_SOURCE -->|"Không"| CHECK_CHIA
    CHECK_CHIA -->|"Có (CRM)"| BOUNDARY
    CHECK_CHIA -->|"Không"| CHECK_STATUS
    CHECK_STATUS -->|"Có"| APPLY_FIX
    CHECK_STATUS -->|"Không"| SKIP
    SKIP --> SORT_DATE

    APPLY_FIX --> DETECT_NEW
    BOUNDARY --> DETECT_NEW
    DETECT_NEW --> NOTIFY_TG
    NOTIFY_TG --> EMIT_SOCKET
```

---

## 4. Vòng đời Lead hoàn chỉnh

```mermaid
flowchart TD
    classDef start fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef process fill:#BBDEFB,stroke:#1565C0,color:#000
    classDef decision fill:#FFF9C4,stroke:#F57F17,color:#000
    classDef auto fill:#E1BEE7,stroke:#6A1B9A,color:#000
    classDef final_good fill:#A5D6A7,stroke:#1B5E20,color:#000
    classDef final_bad fill:#FFCDD2,stroke:#C62828,color:#000
    classDef notify fill:#FFE0B2,stroke:#E65100,color:#000

    ORIGIN["🆕 Lead xuất hiện\n─────────\nTừ quảng cáo Facebook\n→ Google Sheet\n→ Sync vào CRM"]:::start

    ASSIGN{"Chia lead\n─────────\nThủ công / Lịch tự động\n/ Xáo lead?"}:::decision

    subgraph SALE_CYCLE["👤 Chu kỳ Sale"]
        SALE_RECV["Sale nhận lead\n─────────\nstatus = new\nTelegram: thông báo lead mới"]:::process
        TG_NOTIFY["📱 Telegram Notify\n─────────\nInline buttons:\n✅ Quan tâm\n📅 Hẹn xem nhà\n🚫 KBM\n⛔ Spam\n📵 Không nghe máy"]:::notify

        FEEDBACK{"Sale phản hồi\ntrong 3 ngày?"}:::decision

        subgraph POSITIVE["✅ Phản hồi tích cực"]
            INTERESTED["Quan tâm\n(interested)"]:::process
            APPOINTMENT["Hẹn xem nhà\n(appointment)"]:::process
            VISITED["Đã xem nhà\n(visited)"]:::process
            NEGOTIATING["Đang thương lượng\n(negotiating)"]:::process
        end

        subgraph CLOSING["🏆 Chốt deal"]
            BOOKING["Đặt cọc\n(booking)"]:::final_good
            DEPOSIT["Đã cọc\n(deposit)"]:::final_good
            CLOSED["Đã chốt\n(closed)"]:::final_good
        end

        subgraph NEGATIVE["❌ Kết quả tiêu cực"]
            KBM["KBM\n(not_reached)"]:::process
            NO_ANSWER["Không nghe máy\n(no_answer)"]:::process
            CALLBACK["Liên lạc lại sau\n(callback)"]:::process
            NOT_INTERESTED["Không quan tâm\n(not_interested)"]:::final_bad
            WRONG_NUMBER["Sai số\n(wrong_number)"]:::final_bad
            SPAM["Spam\n(spam)"]:::final_bad
            LOST["Mất\n(lost)"]:::final_bad
        end
    end

    NO_FB_3D["⏰ 3 ngày không feedback"]:::auto
    AUTO_ROTATE["🔁 Auto-Rotate\n─────────\nThu hồi lead\nGhi history 'thu hồi'\nXóa Telegram message cũ"]:::auto
    NEXT_SALE["👤 Sale tiếp theo\n(Round-robin trong dự án)"]:::process

    CAPI_EVENT["📊 Facebook CAPI\n─────────\nGửi event:\n• Lead → interested\n• InitiateCheckout → appointment\n• Schedule → visited\n• Purchase → closed"]:::notify

    %% Main flow
    ORIGIN --> ASSIGN
    ASSIGN --> SALE_RECV
    SALE_RECV --> TG_NOTIFY
    TG_NOTIFY --> FEEDBACK

    FEEDBACK -->|"Có"| INTERESTED
    FEEDBACK -->|"Không"| NO_FB_3D

    %% Positive path
    INTERESTED --> APPOINTMENT
    APPOINTMENT --> VISITED
    VISITED --> NEGOTIATING
    NEGOTIATING --> BOOKING
    BOOKING --> DEPOSIT
    DEPOSIT --> CLOSED

    %% Negative paths
    FEEDBACK -->|"KBM"| KBM
    FEEDBACK -->|"Spam"| SPAM
    KBM --> CALLBACK
    NO_ANSWER --> CALLBACK
    CALLBACK -->|"3 ngày"| NO_FB_3D

    %% Auto-rotate cycle
    NO_FB_3D --> AUTO_ROTATE
    AUTO_ROTATE --> NEXT_SALE
    NEXT_SALE --> SALE_RECV

    %% CAPI
    INTERESTED -->|"status change"| CAPI_EVENT
    APPOINTMENT -->|"status change"| CAPI_EVENT
    CLOSED -->|"status change"| CAPI_EVENT
```

---

## 5. Hệ thống trạng thái Lead

```mermaid
stateDiagram-v2
    classDef positive fill:#C8E6C9,color:#000
    classDef negative fill:#FFCDD2,color:#000
    classDef neutral fill:#BBDEFB,color:#000
    classDef closing fill:#A5D6A7,color:#000

    [*] --> new : Lead mới từ Sheet

    state "🟡 Tiếp cận" as contact_group {
        new --> contacted: Đã liên hệ
        new --> no_answer : Không nghe máy
        new --> not_reached : KBM
        no_answer --> callback : Hẹn gọi lại
        not_reached --> callback : Hẹn gọi lại
        contacted --> callback : Chưa quyết định
    }

    state "🟢 Quan tâm" as interest_group {
        contacted --> interested : Có quan tâm
        callback --> interested : Gọi lại OK
        interested --> appointment : Hẹn xem nhà
        appointment --> visited : Đã xem
        visited --> negotiating : Đang thương lượng
    }

    state "🏆 Chốt deal" as close_group {
        negotiating --> booking : Đặt cọc
        booking --> deposit : Đã nộp cọc
        deposit --> closed : Hoàn tất
    }

    state "🔴 Kết thúc tiêu cực" as lost_group {
        contacted --> not_interested : Từ chối
        interested --> not_interested : Đổi ý
        callback --> not_interested : Từ chối
        new --> spam : Số rác
        new --> wrong_number : Sai SĐT
        interested --> lost : Mất khách
        negotiating --> lost : Mất khách
    }

    state "🔄 Auto-rotate" as rotate {
        new --> auto_rotate_check : 3 ngày không feedback
        callback --> auto_rotate_check : 3 ngày không feedback
        auto_rotate_check --> new : Chuyển sale mới
    }

    note right of close_group
        LOCKED STATUSES
        (Không bị auto-rotate):
        • booking
        • deposit
        • closed
        • not_interested
        • spam
        • wrong_number
    end note
```

### Bảng 21 trạng thái

| # | Key | Tiếng Việt | Màu | Nhóm | Bị auto-rotate? |
|---|-----|-----------|------|------|:---:|
| 1 | `new` | Mới | 🔵 Blue | Tiếp cận | ✅ |
| 2 | `contacted` | Đã liên hệ | 🟣 Purple | Tiếp cận | ✅ |
| 3 | `interested` | Quan tâm | 🟢 Green | Quan tâm | ✅ |
| 4 | `appointment` | Hẹn xem nhà | 🟡 Amber | Quan tâm | ✅ |
| 5 | `visited` | Đã xem nhà | 🔵 Teal | Quan tâm | ✅ |
| 6 | `negotiating` | Đang thương lượng | 🟠 Orange | Chốt | ✅ |
| 7 | `callback` | Liên lạc lại sau | 🟡 Yellow | Chờ | ✅ |
| 8 | `no_answer` | Không nghe máy | 🔘 Gray | Tiếp cận | ✅ |
| 9 | `not_reached` | KBM | 🔘 Gray | Tiếp cận | ✅ |
| 10 | `booking` | Đặt cọc | 🟢 Light Green | Chốt | ❌ Locked |
| 11 | `deposit` | Đã cọc | 🟢 Green | Chốt | ❌ Locked |
| 12 | `closed` | Đã chốt | 🟢 Dark Green | Chốt | ❌ Locked |
| 13 | `not_interested` | Không quan tâm | 🔴 Red | Kết thúc | ❌ Locked |
| 14 | `wrong_number` | Sai số | 🔴 Red | Kết thúc | ❌ Locked |
| 15 | `spam` | Spam | ⚫ Dark | Kết thúc | ❌ Locked |
| 16 | `lost` | Mất | 🔴 Dark Red | Kết thúc | ❌ Locked |
| 17 | `canceled` | Đã huỷ cọc | 🟠 Orange | Kết thúc | ❌ Locked |
| 18 | `duplicate` | Trùng | 🔘 Gray | Kết thúc | ❌ Locked |
| 19 | `transferred` | Đã chuyển | 🔵 Blue | Kết thúc | ❌ Locked |
| 20 | `other` | Khác | 🔘 Gray | Khác | ✅ |
| 21 | `pending_review` | Chờ duyệt | 🟡 Yellow | Chờ | ✅ |

### Nhiệt độ Lead (Temperature)

| Badge | Điều kiện | Ý nghĩa |
|-------|----------|---------|
| 🔥 **Cực nóng** | Tạo ≤ 24h | Lead rất mới, cần gọi ngay |
| 🟠 **Nóng** | Tạo ≤ 72h | Lead mới, ưu tiên cao |
| 🟡 **Ấm** | Tạo ≤ 7 ngày | Lead còn tiềm năng |
| 🔵 **Lạnh** | Tạo > 7 ngày | Lead cũ, khả năng thấp |

---

## 6. Auto-Rotate & Lịch chia tự động

### 6.1 Auto-Rotate Flow

```mermaid
flowchart TD
    classDef check fill:#FFF9C4,stroke:#F57F17,color:#000
    classDef action fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef skip fill:#FFCDD2,stroke:#C62828,color:#000

    TIMER["⏰ Mỗi 30 phút\nautoRotateLeads()"]

    CHECK_ENABLED{"Auto-rotate\nbật/tắt?"}:::check
    GET_LEADS["Lấy tất cả lead\ncó sale_id != NULL"]:::action

    subgraph CHECK["🔍 Kiểm tra từng lead"]
        IS_LOCKED{"Status locked?\n(booking/deposit/closed\n/spam/wrong_number\n/not_interested/lost)"}:::check
        HAS_RECENT{"Có feedback\ntrong 3 ngày?"}:::check
        IS_EXCLUDED{"Lead bị exclude\n(Thu hồi manual)?"}:::check
    end

    subgraph ROTATE_ACTION["🔁 Thực hiện xáo"]
        FIND_NEXT["Tìm sale tiếp theo\n─────────\nRound-robin trong\ndanh sách sale của dự án\n(bỏ sale hiện tại)"]:::action
        UPDATE_LEAD["UPDATE leads\nSET sale_id = new_sale\n    sale_name = new_sale"]:::action
        INSERT_HIST["INSERT lead_history\naction = 'Chia lead'\nfeedback = 'Auto-rotate:\nkhông phản hồi 3 ngày'"]:::action
        DELETE_TG["Xóa Telegram message cũ\n(của sale cũ)"]:::action
        SEND_TG["Gửi Telegram mới\ncho sale mới nhận"]:::action
    end

    SKIP_LEAD["⏭️ Bỏ qua lead này"]:::skip

    TIMER --> CHECK_ENABLED
    CHECK_ENABLED -->|"Tắt"| SKIP_LEAD
    CHECK_ENABLED -->|"Bật"| GET_LEADS
    GET_LEADS --> IS_LOCKED
    IS_LOCKED -->|"Có"| SKIP_LEAD
    IS_LOCKED -->|"Không"| HAS_RECENT
    HAS_RECENT -->|"Có feedback"| SKIP_LEAD
    HAS_RECENT -->|"Không feedback\n> 3 ngày"| IS_EXCLUDED
    IS_EXCLUDED -->|"Có"| SKIP_LEAD
    IS_EXCLUDED -->|"Không"| FIND_NEXT
    FIND_NEXT --> UPDATE_LEAD
    UPDATE_LEAD --> INSERT_HIST
    INSERT_HIST --> DELETE_TG
    DELETE_TG --> SEND_TG
```

### 6.2 Lịch chia tự động (Auto-Schedule)

```mermaid
flowchart TD
    classDef config fill:#E8EAF6,stroke:#283593,color:#000
    classDef action fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef data fill:#BBDEFB,stroke:#1565C0,color:#000

    CONFIG["📅 Cấu hình lịch chia\n─────────\n• Dự án\n• Danh sách sale\n• Số lead/ngày/sale\n• Khung giờ chia\n• Ngày bắt đầu - kết thúc\n• Lọc theo status/need"]:::config

    subgraph SCHEDULE_ENGINE["⚙️ Schedule Engine (mỗi phút check)"]
        CHECK_TIME{"Đúng giờ\nchia?"}
        GET_POOL["Lấy pool lead chưa chia\n─────────\nstatus trong filter\nneed trong filter\nchưa có sale"]:::data
        CALC["Tính số lead mỗi sale\n= leads_per_day ÷ số khung giờ"]:::action
        DISTRIBUTE["Chia round-robin\n─────────\nSale 1: n lead\nSale 2: n lead\n..."]:::action
    end

    RESULT["📋 Kết quả\n─────────\n• leads.sale_id = assigned\n• lead_history: 'Chia lead'\n• Telegram: thông báo sale\n• Socket.IO: refresh UI"]:::action

    CALENDAR["📆 Calendar Preview\n─────────\nHiển thị lịch tháng\nSố slot mỗi ngày\nTên sale mỗi slot"]:::data

    CONFIG --> CHECK_TIME
    CHECK_TIME -->|"Chưa"| CHECK_TIME
    CHECK_TIME -->|"Đúng giờ"| GET_POOL
    GET_POOL --> CALC
    CALC --> DISTRIBUTE
    DISTRIBUTE --> RESULT
    CONFIG --> CALENDAR
```

---

## 7. Telegram Bot Flow

```mermaid
flowchart TD
    classDef bot fill:#E3F2FD,stroke:#0D47A1,color:#000
    classDef user fill:#FFF3E0,stroke:#E65100,color:#000
    classDef server fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef db fill:#F3E5F5,stroke:#6A1B9A,color:#000

    subgraph OUTGOING["📤 Server → Telegram (Thông báo)"]
        NEW_LEAD["Lead mới sync\nhoặc chia cho sale"]:::server
        FIND_TG["Tìm Telegram chat_id\ntừ user.telegram_id"]:::server
        BUILD_MSG["Tạo message\n─────────\n📋 <b>Lead mới</b>\nTên: xxx\nSĐT: xxx\nDự án: xxx\nChiến dịch: xxx\nNhu cầu: xxx\nNhiệt độ: 🔥 Nóng"]:::bot
        BUTTONS["Inline Keyboard\n─────────\n✅ Quan tâm\n📅 Hẹn xem nhà\n🚫 KBM\n⛔ Spam\n📵 Không nghe máy"]:::bot
        SEND["sendMessage()\nvia Bot CRM API"]:::bot
        SAVE_PENDING["INSERT telegram_pending\n(telegram_id, lead_id,\nmessage_id, phone)"]:::db
    end

    subgraph INCOMING["📥 Telegram → Server (Callback)"]
        SALE_CLICK["Sale bấm nút\ntrên Telegram"]:::user
        WEBHOOK["POST /api/telegram-webhook/2\nCallback query"]:::server

        subgraph LOOKUP["🔍 Tìm lead"]
            BY_ID{"Tìm bằng\nlead_id?"}
            BY_PHONE{"Fallback:\ntìm bằng phone?"}
            FOUND["Lead found ✅"]:::server
            NOT_FOUND["Lead not found ❌\n(Answer: 'Lead không tồn tại')"]
        end

        UPDATE_STATUS["UPDATE leads\nSET status = selected"]:::server
        INSERT_HISTORY["INSERT lead_history\naction = 'Cập nhật'\nsource = 'telegram'"]:::server
        EDIT_MSG["editMessageReplyMarkup()\nXóa buttons cũ"]:::bot
        CONFIRM["answerCallbackQuery()\n'✅ Đã cập nhật: Quan tâm'"]:::bot
        DELETE_PENDING["DELETE FROM telegram_pending"]:::db
        CAPI_SEND["Gửi Facebook CAPI\nevent (nếu applicable)"]:::server
    end

    subgraph RECALL["🔙 Thu hồi Lead"]
        ADMIN_RECALL["Admin thu hồi lead\n(Xóa entry từ history)"]:::server
        FIND_MSG["Tìm message_id\ntừ telegram_pending"]:::db
        DELETE_MSG["deleteMessage()\nXóa từ Telegram chat"]:::bot
    end

    %% Outgoing flow
    NEW_LEAD --> FIND_TG
    FIND_TG --> BUILD_MSG
    BUILD_MSG --> BUTTONS
    BUTTONS --> SEND
    SEND --> SAVE_PENDING

    %% Incoming flow
    SALE_CLICK --> WEBHOOK
    WEBHOOK --> BY_ID
    BY_ID -->|"Có"| FOUND
    BY_ID -->|"Không\n(ID cũ sau sync)"| BY_PHONE
    BY_PHONE -->|"Có"| FOUND
    BY_PHONE -->|"Không"| NOT_FOUND
    FOUND --> UPDATE_STATUS
    UPDATE_STATUS --> INSERT_HISTORY
    INSERT_HISTORY --> EDIT_MSG
    EDIT_MSG --> CONFIRM
    CONFIRM --> DELETE_PENDING
    UPDATE_STATUS --> CAPI_SEND

    %% Recall flow
    ADMIN_RECALL --> FIND_MSG
    FIND_MSG --> DELETE_MSG
```

---

## 8. Facebook Integration

```mermaid
flowchart LR
    classDef fb fill:#E3F2FD,stroke:#1565C0,color:#000
    classDef crm fill:#C8E6C9,stroke:#2E7D32,color:#000

    subgraph FB_PLATFORM["📘 Facebook Platform"]
        ADS_API["Ads API\n─────────\n• Campaign insights\n• Adset metrics\n• Ad creative"]:::fb
        MESSENGER["Messenger API\n─────────\n• Conversations\n• Messages\n• Send/receive"]:::fb
        PAGES["Pages API\n─────────\n• Page info\n• Publish posts\n• Post management"]:::fb
        CAPI["Conversions API\n─────────\n• Server-side events\n• Purchase, Lead...\n• Deduplication"]:::fb
        ADS_LIB["Ads Library\n─────────\n• Competitor ads\n• Duration, pages\n• Scraping"]:::fb
    end

    subgraph CRM_FEATURES["⚙️ CRM Features"]
        subgraph ADS_INSIGHTS["📊 Quảng cáo (Campaigns Tab)"]
            MULTI_ACC["Multi-account selector\n(Nhiều tài khoản QC)"]:::crm
            METRICS["9 Metric Cards\n─────────\nSpend · Impressions · Clicks\nCTR · CPC · CPM\nLeads · CPL · Conversions"]:::crm
            PROJECT_VIEW["Project View\n─────────\nNhóm campaign theo dự án CRM\nSo sánh hiệu suất"]:::crm
            AI_ADVISOR["AI Campaign Advisor\n─────────\nPhân tích · Điểm /100\nGợi ý cải thiện"]:::crm
        end

        subgraph MSG_INBOX["💬 Messenger Inbox"]
            CONV_LIST["Danh sách hội thoại\nAvatar · Name · Snippet\nAuto-refresh 15s"]:::crm
            CHAT_VIEW["Chat bubbles\nText · Image · Attachment\nAuto-poll 5s"]:::crm
            REPLY["Trả lời khách\nEnter to send"]:::crm
        end

        subgraph POST_MGMT["📝 Quản lý bài đăng"]
            SHEET_POSTS["Đọc bài từ Google Sheet\n(Sheet Config)"]:::crm
            FB_PUBLISH["Đăng bài lên nhiều Page\n(Multi-page publish)"]:::crm
            CALENDAR_VIEW["Lịch đăng bài\n(Calendar view tháng)"]:::crm
            STATUS_FLOW["STOP → READY → POSTED"]:::crm
        end

        subgraph CAPI_TRACKING["📊 CAPI Tracking"]
            EVENT_MAP["Status → Event mapping\n─────────\ninterested → Lead\nappointment → InitiateCheckout\nvisited → Schedule\nbooking → AddToCart\nclosed → Purchase"]:::crm
            SEND_EVENT["Server-side event\n─────────\nPixel ID + Token\nevent_name + user_data\n(phone hash · email hash)"]:::crm
            EVENT_LOG["Event log\n(timestamp · status · result)"]:::crm
        end
    end

    ADS_API --> MULTI_ACC
    ADS_API --> METRICS
    ADS_API --> AI_ADVISOR
    ADS_LIB --> AI_ADVISOR
    MESSENGER --> CONV_LIST
    MESSENGER --> CHAT_VIEW
    MESSENGER --> REPLY
    PAGES --> FB_PUBLISH
    CAPI --> SEND_EVENT
```

---

## 9. AI & Machine Learning

```mermaid
flowchart TD
    classDef ai fill:#E8EAF6,stroke:#283593,color:#000
    classDef feature fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef output fill:#FFF3E0,stroke:#E65100,color:#000

    subgraph AI_SERVICES["🤖 AI Services"]
        OPENAI["OpenAI\nGPT-4o-mini\n─────────\nContent Review\nContent Generation"]:::ai
        PERPLEXITY["Perplexity\nsonar-pro\n─────────\nMarket Intelligence\nDaily News BĐS\nCampaign Analysis"]:::ai
    end

    subgraph FEATURES["⚙️ Tính năng AI trong CRM"]
        subgraph CONTENT_REVIEW["📝 Content Review (4 bước)"]
            CR_INPUT["Input:\n• Tên dự án\n• Vị trí · Giá\n• USP · Đối tượng KH"]:::feature
            CR_ANALYZE["Phân tích:\n• What/Where/How/Why\n• 6 tiêu chí /10\n• Danh sách lỗi"]:::feature
            CR_GENERATE["Tạo 3 bản:\n• 🔥 Bản GẮT (FOMO + data)\n• 📖 Bản Kể chuyện\n• 💰 Bản Trực diện"]:::feature
        end

        subgraph MARKET_INTEL["🔍 Market Intelligence"]
            MI_INPUT["Input: Tên dự án\n+ Vị trí"]:::feature
            MI_CPL["CPL Estimate\nTheo loại sản phẩm\n(căn hộ/đất/villa)"]:::feature
            MI_COMPETE["Competition Density\nĐối thủ QC cùng khu\n(Ads Library scan)"]:::feature
            MI_PRICE["Property Prices\nGiá BĐS thực tế\n(Nhiều nguồn)"]:::feature
            MI_SCORE["Opportunity Score\n/100 điểm\n(AI verified)"]:::feature
        end

        subgraph CAMPAIGN_ADVISOR["🎯 Campaign Advisor"]
            CA_INPUT["Input:\n• Campaign data\n• Ad creative\n• Metrics"]:::feature
            CA_SCORE["Output:\n• Score /100\n• Verdict\n• Summary"]:::feature
            CA_IMPROVE["Gợi ý:\n• Content cải thiện\n• Targeting tối ưu\n• Budget phân bổ\n• Action items"]:::feature
        end

        subgraph DAILY_NEWS["📰 Tin tức BĐS hàng ngày"]
            DN_FETCH["Perplexity tổng hợp\ntin tức BĐS Việt Nam"]:::feature
            DN_VERDICT["Verdict mỗi tin:\n🟢 THƠM ▲ (cơ hội)\n🔴 ĐỘC ▼ (rủi ro)\n⚪ TRUNG TÍNH ●"]:::feature
            DN_HEAT["Market Heat: 0-100\n─────────\nĐóng băng → Thận trọng\n→ Ổn định → Sôi động"]:::feature
            DN_FORECAST["Dự báo 2-3 ngày\n+ Action items hôm nay"]:::feature
        end
    end

    OPENAI --> CR_ANALYZE
    OPENAI --> CR_GENERATE
    PERPLEXITY --> MI_CPL
    PERPLEXITY --> MI_COMPETE
    PERPLEXITY --> MI_SCORE
    PERPLEXITY --> CA_SCORE
    PERPLEXITY --> CA_IMPROVE
    PERPLEXITY --> DN_FETCH

    CR_INPUT --> CR_ANALYZE --> CR_GENERATE
    MI_INPUT --> MI_CPL
    MI_INPUT --> MI_COMPETE
    MI_INPUT --> MI_PRICE
    MI_CPL --> MI_SCORE
    CA_INPUT --> CA_SCORE --> CA_IMPROVE
    DN_FETCH --> DN_VERDICT --> DN_HEAT --> DN_FORECAST
```

---

## 10. Hệ thống phân quyền 3 cấp

```mermaid
flowchart TD
    classDef admin fill:#FFCDD2,stroke:#C62828,color:#000
    classDef manager fill:#FFE0B2,stroke:#E65100,color:#000
    classDef sale fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef shared fill:#E3F2FD,stroke:#1565C0,color:#000

    subgraph ADMIN_ROLE["👑 ADMIN — Toàn quyền"]
        direction TB
        A_LEAD["📋 Lead Management\n─────────\n• Xem TẤT CẢ lead\n• Chia / Xáo lead\n• Thu hồi lead\n• Hot lead marking\n• Gán Manager\n• Cross-reference"]:::admin
        A_USER["👥 User Management\n─────────\n• CRUD tài khoản\n• Auto-create từ Sheet\n• Bulk create\n• Gán dự án\n• Force password change"]:::admin
        A_SYSTEM["⚙️ System\n─────────\n• Backup / Restore\n• Auto-rotate ON/OFF\n• Lịch chia tự động\n• Bot Telegram setup\n• Sheet config\n• CAPI config"]:::admin
        A_ANALYTICS["📊 Analytics\n─────────\n• Lead Quality Report\n• Sales Analytics\n• Facebook Ads insights\n• Market Intelligence\n• Campaign Advisor\n• Content Review AI"]:::admin
        A_SOCIAL["📱 Social\n─────────\n• FB Messenger inbox\n• Quản lý bài đăng\n• FB Pages setup\n• Thông báo hệ thống\n• Daily News config"]:::admin
    end

    subgraph MANAGER_ROLE["👔 MANAGER — Quản lý dự án"]
        direction TB
        M_LEAD["📋 Lead (Scoped)\n─────────\n• Xem lead DỰ ÁN ĐƯỢC GÁN\n• Cập nhật feedback\n• Chia lead dự án mình\n• Ghi chú lead"]:::manager
        M_USER["👥 User (Limited)\n─────────\n• Xem danh sách sale\n• Gán sale vào dự án"]:::manager
        M_ANALYTICS["📊 Analytics\n─────────\n• Thống kê dự án mình\n• Leaderboard sale"]:::manager
    end

    subgraph SALE_ROLE["👤 SALE — Lead của mình"]
        direction TB
        S_LEAD["📋 Lead (Own only)\n─────────\n• Xem lead ĐƯỢC GIAO\n• Cập nhật feedback\n• Status hiện PER-SALE\n  (không thấy sale khác)"]:::sale
        S_HIDDEN["🚫 Không thấy\n─────────\n• Số lần đăng ký\n• Lịch sử sale khác\n• Chia / Xáo lead\n• User management\n• System settings"]:::sale
    end

    subgraph SHARED_FEATURES["🔗 Chung cho tất cả"]
        CHAT_ALL["💬 Chat nội bộ"]:::shared
        PROFILE_ALL["👤 Profile cá nhân"]:::shared
        GUIDE_ALL["📖 Hướng dẫn sử dụng"]:::shared
        TG_ALL["📱 Telegram feedback"]:::shared
    end

    subgraph DATA_FILTER["🔒 filterDataForRole()"]
        direction LR
        ADMIN_FILTER["Admin:\nreturn ALL data"]:::admin
        MANAGER_FILTER["Manager:\nfilterLeadsForManager()\n→ chỉ dự án projectIds"]:::manager
        SALE_FILTER["Sale:\nfilterLeadsForSale()\n→ chỉ lead assigned\n→ status PER-SALE\n  (history riêng)"]:::sale
    end
```

---

## 11. Database Schema

```mermaid
erDiagram
    leads ||--o{ lead_history : "has many"
    leads }o--|| projects : "belongs to"
    leads }o--|| users : "assigned to (sale)"
    users }o--o{ user_projects : "many-to-many"
    projects ||--o{ campaigns : "has many"
    projects ||--o{ lead_schedules : "configured"
    telegram_bots }o--|| projects : "serves"
    fb_pages ||--o{ fb_posts : "has many"
    users ||--o{ chat_messages : "sends"

    leads {
        int id PK
        int project_id FK
        text name
        text phone
        text ads_id
        text campaign
        text campaign_id
        text adset_name
        text ad_name
        text form_name
        text product
        text raw_status
        text status
        text created_at
        text inbox_url
        int is_hot
        int sale_id FK
        text sale_name
        text manager_name
        text source
        text budget
        text sync_at
        text notes
    }

    lead_history {
        int id PK
        int lead_id FK
        text sale_name
        text action
        text contact_date
        text status
        text feedback
        int seq
        text source
    }

    users {
        int id PK
        text username
        text password_hash
        text role
        text display_name
        text email
        text phone
        text avatar
        text telegram_id
        int must_change_password
        text last_seen
    }

    projects {
        int id PK
        text name
        text sheet_id
        text sheet_name
        int is_legacy
        text cost_sheet_id
    }

    user_projects {
        int user_id FK
        int project_id FK
    }

    campaigns {
        int id PK
        int project_id FK
        text campaign_id
        text campaign_name
    }

    lead_schedules {
        int id PK
        int project_id FK
        text sale_ids
        text times
        int leads_per_day
        text start_date
        text end_date
        text status_filter
        text need_filter
    }

    telegram_bots {
        int id PK
        text name
        text token
        int project_id FK
        int is_active
    }

    telegram_pending {
        text telegram_id PK
        int lead_id
        text status
        text created_at
        int message_id
        text phone
    }

    telegram_chat_users {
        int id PK
        int bot_id FK
        text chat_id
        text username
        text first_name
    }

    settings {
        text key PK
        text value
    }

    announcements {
        int id PK
        text title
        text content
        text priority
        text created_at
        text expires_at
        int is_active
    }

    chat_messages {
        int id PK
        int from_user_id FK
        int to_user_id FK
        text message
        text created_at
        int is_read
    }

    fb_ad_accounts {
        int id PK
        text account_id
        text name
        text access_token
    }

    fb_pages {
        int id PK
        text page_id
        text name
        text access_token
        text avatar_url
        int is_active
    }

    fb_posts {
        int id PK
        int page_id FK
        text post_id
        text message
        text created_at
    }

    sheet_configs {
        int id PK
        int project_id FK
        text script_url
        text sheet_name
    }

    daily_news {
        int id PK
        text date
        text content_json
        text created_at
    }

    capi_log {
        int id PK
        text event_name
        int lead_id
        text project_name
        text response
        text created_at
        int success
    }

    lead_status_log {
        int id PK
        int lead_id FK
        text old_status
        text new_status
        text changed_by
        text changed_at
    }

    market_intel_cache {
        int id PK
        text query_key
        text data_json
        text created_at
        text expires_at
    }

    marketing_guidelines {
        int id PK
        int project_id FK
        text content
        text updated_at
    }
```

---

## 12. Background Jobs & Scheduled Tasks

```mermaid
flowchart LR
    classDef job fill:#E8F5E9,stroke:#2E7D32,color:#000
    classDef freq fill:#BBDEFB,stroke:#1565C0,color:#000

    subgraph JOBS["⏰ Background Jobs"]
        direction TB

        subgraph J1["🔄 Google Sheet Sync"]
            J1_FREQ["Mỗi 3 phút"]:::freq
            J1_DESC["syncAllProjects()\n─────────\n• Đọc Sheet API\n• 4-tier matching\n• Replace data\n• Post-sync fix\n• Notify new leads\n• Socket.IO refresh"]:::job
        end

        subgraph J2["🔁 Auto-Rotate"]
            J2_FREQ["Mỗi 30 phút"]:::freq
            J2_DESC["autoRotateLeads()\n─────────\n• Check 3 ngày inactive\n• Round-robin xáo\n• Telegram notify\n• History log"]:::job
        end

        subgraph J3["💾 Auto-Backup"]
            J3_FREQ["Mỗi 8 giờ"]:::freq
            J3_DESC["backupDatabase()\n─────────\n• Copy crm.db → backup/\n• Filename: crm_YYYY-MM-DD.db\n• Giữ 7 ngày\n• Xóa backup cũ"]:::job
        end

        subgraph J4["📰 Daily News"]
            J4_FREQ["Mỗi 10 phút check"]:::freq
            J4_DESC["fetchDailyNews()\n─────────\n• Check giờ cấu hình\n• Gọi Perplexity API\n• Tổng hợp tin BĐS\n• Verdict + Market Heat\n• Lưu vào daily_news"]:::job
        end

        subgraph J5["📅 Auto-Schedule"]
            J5_FREQ["Mỗi phút check"]:::freq
            J5_DESC["processSchedules()\n─────────\n• Check lịch chia đã tạo\n• Đến giờ → chia lead\n• Round-robin sale\n• Telegram + Socket"]:::job
        end

        subgraph J6["🔌 Webhook Setup"]
            J6_FREQ["Khi khởi động"]:::freq
            J6_DESC["setupWebhooks()\n─────────\n• Register Bot CRM\n  webhook URL\n• https://crm-iqi.id.vn\n  /api/telegram-webhook/2"]:::job
        end
    end
```

---

## 13. Real-time & Socket.IO

```mermaid
sequenceDiagram
    participant Client as 🖥️ Frontend (React)
    participant Socket as 🔌 Socket.IO
    participant Server as ⚙️ Server
    participant DB as 🗄️ Database

    Note over Client,DB: Kết nối ban đầu
    Client->>Socket: connect()
    Socket->>Server: Client connected
    Server->>DB: readData() + filterDataForRole()
    DB-->>Server: leads + history + campaigns
    Server-->>Socket: emit('data-changed')
    Socket-->>Client: Nhận data → render UI

    Note over Client,DB: Admin chia lead
    Client->>Server: POST /api/assign-lead
    Server->>DB: UPDATE leads, INSERT history
    Server->>Socket: emit('data-changed') → ALL clients
    Socket-->>Client: Tất cả user thấy update real-time

    Note over Client,DB: Sync Google Sheet (mỗi 3 phút)
    Server->>Server: setInterval → syncAllProjects()
    Server->>DB: Replace leads + history
    Server->>DB: Post-sync status fix
    Server->>Socket: emit('data-changed')
    Socket-->>Client: UI tự động refresh

    Note over Client,DB: Sale feedback qua Telegram
    Server->>Server: Webhook callback từ Telegram
    Server->>DB: UPDATE status, INSERT history
    Server->>Socket: emit('data-changed')
    Socket-->>Client: Badge status đổi real-time

    Note over Client,DB: Thông báo mới
    Server->>DB: INSERT announcement
    Server->>Socket: emit('announcement-changed')
    Socket-->>Client: Marquee banner cập nhật
```

---

## 14. Frontend Pages & Components

```mermaid
flowchart TB
    classDef page fill:#E8F5E9,stroke:#2E7D32,color:#000
    classDef component fill:#E3F2FD,stroke:#1565C0,color:#000
    classDef admin_only fill:#FFCDD2,stroke:#C62828,color:#000
    classDef shared fill:#FFF9C4,stroke:#F57F17,color:#000

    subgraph APP["🏠 CRMApp — Main Shell"]
        NAV["Sidebar Navigation\n12 menu items\nCollapsible"]
        TOP["Top Bar\nSync indicator · Marquee\nChat toggle · User menu"]
    end

    subgraph PAGES["📄 12 Pages"]
        direction TB

        DASH["📊 Dashboard\n─────────\n• 4 Status cards\n• 4 Cost cards (CPL)\n• Donut chart\n• Sale ranking table\n• Project + Period filter"]:::page

        subgraph LEADS_GROUP["📋 Leads (Trang chính · ~2550 lines)"]
            LEADS["Danh sách Lead\n─────────\n• 21 Status tabs\n• Search / Filter / Sort\n• Project filter\n• Date range filter\n• Manager & Sale filter\n• Table (desktop) / Cards (mobile)\n• Pagination (configurable)"]:::page

            LEAD_DETAIL["Chi tiết Lead\n─────────\n• Info grid (2 columns)\n• Status dropdown + save\n• Sale/Manager assignment\n• Contact form\n• History per-sale (Admin)\n• History timeline\n• Messenger embed\n• Registration count"]:::page

            CHIA_PANEL["Chia Lead Panel\n(8-step wizard)\n─────────\n1. Project\n2. Status filter\n3. Need filter\n4. Date range\n5. Lead count\n6. Sale selection\n7. Schedule config\n8. Calendar preview"]:::admin_only

            SPECIAL_ACTIONS["Admin Actions\n─────────\n• Phân chia lại Manager\n• Khôi phục Sale (selective)\n• Đối chiếu form KH\n• Lead Quality Report\n• Backup / Restore"]:::admin_only
        end

        PROJECTS["🏗️ Projects\n─────────\n• Project cards\n• Sheet URL config\n• Cost Sheet URL\n• Sync button\n• CRUD"]:::page

        subgraph CAMPAIGNS_GROUP["📈 Campaigns (~3000 lines)"]
            C_MARKET["Market Intelligence\n─────────\n• CPL estimate\n• Competition density\n• Property prices\n• Opportunity score\n• Pages ranking"]:::admin_only
            C_CONTENT["Content Review AI\n─────────\n• 4-step wizard\n• 6 criteria scoring\n• 3 AI versions\n• Error analysis"]:::admin_only
            C_LEADS["CRM Lead Tree\n─────────\n• Project > Campaign\n  > Adset > Ad\n• Status dist per node"]:::page
            C_ADS["Facebook Ads\n─────────\n• Multi-account\n• 12 date presets\n• 9 metric cards\n• Project grouping\n• AI advisor per campaign"]:::page
        end

        SALES["👥 Sales\n─────────\n• Kanban board (drag)\n• Pipeline funnel\n• Conversion rates\n• Leaderboard\n• Response time metrics"]:::page

        USERS["👤 Users\n─────────\n• User CRUD\n• Auto-create from Sheet\n• Bulk create\n• Telegram Bots config\n• Project assignment"]:::admin_only

        PROFILE["🔑 Profile\n─────────\n• Avatar upload + crop\n• Contact info edit\n• Password change\n• Policy checklist"]:::shared

        MESSENGER["💬 Messenger\n─────────\n• FB Page selector\n• Conversation list\n• Chat bubbles\n• Reply + attachments\n• Auto-refresh 15s"]:::page

        subgraph POST_GROUP["📝 Post Management"]
            POSTS["Bài đăng\n─────────\n• Sheet Posts list\n• STOP/READY/POSTED\n• Filter & search\n• Detail modal"]:::page
            FB_PAGES["FB Pages\n─────────\n• Page CRUD\n• Token setup\n• Active toggle"]:::admin_only
            SHEET_CFG["Sheet Config\n─────────\n• Apps Script URL\n• 10-step guide\n• Test connection"]:::admin_only
            CALENDAR["Calendar\n─────────\n• Monthly view\n• Post schedule\n• Color-coded status"]:::page
        end

        NEWS["📰 Daily News\n─────────\n• Market Heat gauge\n• News + AI verdict\n• 2-3 day forecast\n• Action items\n• History archive"]:::page

        CAPI["📊 CAPI Settings\n─────────\n• Pixel ID + Token\n• Event mapping\n• Test connection\n• Event log"]:::admin_only

        GUIDE["📖 Hướng dẫn\n─────────\n• 11 sections accordion\n• SVG diagrams inline\n• Steps · Tips · Warnings\n• Status table · Roles"]:::shared
    end

    subgraph REUSABLE["🔧 Reusable Components"]
        direction LR
        RC1["Modal\n(Generic overlay)"]:::component
        RC2["Card\n(Stat card)"]:::component
        RC3["DonutChart\n(SVG animated)"]:::component
        RC4["ImageLightbox\n(Full-screen)"]:::component
        RC5["AvatarCropModal\n(Circular crop)"]:::component
        RC6["ChatSidebar\n(Internal chat)"]:::component
        RC7["ToastContainer\n(Notifications)"]:::component
        RC8["ConfirmModal\n(Yes/No dialog)"]:::component
    end

    APP --> PAGES
```

---

## 15. Backup, Restore & An toàn dữ liệu

```mermaid
flowchart TD
    classDef auto fill:#C8E6C9,stroke:#2E7D32,color:#000
    classDef manual fill:#BBDEFB,stroke:#1565C0,color:#000
    classDef restore fill:#FFE0B2,stroke:#E65100,color:#000
    classDef danger fill:#FFCDD2,stroke:#C62828,color:#000

    subgraph BACKUP_SYSTEM["💾 3-Layer Backup System"]
        direction TB

        subgraph L1["Layer 1: Auto-Backup"]
            AUTO_BK["Mỗi 8 giờ\n─────────\ncrm_YYYY-MM-DD-HH.db\nGiữ 7 ngày · Tự xóa cũ"]:::auto
            STARTUP_BK["Khi server khởi động\n─────────\ncrm_startup_YYYY-MM-DD.db\nSnapshot trước khi chạy"]:::auto
        end

        subgraph L2["Layer 2: Manual Backup"]
            ADMIN_BK["Admin bấm Backup\n─────────\nGET /api/backup\nDownload file .db về máy"]:::manual
        end

        subgraph L3["Layer 3: Sync Safety"]
            SYNC_BACKUP["Trước mỗi sync\n─────────\nBackup CRM history\ntheo phone (in-memory)\nKhôi phục sau replace"]:::auto
        end
    end

    subgraph RESTORE_SYSTEM["🔄 4 Phương thức Restore"]
        direction TB

        R1["Full Restore\n─────────\nUpload file .db\nThay thế toàn bộ DB\n⚠️ Mất data mới"]:::danger

        R2["Selective Sale Restore\n─────────\nChọn backup + project\n→ Chỉ restore sale_id,\n  sale_name, manager_name\n  từ backup vào lead hiện tại\n✅ Không mất data"]:::restore

        R3["Cleanup History\n─────────\nXóa history trùng lặp\nGiữ bản mới nhất\n(cleanup-history.js)"]:::manual

        R4["Data Migration\n─────────\nmigrate.js\nmigrate-turso-to-local.js\nChuyển đổi giữa DB"]:::manual
    end

    subgraph SAFETY["🛡️ An toàn dữ liệu"]
        S1["JWT Auth\n─────────\nMọi API cần token\n401 nếu hết hạn"]
        S2["Role-based Access\n─────────\nSale không thể\nchia/xáo/delete"]
        S3["Rate Limiting\n─────────\nexpress-rate-limit\nChống spam request"]
        S4["Password Policy\n─────────\n8+ chars · upper · lower\ndigit · special char"]
        S5["Phone-based Matching\n─────────\nSync không mất\nsale/manager/notes"]
    end
```

---

## 16. API Endpoints Map

### 🔐 Authentication
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| POST | `/login` | Đăng nhập, nhận JWT | Public |
| POST | `/change-password` | Đổi mật khẩu | All |
| POST | `/force-change-password` | Đổi mật khẩu bắt buộc | All |

### 📋 Leads
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/data` | Lấy tất cả data (leads, history, campaigns) | All |
| POST | `/api/update-status` | Cập nhật trạng thái lead | All |
| POST | `/api/update-sale` | Gán sale cho lead | Admin/Manager |
| POST | `/api/update-manager` | Gán manager cho lead | Admin |
| POST | `/api/update-notes` | Cập nhật ghi chú | All |
| POST | `/api/toggle-hot` | Đánh dấu hot lead | Admin |
| POST | `/api/shuffle-leads` | Xáo lead hàng loạt | Admin |
| POST | `/api/assign-leads` | Chia lead cho sales | Admin/Manager |
| POST | `/api/recall-lead` | Thu hồi lead (xóa history entry) | Admin |
| POST | `/api/cross-reference` | Đối chiếu form khách hàng | Admin |
| POST | `/api/reassign-managers` | Phân chia lại manager | Admin |
| POST | `/api/restore-sales` | Khôi phục sale từ backup | Admin |
| GET | `/api/lead-quality-report` | Báo cáo chất lượng lead | Admin |

### 🔄 Sync & Backup
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| POST | `/api/sync` | Trigger sync thủ công | Admin |
| GET | `/api/backup` | Download backup DB | Admin |
| POST | `/api/restore` | Upload & restore DB | Admin |
| GET | `/api/backup-files` | Danh sách backup có sẵn | Admin |

### 📅 Schedule
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/schedules` | Danh sách lịch chia | Admin |
| POST | `/api/schedules` | Tạo lịch chia mới | Admin |
| DELETE | `/api/schedules/:id` | Xóa lịch chia | Admin |

### 👥 Users
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/users` | Danh sách users | Admin |
| POST | `/api/users` | Tạo user mới | Admin |
| PUT | `/api/users/:id` | Cập nhật user | Admin |
| DELETE | `/api/users/:id` | Xóa user | Admin |
| POST | `/api/auto-create-users` | Auto-create từ Sheet | Admin |
| POST | `/api/bulk-create-users` | Bulk create users | Admin |
| PUT | `/api/profile` | Cập nhật profile cá nhân | All |

### 📱 Telegram
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/telegram-bots` | Danh sách bots | Admin |
| POST | `/api/telegram-bots` | Tạo bot mới | Admin |
| PUT | `/api/telegram-bots/:id` | Cập nhật bot | Admin |
| DELETE | `/api/telegram-bots/:id` | Xóa bot | Admin |
| POST | `/api/telegram-webhook/:botId` | Webhook handler | Public |
| POST | `/api/setup-telegram-webhook` | Đăng ký webhook | Admin |

### 📘 Facebook
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/fb-ads` | Lấy dữ liệu quảng cáo | All |
| GET | `/api/fb-ad-accounts` | Danh sách tài khoản QC | Admin |
| POST | `/api/fb-ad-accounts` | Thêm tài khoản QC | Admin |
| DELETE | `/api/fb-ad-accounts/:id` | Xóa tài khoản QC | Admin |
| GET | `/api/fb-messenger/conversations` | Danh sách hội thoại | All |
| GET | `/api/fb-messenger/messages/:convId` | Tin nhắn hội thoại | All |
| POST | `/api/fb-messenger/send` | Gửi tin nhắn | All |
| GET | `/api/fb-pages` | Danh sách Pages | Admin |
| POST | `/api/fb-pages` | Thêm Page | Admin |
| PUT | `/api/fb-pages/:id` | Cập nhật Page | Admin |
| DELETE | `/api/fb-pages/:id` | Xóa Page | Admin |
| POST | `/api/fb-publish` | Đăng bài lên FB | Admin |
| POST | `/api/capi-send` | Gửi CAPI event | Server |
| POST | `/api/capi-test` | Test CAPI connection | Admin |
| GET | `/api/capi-log` | Xem CAPI event log | Admin |

### 🤖 AI
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| POST | `/api/content-review` | Phân tích nội dung QC | Admin |
| POST | `/api/campaign-advisor/single` | Tư vấn campaign | Admin |
| POST | `/api/market-intel` | Market Intelligence | Admin |
| GET | `/api/daily-news` | Lấy tin BĐS hôm nay | All |
| GET | `/api/daily-news/history` | Lịch sử tin BĐS | All |
| POST | `/api/daily-news/fetch` | Fetch tin thủ công | Admin |

### 📝 Posts & Content
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/sheet-posts` | Danh sách bài đăng | All |
| POST | `/api/sheet-posts/toggle` | Đổi status bài đăng | Admin |
| GET | `/api/sheet-configs` | Cấu hình Sheet posts | Admin |
| POST | `/api/sheet-configs` | Thêm cấu hình | Admin |
| DELETE | `/api/sheet-configs/:id` | Xóa cấu hình | Admin |
| POST | `/api/sheet-configs/test` | Test kết nối Sheet | Admin |

### 💬 Chat & Announcements
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/chat/messages/:userId` | Lấy tin nhắn chat | All |
| POST | `/api/chat/send` | Gửi tin nhắn | All |
| POST | `/api/chat/read/:userId` | Đánh dấu đã đọc | All |
| GET | `/api/announcements` | Danh sách thông báo | All |
| POST | `/api/announcements` | Tạo thông báo | Admin |
| DELETE | `/api/announcements/:id` | Xóa thông báo | Admin |

### ⚙️ Settings
| Method | Path | Mô tả | Role |
|--------|------|-------|------|
| GET | `/api/settings` | Lấy cài đặt hệ thống | Admin |
| POST | `/api/settings` | Cập nhật cài đặt | Admin |
| POST | `/api/auto-rotate/toggle` | Bật/tắt auto-rotate | Admin |

---

## 📊 Tổng kết hệ thống

| Thành phần | Công nghệ | Chi tiết |
|------------|----------|---------|
| **Frontend** | React 19 + Vite 7 | 1 file App.jsx ~13,000 lines · 38 components · 12 pages |
| **Backend** | Express 5.1 + Node.js | 1 file index.js ~8,500 lines · 100+ endpoints |
| **Database** | SQLite | 20+ tables · ~500MB · Local file |
| **Real-time** | Socket.IO | 2 events: `data-changed`, `announcement-changed` |
| **Auth** | JWT + bcrypt | 3 roles · Password policy · Rate limiting |
| **Hosting** | VPS Ubuntu | Nginx SSL → Node.js port 4000 |
| **Domain** | crm-iqi.id.vn | Let's Encrypt SSL |
| **Sync** | Google Sheets API v4 | Mỗi 3 phút · 4-tier matching · Post-sync fix |
| **Bot** | Telegram Bot API | Bot CRM (id=2) · Webhook · Inline keyboard |
| **Ads** | Facebook Graph API v21 | Ads insights · Messenger · Pages · CAPI |
| **AI** | OpenAI + Perplexity | Content review · Campaign advisor · Market intel · Daily news |
| **Backup** | 3-layer system | Auto 8h · Startup · Manual · Selective restore |
| **Background** | 6 scheduled jobs | Sync 3m · Rotate 30m · Backup 8h · News 10m · Schedule 1m · Webhook startup |
