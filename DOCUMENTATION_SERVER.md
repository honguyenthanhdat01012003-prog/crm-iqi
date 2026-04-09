# CRM-IQI Server Complete Documentation

> **File**: `server/index.js` (~8700 lines)  
> **Framework**: Express 5.1.0 (Node.js)  
> **Database**: LibSQL/SQLite (`crm.db`) with Turso cloud option  
> **Build Version**: `2026-03-20-v1`  
> **Port**: 4000 (configurable via `PORT` env)

---

## Table of Contents

1. [API Endpoints](#1-api-endpoints)
2. [Background Jobs](#2-background-jobs)
3. [Socket.IO Events](#3-socketio-events)
4. [External Integrations](#4-external-integrations)
5. [Database Schemas](#5-database-schemas)
6. [Internal Functions](#6-internal-functions)
7. [Google Sheets Sync Flow](#7-google-sheets-sync-flow)
8. [Telegram Bot Flow](#8-telegram-bot-flow)
9. [Auto-Rotate Flow](#9-auto-rotate-flow)
10. [Lead Lifecycle](#10-lead-lifecycle)
11. [Facebook Integration](#11-facebook-integration)
12. [AI Integration](#12-ai-integration)
13. [Backup/Restore](#13-backuprestore)
14. [Chat System](#14-chat-system)
15. [Announcements](#15-announcements)
16. [Content/Post Management](#16-contentpost-management)
17. [Daily News](#17-daily-news)
18. [Lead Report & Analytics](#18-lead-report--analytics)

---

## 1. API Endpoints

### Authentication & Users

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/login` | None | Login with username/password, returns JWT (24h expiry) |
| `POST` | `/api/logout` | Auth | Logout (client-side token removal) |
| `GET` | `/api/me` | Auth | Get current user info |
| `GET` | `/api/users` | Admin | List all users (managers see only their sales) |
| `POST` | `/api/users` | Admin | Create user (admin/manager/sale role) |
| `PUT` | `/api/users/:id` | Admin | Update user |
| `DELETE` | `/api/users/:id` | AdminOnly | Delete user |
| `POST` | `/api/users/auto-create-sales` | Admin | Scan lead names → auto-create sale accounts |
| `POST` | `/api/users/bulk-create-sales` | Admin | Bulk create sale accounts from array |
| `GET` | `/api/profile` | Auth | Get own profile |
| `PUT` | `/api/profile` | Auth | Update own profile |
| `PUT` | `/api/change-password` | Auth | Change own password (complexity enforced) |
| `PUT` | `/api/users/:id/profile` | Admin | Update user profile by admin |

### Leads & Data

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/data` | Auth | Full data load (syncs first, applies schedules, role-filtered) |
| `GET` | `/api/data/poll` | Auth | Lightweight hash-based change detection |
| `PUT` | `/api/leads/:id` | Auth | Update lead (status, sale, notes, etc.) with CAPI + Telegram notify |
| `POST` | `/api/leads/:id/history` | Auth | Add manual history entry + CAPI hook |
| `DELETE` | `/api/leads/:id/history/:histId` | Auth | Delete history entry + Telegram recall |
| `POST` | `/api/leads/:id/manager` | Admin | Assign/change manager override for a lead |
| `POST` | `/api/leads/assign-bulk` | Admin | Bulk assign leads to sale + Telegram inline keyboard |
| `POST` | `/api/leads/shuffle` | Admin | Round-robin shuffle unassigned leads |

### Scheduled Distribution

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/leads/schedule-distribution` | Admin | Create time-based distribution schedule |
| `GET` | `/api/leads/schedules` | Admin | List all schedules |
| `PATCH` | `/api/leads/schedules/:id` | Admin | Update schedule config |
| `DELETE` | `/api/leads/schedules/:id` | Admin | Cancel/delete schedule |
| `POST` | `/api/leads/schedules/:id/revoke` | Admin | Revoke all leads distributed by schedule |
| `POST` | `/api/leads/schedules/:id/restore` | Admin | Restore revoked leads |
| `GET` | `/api/leads/schedules/:id/detail` | Admin | Get schedule detail |
| `POST` | `/api/leads/restore-by-project` | Admin | Restore leads by project |
| `GET` | `/api/leads/restore-preview/:projectId` | Admin | Preview restorable leads |

### Projects

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/projects` | Admin | List all projects |
| `POST` | `/api/projects` | Admin | Create project |
| `PUT` | `/api/projects/:id` | Admin | Update project config |
| `DELETE` | `/api/projects/:id` | AdminOnly | Delete project + leads |
| `POST` | `/api/projects/:id/sync` | Admin | Manual sync from Google Sheets |
| `POST` | `/api/projects/import-legacy` | Admin | Import legacy project (is_legacy=1) |
| `POST` | `/api/sync` | Admin | Sync all projects |

### Auto-Rotate

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/auto-rotate` | Admin | Get per-project auto-rotate status |
| `POST` | `/api/auto-rotate/toggle` | Admin | Toggle auto-rotate for a project |
| `GET` | `/api/auto-rotate/history` | Admin | View rotation history |

### Telegram Bots

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/telegram-bots` | Admin | List all bots |
| `POST` | `/api/telegram-bots` | Admin | Add bot |
| `PUT` | `/api/telegram-bots/:id` | Admin | Update bot |
| `DELETE` | `/api/telegram-bots/:id` | Admin | Delete bot |
| `POST` | `/api/telegram-bots/auto-assign` | Admin | Auto-assign bots to projects |
| `GET` | `/api/telegram-bots/:id/chat-users` | Admin | Fetch chat users from Telegram API |
| `POST` | `/api/telegram-webhook/setup` | Admin | Register webhooks for all active bots |
| `POST` | `/api/telegram-webhook/:botId` | None* | Incoming webhook handler (secret verified) |
| `POST` | `/api/telegram-webhook` | None* | Generic webhook handler |
| `GET` | `/api/telegram-webhook/status` | Admin | Check webhook status for all bots |

### Google Sheets Integration

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/sheet/configs` | Admin | List sheet configs |
| `POST` | `/api/sheet/configs` | Admin | Add sheet config |
| `DELETE` | `/api/sheet/configs/:id` | Admin | Delete sheet config |
| `GET` | `/api/sheet/test/:id` | Admin | Test sheet accessibility |
| `GET` | `/api/sheet/posts` | Admin | Fetch posts from Google Sheets |
| `POST` | `/api/sheet/posts/status` | Admin | Update post status in sheet |

### Facebook Pages & Posts

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/fb-pages` | Admin | List Facebook pages |
| `POST` | `/api/fb-pages` | Admin | Add Facebook page |
| `PUT` | `/api/fb-pages/:id` | Admin | Update page config |
| `DELETE` | `/api/fb-pages/:id` | Admin | Delete page |
| `GET` | `/api/fb-posts` | Admin | List posts |
| `POST` | `/api/fb-posts` | Admin | Create post |
| `PUT` | `/api/fb-posts/:id` | Admin | Update post |
| `DELETE` | `/api/fb-posts/:id` | Admin | Delete post |
| `POST` | `/api/fb-posts/:id/publish` | Admin | Publish to Facebook (multi-page, multi-photo) |

### Facebook Messenger

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/fb-messenger/conversations` | Auth | List page conversations |
| `GET` | `/api/fb-messenger/messages` | Auth | Get conversation messages |
| `POST` | `/api/fb-messenger/reply` | Auth | Send reply via Messenger |
| `GET` | `/api/fb-messenger/participant` | Auth | Get participant details |
| `GET` | `/api/fb-messenger/lead-conversations` | Auth | Get conversations for a specific lead |

### Facebook Ads

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/fb-ad-accounts` | Admin | List ad accounts |
| `POST` | `/api/fb-ad-accounts` | Admin | Add ad account |
| `PUT` | `/api/fb-ad-accounts/:id` | Admin | Update account |
| `DELETE` | `/api/fb-ad-accounts/:id` | Admin | Delete account |
| `GET` | `/api/fb-ads/insights/:accountId` | Auth | Get campaign insights |
| `GET` | `/api/fb-ads/campaigns/:accountId` | Auth | List campaigns |
| `GET` | `/api/fb-ads/adsets/:accountId` | Auth | List ad sets |
| `GET` | `/api/fb-ads/ad-preview` | Auth | Preview an ad creative |
| `GET` | `/api/fb-ads/campaign-detail/:accountId/:campaignId` | Auth | Campaign detail with breakdowns |

### Facebook CAPI (Conversions API)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/capi-settings` | Admin | Get CAPI pixel/token config |
| `POST` | `/api/capi-settings` | Admin | Save CAPI settings |
| `POST` | `/api/capi-test` | Admin | Send test CAPI event |
| `GET` | `/api/capi-log` | Admin | View CAPI event log |

### Market Intelligence

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/market-intel/projects` | Auth | List cached market intel projects |
| `GET` | `/api/market-intel/test-ads-api` | Auth | Test Facebook Ads Library API access |
| `GET` | `/api/market-intel/analyze` | Auth | Full market analysis for a project (scrapes Ads Library + batdongsan + Chợ Tốt + AI verification) |
| `DELETE` | `/api/market-intel/cache/:id` | Admin | Clear cached intel |

### Analytics & Reports

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/sales/analytics` | Admin | Per-agent performance stats |
| `GET` | `/api/lead-report` | Admin | Lead quality report with date filtering |

### AI Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/content-review` | Auth | AI editorial review of ad copy (OpenAI gpt-4.1-nano) |
| `GET` | `/api/marketing-guidelines` | Auth | Get marketing guidelines knowledge base |
| `POST` | `/api/marketing-guidelines/seed` | Admin | Seed default marketing rules |
| `POST` | `/api/campaign-advisor` | Auth | AI campaign advisor (Perplexity sonar-pro) |
| `POST` | `/api/campaign-advisor/single` | Auth | Analyze single campaign |

### Daily News

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/daily-news` | Auth | List news (paginated) |
| `GET` | `/api/daily-news/latest` | Auth | Get latest entry |
| `POST` | `/api/daily-news/fetch` | AdminOnly | Manually trigger news fetch |
| `GET` | `/api/daily-news/settings` | Admin | Get Perplexity/OpenAI key settings |
| `POST` | `/api/daily-news/settings` | AdminOnly | Save API keys & auto-fetch time |
| `DELETE` | `/api/daily-news/:id` | AdminOnly | Delete news entry |

### Announcements

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/announcements` | Auth | List active announcements |
| `GET` | `/api/announcements/all` | Admin | List all (including expired) |
| `POST` | `/api/announcements` | Admin | Create announcement (emits socket event) |
| `PUT` | `/api/announcements/:id` | Admin | Update announcement |
| `DELETE` | `/api/announcements/:id` | Admin | Delete announcement |

### Chat

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/chat/users` | Auth | List chat users |
| `GET` | `/api/chat/messages/:userId` | Auth | Get messages with a user |
| `POST` | `/api/chat/send` | Auth | Send chat message |
| `GET` | `/api/chat/new/:userId` | Auth | Check for new messages |

### Backup & Recovery

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/backup-now` | Admin | Trigger manual backup |
| `GET` | `/api/backups` | Admin | List available backups |
| `POST` | `/api/restore-backup` | AdminOnly | Restore from backup file |
| `POST` | `/api/recover-sales` | Admin | Recover sale assignments |
| `POST` | `/api/recover-from-backup` | Admin | Recover from latest backup |
| `POST` | `/api/recover-sale-from-dbbackup` | Admin | Recover sale from DB backup |
| `POST` | `/api/recover-selective` | Admin | Selective field recovery |

### System

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/version` | None | Returns BUILD_VERSION |
| `GET` | `/api/health` | None | Health check |
| `GET` | `/api/config` | Admin | Get system config |
| `POST` | `/api/heartbeat` | Auth | Client heartbeat |
| `GET` | `/api/debug/managers` | Admin | Debug manager assignments |
| `GET` | `/api/debug/project-managers/:projectId` | Admin | Debug project managers |
| `POST` | `/api/admin/redistribute-managers/:projectId` | Admin | Redistribute managers |

---

## 2. Background Jobs

All background jobs run via `setInterval` inside the non-Vercel startup block:

| Job | Interval | Description |
|-----|----------|-------------|
| **Auto-sync Google Sheets** | 3 min (configurable via `SYNC_INTERVAL_MS`) | Calls `syncAllProjects()` — fetches CSV from published Google Sheets, parses leads, upserts into DB with 4-tier matching |
| **Auto-backup** | 8 hours | Calls `performBackup("auto")` — copies `crm.db` to `server/data/backups/`, keeps last 7 days. Also runs once on startup with `performBackup("startup")` |
| **Auto-rotate** | 30 min | Calls `processAutoRotate()` — checks leads inactive >3 days, re-assigns via round-robin to other sales (skips locked statuses: booked, booking_other) |
| **Daily news fetch** | 10 min check | Checks against configured time (default 07:00) — calls `fetchDailyRealEstateNews()` once per day using Perplexity sonar-pro |
| **Telegram webhook auto-setup** | Once, 3s after startup | Registers webhooks for all active Telegram bots with the configured `TELEGRAM_WEBHOOK_SECRET` |

---

## 3. Socket.IO Events

Socket.IO server is initialized on the HTTP server with CORS from `ALLOWED_ORIGINS`.

| Event | Direction | Trigger | Description |
|-------|-----------|---------|-------------|
| `data-changed` | Server → All | `emitDataChanged()` | Emitted after any lead/project data mutation (updates, syncs, assignments, schedule distributions, auto-rotate, etc.) |
| `announcement-changed` | Server → All | Announcement CRUD | Emitted after create/update/delete of announcements |
| `connection` | Client → Server | Auto | Logs client connection |
| `disconnect` | Client → Server | Auto | Logs client disconnection |

The `emitDataChanged()` helper is called throughout the codebase after data-modifying operations to push real-time updates to all connected clients.

---

## 4. External Integrations

### 4.1 Google Sheets (CSV Publish)
- **Purpose**: Primary data source for leads
- **Mechanism**: Projects have a `sheet_url` pointing to a published Google Sheets CSV URL (format: `https://docs.google.com/spreadsheets/d/{ID}/pub?...&output=csv`)
- **SSRF Protection**: `fetchCsvText()` only allows `docs.google.com` and `*.googleusercontent.com` domains
- **Flow**: Sheet → CSV fetch → parse → mapLeads → replaceProjectData (4-tier matching)

### 4.2 Telegram Bot API
- **Purpose**: Real-time notifications to sales agents + inline status updates
- **Webhook**: Registered with `secret_token` for verification
- **Features**: Send lead assignments with inline keyboard (status buttons), receive status updates via callback_query, receive text feedback messages
- **Auto-setup**: Webhooks auto-registered 3s after server start

### 4.3 Facebook Graph API (v22.0 / v25.0)
- **Pages**: CRUD + publishing posts (text + multi-photo upload)
- **Messenger**: Read conversations, get messages, send replies, identify participants
- **Ads**: Campaign insights, ad set listing, ad preview, campaign detail with breakdowns
- **CAPI (Conversions API)**: Fire events on lead status changes (Purchase, InitiateCheckout, Schedule, Lead)
- **Ads Library**: Scrape competitor ad data for market intelligence (headless Chromium + API + HTTP fallback)

### 4.4 OpenAI API (gpt-4.1-nano)
- **Purpose**: Content review — editorial analysis of Vietnamese real estate ad copy
- **Output**: 3 rewritten versions per review (gắt/kể chuyện/trực diện style), scoring, editing suggestions

### 4.5 Perplexity AI (sonar / sonar-pro)
- **Campaign Advisor**: Analyzes campaigns with real-time market data
- **Daily News**: Fetches and analyzes top 5-7 BĐS news items daily
- **Market Intel AI Verification**: Verifies project type, location, product types via internet search

### 4.6 batdongsan.com.vn & Chợ Tốt
- **Purpose**: Web scraping for market price estimation
- **Data**: High-rise/low-rise prices per m², listing counts, official prices
- **Used by**: Market Intelligence module

---

## 5. Database Schemas

**DB_VERSION = 14** with progressive ALTER TABLE migrations.

### Core Tables

#### `settings`
```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
)
```
Stores: JWT_SECRET, perplexity_api_key, openai_api_key, news_auto_fetch_time, capi_pixel_id, capi_token, etc.

#### `campaigns`
```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
)
```

#### `leads`
```sql
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, phone TEXT, email TEXT,
  source TEXT, status TEXT DEFAULT 'new',
  sale TEXT, campaign_id INTEGER,
  project_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  contact_date TEXT, ads_id TEXT, ads_name TEXT,
  note TEXT, form_name TEXT, form_id TEXT,
  sale_history TEXT DEFAULT '[]',
  scheduled_by INTEGER, schedule_id INTEGER,
  is_hot INTEGER DEFAULT 0,
  channel TEXT DEFAULT '',
  registered_count INTEGER DEFAULT 0,
  manager TEXT DEFAULT '',
  cost_per_lead REAL DEFAULT 0,
  is_legacy INTEGER DEFAULT 0,
  fb_psid TEXT DEFAULT '',
  source_raw TEXT DEFAULT ''
)
```

#### `projects`
```sql
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, sheet_url TEXT, status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  last_synced TEXT,
  managers TEXT DEFAULT '[]',
  cost_sheet_url TEXT DEFAULT '',
  manager_overrides TEXT DEFAULT '{}',
  is_legacy INTEGER DEFAULT 0,
  auto_rotate_enabled INTEGER DEFAULT 0
)
```

#### `lead_history`
```sql
CREATE TABLE IF NOT EXISTS lead_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER, status TEXT, note TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  source TEXT DEFAULT 'crm'
)
```

#### `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE, password TEXT,
  role TEXT DEFAULT 'sale',
  display_name TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  telegram_chat_id TEXT DEFAULT '',
  manager_id INTEGER DEFAULT NULL,
  is_active INTEGER DEFAULT 1
)
```

#### `lead_status_log`
```sql
CREATE TABLE IF NOT EXISTS lead_status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER, old_status TEXT, new_status TEXT,
  changed_by TEXT,
  changed_at TEXT DEFAULT (datetime('now'))
)
```

### Telegram Tables

#### `telegram_bots`
```sql
CREATE TABLE IF NOT EXISTS telegram_bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, token TEXT, chat_id TEXT,
  project_ids TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)
```

#### `telegram_pending`
```sql
CREATE TABLE IF NOT EXISTS telegram_pending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER, bot_id INTEGER,
  chat_id TEXT, message_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)
```

#### `telegram_chat_users`
```sql
CREATE TABLE IF NOT EXISTS telegram_chat_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id INTEGER, chat_id TEXT,
  first_name TEXT, last_name TEXT, username TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(bot_id, chat_id)
)
```

### Communication Tables

#### `chat_messages`
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user INTEGER, to_user INTEGER,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  read INTEGER DEFAULT 0
)
```

#### `announcements`
```sql
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, content TEXT, type TEXT DEFAULT 'info',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT, is_active INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0
)
```

### Facebook Tables

#### `fb_pages`
```sql
CREATE TABLE IF NOT EXISTS fb_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT, page_name TEXT,
  access_token TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)
```

#### `fb_posts`
```sql
CREATE TABLE IF NOT EXISTS fb_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, content TEXT,
  image_urls TEXT DEFAULT '[]',
  target_pages TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  published_ids TEXT DEFAULT '{}',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  scheduled_at TEXT, published_at TEXT
)
```

#### `fb_ad_accounts`
```sql
CREATE TABLE IF NOT EXISTS fb_ad_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT, account_name TEXT,
  access_token TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)
```

### Analytics & Integration Tables

#### `sheet_configs`
```sql
CREATE TABLE IF NOT EXISTS sheet_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, sheet_url TEXT, sheet_type TEXT DEFAULT 'posts',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)
```

#### `capi_log`
```sql
CREATE TABLE IF NOT EXISTS capi_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER, event_name TEXT,
  pixel_id TEXT, status TEXT, response TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)
```

#### `lead_schedules`
```sql
CREATE TABLE IF NOT EXISTS lead_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER, sales TEXT DEFAULT '[]',
  leads_per_sale INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  executed_at TEXT,
  result TEXT DEFAULT '{}',
  time_slots TEXT DEFAULT '[]',
  tour_index INTEGER DEFAULT 0,
  last_assigned TEXT DEFAULT '{}'
)
```

#### `market_intel_cache`
```sql
CREATE TABLE IF NOT EXISTS market_intel_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT, location TEXT,
  heat_index INTEGER, opportunity_score INTEGER,
  estimated_cpl_avg INTEGER, competitor_count INTEGER,
  avg_price_m2 REAL, segment TEXT,
  raw_data TEXT, scraped_at TEXT DEFAULT (datetime('now'))
)
```

#### `daily_news`
```sql
CREATE TABLE IF NOT EXISTS daily_news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, news_summary TEXT, market_trend TEXT,
  marketing_lesson TEXT, vocabulary TEXT,
  source_links TEXT, raw_response TEXT,
  spotlight TEXT, market_indicators TEXT,
  expert_quotes TEXT, market_sentiment INTEGER DEFAULT 50,
  market_cycle TEXT, sales_script TEXT,
  big_picture TEXT, editorial_comment TEXT,
  action_items TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)
```

#### `marketing_guidelines`
```sql
CREATE TABLE IF NOT EXISTS marketing_guidelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT, title TEXT, content TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)
```

---

## 6. Internal Functions

### Authentication & Security
| Function | Lines | Description |
|----------|-------|-------------|
| `hashPassword(pw)` | ~20 | scryptSync with random 16-byte salt, returns `salt:hash` |
| `verifyPassword(pw, stored)` | ~25 | Verify password with timingSafeEqual |
| `requireAuth(req, res, next)` | ~1950 | JWT middleware — verifies token, attaches `req.user` |
| `requireAdmin(req, res, next)` | ~1970 | Requires admin or manager role |
| `requireAdminOnly(req, res, next)` | ~1975 | Requires admin role only |

### Database Helpers
| Function | Lines | Description |
|----------|-------|-------------|
| `run(db, sql, params)` | ~55 | Execute SQL statement |
| `all(db, sql, params)` | ~60 | Query multiple rows |
| `get(db, sql, params)` | ~65 | Query single row |
| `initDb()` | ~80 | Initialize DB — creates all tables, runs migrations up to DB_VERSION=14 |
| `upsertSetting(key, val)` | ~350 | Insert or update in settings table |
| `getConfig()` | ~355 | Read all settings as key-value object |

### Data Fetching & Parsing
| Function | Lines | Description |
|----------|-------|-------------|
| `fetchCsvText(url)` | ~365 | Fetch CSV from Google Sheets with SSRF protection (only Google domains) |
| `extractProjectName(url)` | ~385 | Extract sheet name from URL parameters |
| `parseCSV(text)` | ~395 | Parse CSV text into array of arrays |
| `findVal(row, headers, keys)` | ~410 | Find value in CSV row by multiple possible header names |
| `foldText(s)` | ~30 | Normalize Vietnamese text (remove diacritics, lowercase) |
| `normalizePhoneKey(p)` | ~35 | Normalize phone number (last 9 digits) |

### Lead Processing
| Function | Lines | Description |
|----------|-------|-------------|
| `normalizeStatus(raw)` | ~530 | Fuzzy status matching against 21 VALID_STATUS_KEYS with Vietnamese aliases |
| `extractSaleBlocks(headers, row)` | ~570 | Parse "Tên Sale / Feedback / Khách" column pattern from Google Sheets |
| `pickSaleInfo(blocks)` | ~620 | Pick most recent/active sale from blocks |
| `extractSaleHistory(blocks)` | ~640 | Build sale history array from blocks |
| `parseLeadDate(raw)` | ~670 | Parse dd/mm/yyyy, hh:mm:ss dd/mm/yyyy, ISO formats |
| `calcIsHot(contactDate, sale)` | ~700 | Lead is "hot" if ≤7 days old and unassigned |
| `guessChannel(row, headers)` | ~710 | Detect marketing channel (Facebook, Zalo, etc.) |
| `guessSource(row, headers)` | ~720 | Detect lead source from form/ads data |
| `detectColumnIndices(headers)` | ~740 | Fallback column detection by index patterns |
| `mapLeads(rows, headers, projectId)` | ~770 | Map CSV rows to lead objects (standard + fallback column detection) |
| `parseCostSheet(text)` | ~830 | Parse cost CSV for CPL calculation |
| `sanitizeSheetUrl(url)` | ~870 | Sanitize Google Sheet URL |

### Core Sync Engine
| Function | Lines | Description |
|----------|-------|-------------|
| `replaceProjectData(db, projectId, leads, costRows)` | ~880 | **THE CORE SYNC FUNCTION** — backup before sync, 4-tier lead matching (ads_id → phone+name → phone → name), CRM history preservation (max 20 per phone), clean slate delete + reinsert, sheet history dedup, post-sync status fix using contact_date ordering with "Chia lead" boundary detection |
| `readData(db)` | ~1500 | Full data loader with history map, date-sorted history, phone registration map |
| `syncProject(db, project)` | ~1600 | Sync single project — fetch CSV, parse, mapLeads, safety check (0 leads = skip), manager round-robin, Telegram notifications |
| `syncAllProjects(db)` | ~1700 | Parallel sync all active projects |

### Data Filtering (Role-based)
| Function | Lines | Description |
|----------|-------|-------------|
| `emitDataChanged()` | ~1750 | Emit Socket.IO `data-changed` event |
| `matchSaleName(leadSale, username, displayName)` | ~1760 | Fuzzy match sale name to user |
| `filterLeadsForSale(leads, user)` | ~1770 | Filter leads visible to a sale user |
| `filterLeadsForManager(leads, userId, projects)` | ~1780 | Filter leads visible to a manager |
| `filterDataForRole(data, user)` | ~1800 | Apply role-based filtering to full dataset |

### Auto-Rotate & Scheduling
| Function | Lines | Description |
|----------|-------|-------------|
| `processAutoRotate(db)` | ~4050 | Check inactive leads >3 days, re-assign via round-robin (skip LOCKED_STATUSES: booked, booking_other) |
| `processSchedules(db)` | ~4200 | Multi-slot time-based distribution — tour cycling, per-sale quota, skip locked leads, Telegram notify |
| `formatSchedule(s)` | ~4400 | Format schedule for display |

### Telegram
| Function | Lines | Description |
|----------|-------|-------------|
| `getBotForProject(projectId)` | ~4800 | Find active bot assigned to project |
| `handleTelegramWebhook(body, botRow)` | ~4830 | Process incoming webhook — callback_query (status buttons `st:{leadId}:{statusKey}`), text messages (feedback with phone fallback) |

### Facebook CAPI
| Function | Lines | Description |
|----------|-------|-------------|
| `hashSHA256(val)` | ~6400 | SHA-256 hash for CAPI user data |
| `sendCapiEvent(lead, eventName)` | ~6410 | Fire Conversions API event. CAPI_EVENT_MAP: closed→Purchase, booked→InitiateCheckout, appointment→Schedule, interested→Lead |

### Market Intelligence
| Function | Lines | Description |
|----------|-------|-------------|
| `buildSearchTerms(projectName)` | ~6520 | Generate search term variations for Ads Library |
| `extractAdCount(text)` | ~6530 | Parse ad count from Ads Library page text |
| `extractPagesFromHtml(html)` | ~6540 | Extract page IDs from Ads Library HTML |
| `scrapeAdLibrary(projectName, adAccounts)` | ~6560 | **MASSIVE** (~1200 lines) — Multi-strategy Ads Library scraping: (1) Bulk Facebook Ads Archive API, (2) Headless Chromium with full page scrolling, (3) HTTP fetch fallback. Extracts: ad count, competitor pages, page names, ad durations. Uses 4-step page resolution: API → HTTP → Browser → Direct FB visit |
| `scrapeMarketPrice(projectName, location)` | ~7700 | Scrape batdongsan.com.vn + Chợ Tốt for price data. Detects high-rise/low-rise prices, official prices, project phase/status/type |
| `estimateCpl(adCount, pricePerM2, location)` | ~8050 | CPL calculation: `Base_CPL × Segment_Factor × Location_Factor × Competition_Multiplier` |
| `calcMarketMetrics(adCount, avgLongevity, pricePerM2, cplAvg, districtAvgCpl)` | ~8100 | Heat index + opportunity score calculation |
| `generateTrend30d(baseValue, volatility, trend)` | ~8170 | Generate 30-day trend data for charts |
| `compareWithRegion(currentCpl, location)` | ~8190 | Benchmark CPL vs region average |
| `compareWithCenter(currentCpl)` | ~8200 | Benchmark CPL vs HCM center (Q1-Q3: 500K-800K) |
| `getDistrictAvgCpl(location)` | ~8210 | Lookup table for district average CPL (15+ districts) |
| `buildWinningPages(pagesInfo)` | ~8250 | Sort and format competitor page data |
| `callPerplexityAI(prompt, maxTokens)` | ~7580 | Generic Perplexity API call helper |
| `aiVerifyProject(projectName, priceData, adData, cplResult, districtAvgCpl)` | ~7600 | AI verification of project type/location/products |

### Daily News
| Function | Lines | Description |
|----------|-------|-------------|
| `fetchDailyRealEstateNews()` | ~8400 | Fetch daily BĐS briefing via Perplexity sonar-pro with elaborate Vietnamese prompt for 5-7 news items, verdicts ("thơm"/"độc"), data citations, tomorrow forecast, action items |

---

## 7. Google Sheets Sync Flow

### Overview
The system syncs leads from published Google Sheets CSV URLs into the local database every 3 minutes.

### Flow Diagram

```
Google Sheet (published as CSV)
       │
       ▼
fetchCsvText(url) ─── SSRF check (only Google domains)
       │
       ▼
parseCSV(text) → 2D array
       │
       ▼
mapLeads(rows, headers, projectId)
  ├── Standard column detection (by header names)
  ├── Fallback column detection (by index patterns)
  ├── extractSaleBlocks() → sale assignment from sheet columns
  ├── normalizeStatus() → fuzzy Vietnamese status matching
  ├── parseLeadDate() → multi-format date parsing
  └── calcIsHot() → 7-day + unassigned = hot
       │
       ▼
replaceProjectData(db, projectId, leads, costRows)
  ├── 1. Backup existing leads
  ├── 2. 4-tier matching (ads_id → phone+name → phone → name)
  ├── 3. CRM history preservation (max 20 per phone)
  ├── 4. Clean slate: DELETE all project leads → INSERT new
  ├── 5. Sheet history dedup
  └── 6. Post-sync status fix (contact_date ordering, "Chia lead" boundary)
       │
       ▼
syncProject() additions:
  ├── Manager round-robin assignment
  ├── manager_overrides application
  └── New lead Telegram notification to managers
       │
       ▼
emitDataChanged() → Socket.IO push to all clients
```

### Key Behaviors
- **Safety check**: If CSV returns 0 leads, sync is **skipped** (prevents accidental data wipe)
- **4-tier matching** ensures leads are correctly identified across syncs even when data changes
- **History preservation**: CRM-created history entries survive sheet re-syncs
- **Post-sync status fix**: Automatically adjusts status based on chronological contact_date ordering — detects "Chia lead" boundaries where distribution ownership changes

---

## 8. Telegram Bot Flow

### Architecture
- Bots are registered with a `secret_token` (TELEGRAM_WEBHOOK_SECRET) for webhook verification
- Each bot can be assigned to multiple projects
- Webhooks auto-register on server startup (3s delay)

### Notification Flow (Server → Telegram)

```
Lead Assignment (assign-bulk / schedule / sync)
       │
       ▼
getBotForProject(projectId) → find active bot
       │
       ▼
Send message via Telegram Bot API:
  ├── Text: Lead info (name, phone, project, status)
  └── Inline keyboard: Status buttons
       [Đã liên hệ] [Không nghe máy] [Tiềm năng]
       [Đặt lịch hẹn] [Không nhu cầu] [Booked]
       │
       ▼
Save to telegram_pending (lead_id, bot_id, chat_id, message_id)
```

### Webhook Handler (Telegram → Server)

```
POST /api/telegram-webhook/:botId
       │
       ├── Verify secret_token from X-Telegram-Bot-Api-Secret-Token header
       │
       ├── Auto-save chat user to telegram_chat_users
       │
       ├── callback_query (button press):
       │     Parse "st:{leadId}:{statusKey}"
       │     → Update lead status in DB
       │     → Log to lead_status_log
       │     → Fire CAPI event
       │     → Edit Telegram message to show "✅ Done"
       │     → emitDataChanged()
       │
       └── text message (feedback):
             Match to telegram_pending by chat_id
             → If lead found: add to lead_history as feedback
             → If lead stale: fallback search by phone number
             → Reply with confirmation
```

### Telegram Message Recall
When a history entry is deleted (`DELETE /api/leads/:id/history/:histId`), if the entry came from Telegram:
- The original Telegram message is edited to show "🗑 Đã thu hồi" (Recalled)
- The sale assignment on the lead may be reverted if it was the assigning action

---

## 9. Auto-Rotate Flow

### Purpose
Automatically re-distribute inactive leads to other sales agents to ensure timely follow-up.

### Configuration
- Per-project toggle via `auto_rotate_enabled` column in `projects` table
- Inactivity threshold: **3 days** (72 hours)
- Check interval: **30 minutes**
- Locked statuses (never rotated): `booked`, `booking_other`

### Flow

```
setInterval (every 30 min)
       │
       ▼
processAutoRotate(db)
       │
       ▼
For each project where auto_rotate_enabled = 1:
  │
  ├── Find leads with sale assigned AND last activity > 3 days ago
  │   AND status NOT IN (booked, booking_other)
  │
  ├── Get list of active sales in project
  │
  ├── Round-robin assign to OTHER sales (skip current sale)
  │
  ├── Log rotation in lead_history: "Auto-rotate: {oldSale} → {newSale}"
  │
  └── emitDataChanged()
```

### Endpoints
- `GET /api/auto-rotate` — View per-project rotation status
- `POST /api/auto-rotate/toggle` — Enable/disable for a specific project
- `GET /api/auto-rotate/history` — View rotation history log

---

## 10. Lead Lifecycle

### Status System
21 valid statuses with Vietnamese labels:

| Key | Vietnamese Label |
|-----|-----------------|
| `new` | Mới |
| `contacted` | Đã liên hệ |
| `no_answer` | Không nghe máy |
| `callback` | Hẹn gọi lại |
| `interested` | Tiềm năng |
| `appointment` | Đặt lịch hẹn |
| `met` | Đã gặp khách |
| `negotiating` | Đang thương lượng |
| `deposit` | Đã đặt cọc |
| `booked` | Booked |
| `booking_other` | Đã mua ở nơi khác |
| `closed` | Đã chốt |
| `not_interested` | Không nhu cầu |
| `wrong_number` | Sai số |
| `duplicate` | Trùng |
| `low_quality` | Chất lượng thấp |
| `spam` | Spam / Quảng cáo |
| `following` | Đang theo dõi |
| `nurturing` | Chăm sóc dài hạn |
| `revisit` | Tái liên hệ |
| `other` | Khác |

### Lead Journey

```
Google Sheet Import ──→ [new] ──→ Manager assigns ──→ [sale assigned]
       │                                                    │
       ▼                                                    ▼
Auto-schedule distribution                      Sale contacts lead
(processSchedules)                                    │
       │                                              ▼
       ▼                              Status progression:
Telegram notification                 contacted → interested → appointment
to assigned sale                      → met → negotiating → deposit → booked → closed
       │                                              │
       ▼                                              ▼
Sale updates via:                     CAPI events fired:
├── CRM web UI                        ├── interested → "Lead"
├── Telegram button                   ├── appointment → "Schedule"
└── Telegram text feedback            ├── booked → "InitiateCheckout"
                                      └── closed → "Purchase"
```

### Key Lifecycle Events
1. **Import**: Lead arrives from Google Sheets sync
2. **Assignment**: Admin/manager assigns to sale (bulk, shuffle, schedule, or manual)
3. **Contact**: Sale marks as contacted/no_answer/callback
4. **Qualification**: interested/not_interested/low_quality/spam
5. **Progression**: appointment → met → negotiating → deposit → booked → closed
6. **Auto-Rotate**: Inactive >3 days → reassigned to another sale
7. **Re-registration**: Same phone detected again → `registered_count` incremented

### History Tracking
- Every status change logged to `lead_history` + `lead_status_log`
- Sources: `crm`, `sheet`, `telegram`, `auto-rotate`, `schedule`
- Sale history maintained in `sale_history` JSON field (array of past assignments)

---

## 11. Facebook Integration

### 11.1 Pages Management
- CRUD for Facebook Pages (page_id, page_name, access_token)
- Used for publishing posts and Messenger integration

### 11.2 Post Publishing
Multi-page, multi-photo publishing flow:
```
1. Create post in CRM (draft)
2. Select target pages
3. Publish → For each page:
   ├── Upload photos via /me/photos (published=false)
   ├── Create post with attached_media array
   └── Save published_ids (page_id → post_id mapping)
4. Status → "published" with timestamp
```

### 11.3 Messenger Integration
- View conversations from connected pages
- Read message history
- Reply to messages via Graph API
- Identify participants and link to CRM leads
- `GET /api/fb-messenger/lead-conversations` — find conversations for a specific lead by phone/name

### 11.4 Ads Insights
Proxy layer for Facebook Ads API:
- Campaign listing + insights with date_preset/time_range
- Ad set breakdown
- Ad creative preview
- Campaign detail with action breakdowns (cost_per_lead, spend, impressions, etc.)

### 11.5 Conversions API (CAPI)
Server-side event tracking to Facebook:

| Lead Status | CAPI Event | 
|-------------|------------|
| `closed` | `Purchase` |
| `booked` | `InitiateCheckout` |
| `appointment` | `Schedule` |
| `interested` | `Lead` |

Events include: hashed email/phone, external_id, action_source=website, event_source_url.

### 11.6 Market Intelligence (Ads Library)
Comprehensive competitor analysis using 3 scraping strategies:

1. **Facebook Ads Archive API** (v22.0/v25.0) — bulk keyword search + per-page lookup
2. **Headless Chromium** (puppeteer-core) — full browser rendering with auto-scroll
3. **HTTP fetch fallback** — raw HTML parsing

Output: total ads, unique pages, page names/IDs, ad durations, competitor rankings.

Page name resolution chain: API → HTML JSON → `<title>` tag → og:title → Browser DOM → Direct FB page visit → Mobile FB fallback.

---

## 12. AI Integration

### 12.1 Content Review (OpenAI gpt-4.1-nano)
**Endpoint**: `POST /api/content-review`

Analyzes Vietnamese real estate ad copy with:
- **Scoring**: 0-10 scale on multiple criteria
- **3 rewritten versions**: "Gắt" (aggressive), "Kể chuyện" (storytelling), "Trực diện" (direct)
- **Detailed editing suggestions**: specific line-by-line improvements
- **Extensive system prompt** with Vietnamese BĐS marketing knowledge

### 12.2 Campaign Advisor (Perplexity sonar-pro)
**Endpoint**: `POST /api/campaign-advisor`

Real-time campaign analysis:
- Searches internet for current market data
- Provides budget allocation recommendations
- Audience targeting suggestions
- Vietnamese-specific BĐS insights

**Single Campaign**: `POST /api/campaign-advisor/single` — analyze one specific campaign

### 12.3 Marketing Guidelines Knowledge Base
16 built-in rules across categories:
- "headline" — headline writing rules
- "cta" — call-to-action best practices
- "layout" — image/video layout standards
- "budget" — budget allocation guidelines
- etc.

**Endpoint**: `POST /api/marketing-guidelines/seed` — populate default rules

### 12.4 AI Project Verification (Market Intel)
**Function**: `aiVerifyProject()`

Uses Perplexity to search the internet and verify:
- Project type (cao_tang / thap_tang / both)
- Actual product types available
- Location confirmation
- Price data validation
- Market insight generation

---

## 13. Backup/Restore

### Automatic Backup
- **Interval**: Every 8 hours + on server startup
- **Location**: `server/data/backups/`
- **Format**: `crm-backup-{label}-{YYYYMMDD-HHmmss}.db`
- **Retention**: 7 days (`BACKUP_KEEP_DAYS`)
- **Method**: File copy of `crm.db`

### Manual Backup
`POST /api/backup-now` → `performBackup("manual")`

### Restore
`POST /api/restore-backup` (AdminOnly) — select backup file to restore

### Recovery Endpoints
| Endpoint | Purpose |
|----------|---------|
| `POST /api/recover-sales` | Recover sale assignments from existing data |
| `POST /api/recover-from-backup` | Restore from latest backup file |
| `POST /api/recover-sale-from-dbbackup` | Recover specific sale data from backup |
| `POST /api/recover-selective` | Selective field recovery (choose which fields to restore) |

---

## 14. Chat System

### Overview
Simple internal messaging system between CRM users.

### Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /api/chat/users` | List users available for chat |
| `GET /api/chat/messages/:userId` | Get message history with a specific user |
| `POST /api/chat/send` | Send a message (body: `{ to, message }`) |
| `GET /api/chat/new/:userId` | Check for unread messages from a user |

### Storage
Messages stored in `chat_messages` table with `from_user`, `to_user`, `message`, `read` flag.

---

## 15. Announcements

### Overview
System-wide announcement broadcasts with priority, type, and expiry.

### Types
- `info` — Information
- `warning` — Warning
- `urgent` — Urgent

### Features
- Priority ordering
- Expiry date support (`expires_at`)
- Active/inactive toggle
- **Socket.IO**: `announcement-changed` event emitted on create/update/delete for real-time UI update

### Endpoints
- `GET /api/announcements` — Active announcements only
- `GET /api/announcements/all` — All announcements (admin)
- `POST /api/announcements` — Create (admin)
- `PUT /api/announcements/:id` — Update (admin)
- `DELETE /api/announcements/:id` — Delete (admin)

---

## 16. Content/Post Management

### Google Sheets Posts
The system can fetch post content from connected Google Sheets:
- `GET /api/sheet/posts` — Fetch posts from all active sheet configs
- `POST /api/sheet/posts/status` — Update post status in the sheet

### Facebook Posts
Full lifecycle management:
1. **Create** draft post with title, content, image URLs, target pages
2. **Edit** draft content
3. **Publish** to multiple Facebook pages simultaneously:
   - Uploads photos first (`/me/photos?published=false`)
   - Creates feed post with `attached_media`
   - Records `published_ids` mapping per page
4. **Track** published post IDs for reference

### Sheet Configs
Multiple Google Sheet configurations supported:
- Each config has: name, sheet_url, sheet_type (default: "posts")
- Supports testing connectivity (`GET /api/sheet/test/:id`)

---

## 17. Daily News

### Overview
Automated daily Vietnamese real estate news briefing powered by Perplexity AI (sonar-pro).

### Auto-Fetch Schedule
- **Check interval**: Every 10 minutes
- **Default fetch time**: 07:00 (configurable via `news_auto_fetch_time` setting)
- **Frequency**: Once per day (checks `date(created_at)` to avoid duplicates)

### Content Structure
The Perplexity prompt generates:
| Field | Description |
|-------|-------------|
| `headline` | Daily briefing title |
| `market_pulse` | 1-2 sentence market status |
| `market_sentiment` | 0-100 score (0=frozen, 50=waiting, 100=booming) |
| `news_items[]` | 5-7 news items with: title, source_name, source_url, verdict ("thơm"/"độc"/"trung_tinh"), verdict_reason, insight, data_citations |
| `tomorrow_forecast` | Next 2-3 day forecast based on upcoming events |
| `action_brief[]` | Specific action items for sales team |
| `sources[]` | Source URLs |

### Verdicts
- **"thơm"** (fragrant) — Favorable for BĐS sales
- **"độc"** (toxic) — Unfavorable for BĐS sales
- **"trung_tinh"** — Neutral

### Settings
- Perplexity API key stored in `settings` table
- OpenAI API key also configurable here
- Auto-fetch time configurable

---

## 18. Lead Report & Analytics

### Sales Analytics (`GET /api/sales/analytics`)
Per-agent performance metrics:
- **Total leads** assigned
- **Conversion rates** by status
- **Average response time** (time from assignment to first status change)
- **Stage time** from lead_status_log (time spent in each status)
- Grouped by sale agent

### Lead Report (`GET /api/lead-report`)
Quality report with:
- **Date filtering** (start_date, end_date query params)
- **Cost calculation** from cost_per_lead data
- **Groupings**:
  - `interested` — leads showing interest
  - `notInterested` — rejected leads
  - `noFeedback` — leads without feedback
  - `booked` — confirmed bookings
  - `other` — uncategorized

### Market Intelligence Analytics (`GET /api/market-intel/analyze`)
Comprehensive project analysis:
- **Heat Index** (5-99): Based on ad competition density + price tier
- **Opportunity Score** (5-99): CPL vs district avg, competition level, cost threshold
- **CPL Estimation**: `Base_CPL(250K) × Segment × Location × Competition`
- **Segment Factors**: affordable(0.85x), mid(1.0x), mid_high(1.2x), luxury(1.6x), ultra_luxury(2.8x)
- **Location Factors**: center(1.25x), suburban(1.0x), remote(0.8x)
- **Competition Multipliers**: low(1.0x), medium(1.2x), high(1.5x)
- **30-day trends** for ad count and CPL
- **District benchmarking** against 15+ Vietnamese districts
- **Winning pages** — top competitor Facebook pages sorted by ad duration

---

## Security Configuration

### Middleware Stack
1. **Helmet** — Security headers
2. **CORS** — Configurable allowed origins
3. **Rate Limiting**:
   - Login: 15 requests / 15 minutes
   - API: 1000 requests / 1 minute
4. **JSON body limit**: 10MB

### Authentication
- **JWT** with 24h expiry
- **scryptSync** password hashing with random salt
- **timingSafeEqual** for password comparison
- **Role-based access**: admin > manager > sale

### SSRF Protection
`fetchCsvText()` validates URLs against allowlist: `docs.google.com`, `*.googleusercontent.com`

### Telegram Webhook Security
Webhooks verify `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 4000 | Server port |
| `DB_PATH` | `./server/data/crm.db` | SQLite database path |
| `TURSO_DATABASE_URL` | — | Turso cloud database URL |
| `TURSO_AUTH_TOKEN` | — | Turso auth token |
| `JWT_SECRET` | (generated) | JWT signing secret |
| `TELEGRAM_WEBHOOK_SECRET` | (generated) | Telegram webhook verification |
| `BASE_URL` | `https://crm-iqi.id.vn` | Public URL for webhook registration |
| `SYNC_INTERVAL_MS` | 180000 (3 min) | Google Sheets sync interval |
| `ALLOWED_ORIGINS` | — | CORS allowed origins (comma-separated) |
| `PERPLEXITY_API_KEY` | — | Perplexity AI API key |
| `CHROMIUM_PATH` | — | Path to Chromium binary |
| `VERCEL` | — | If set, disables HTTP listener (serverless mode) |

---

## Server Startup Sequence

```
1. initDb()
   ├── Create all 20+ tables
   ├── Run migrations up to DB_VERSION=14
   ├── Create default admin (admin/admin123)
   ├── Create default project
   └── Build indexes

2. Express app setup
   ├── Helmet, CORS, JSON parser
   ├── Rate limiters
   ├── Static file serving (dist/)
   └── Register all routes

3. HTTP server + Socket.IO

4. server.listen(PORT)
   └── setTimeout(3s): Auto-register Telegram webhooks

5. setInterval jobs:
   ├── Auto-sync (every 3 min)
   ├── Auto-backup (every 8 hours) + startup backup
   ├── Auto-rotate (every 30 min)
   └── Daily news check (every 10 min)

6. SPA fallback: non-API routes → index.html

7. Export app for Vercel serverless
```
