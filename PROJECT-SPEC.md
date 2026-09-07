# POS Web Application - Complete Project Specification

## 📋 Project Overview
A standalone restaurant POS (Point of Sale) web application designed as a PWA (Progressive Web App) that works on Android tablets and desktop browsers. Originally separated from an Electron desktop app, now fully independent.

**Target:** Restaurant in Thailand
**Language:** Bilingual Arabic/English with RTL support
**Currency:** Thai Baht (฿)
**Network:** Local network (LAN) - works without internet

---

## 🛠 Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-time:** Socket.IO (live updates across devices)
- **Database:** Node.js built-in `node:sqlite` (Node.js 22.5+)
- **Storage:** Direct SQLite persistence to `data/pos.sqlite` with WAL; tests use `:memory:`

### Frontend
- **Type:** Vanilla JavaScript (no framework)
- **Architecture:** Multi-file modular structure
- **Styling:** Custom CSS with CSS variables
- **PWA:** Service Worker + Web App Manifest

### Key Files Location
```
C:\Users\User\OneDrive\Desktop\test\pos-web\
├── server.js              # Express + Socket.IO + all API endpoints
├── db.js                  # Database schema, migrations, seed data
├── package.json           # Dependencies: express, sql.js, socket.io, cors
├── data/
│   └── pos.sqlite         # SQLite database (auto-created)
└── public/
    ├── index.html         # Main HTML (PWA-enabled, all views)
    ├── style.css          # All CSS styling
    ├── i18n.js            # Arabic/English translations
    ├── manifest.json      # PWA manifest
    ├── sw.js              # Service Worker (cache v5)
    ├── icon-192.svg       # App icon
    ├── icon-512.svg       # App icon
    └── js/
        ├── app.js         # Core: State, API, Login, Modal, Toast, Socket, Navigation
        ├── menu.js        # Categories + Menu Grid + Menu Admin CRUD
        ├── orders.js      # POS, Active Orders, Receipt generation
        ├── tables.js      # Tables (customer view + admin CRUD)
        ├── employees.js   # Employee management + permissions
        ├── settings.js    # Restaurant settings (load/save)
        ├── invoices.js    # Invoice listing, view, edit, delete
        ├── daily-closing.js # Employee daily closing
        ├── sales.js       # Sales reports (by date, employee, payment)
        ├── audit.js       # Audit trail log
        ├── reports.js     # Daily reports
        └── admin.js       # Admin panel setup + permission-based visibility
```

---

## 🗄 Database Schema (SQLite via sql.js)

### employees
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL              -- Arabic name
name_en TEXT DEFAULT ''         -- English name
pin TEXT NOT NULL               -- SHA256 hash of PIN
role TEXT DEFAULT 'cashier'     -- admin | cashier | waiter
permissions TEXT DEFAULT '{}'   -- JSON: {pos, menu, reports, settings, audit, employees, daily_closing, edit_orders, delete_orders, view_invoices}
active INTEGER DEFAULT 1
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### categories
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL              -- Arabic name
name_en TEXT DEFAULT ''         -- English name
icon TEXT DEFAULT ''            -- Emoji icon (100+ options available)
sort_order INTEGER DEFAULT 0
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### items
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL              -- Arabic name
name_en TEXT DEFAULT ''         -- English name
category_id INTEGER
price REAL NOT NULL DEFAULT 0   -- Primary price
price2 REAL                    -- Secondary price (optional)
image TEXT DEFAULT ''           -- Base64 encoded image
sort_order INTEGER DEFAULT 0
active INTEGER DEFAULT 1
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### tables
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
number INTEGER NOT NULL UNIQUE
name TEXT DEFAULT ''
capacity INTEGER DEFAULT 4
status TEXT DEFAULT 'empty'     -- empty | occupied
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### orders
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
invoice_number INTEGER DEFAULT 0  -- Sequential invoice number
table_id INTEGER
type TEXT DEFAULT 'dine_in'       -- dine_in | takeaway | delivery
status TEXT DEFAULT 'active'      -- active | completed | cancelled
total REAL DEFAULT 0
discount_percent REAL DEFAULT 0
payment_method TEXT DEFAULT 'cash' -- cash | promptpay | truemoney | card
note TEXT DEFAULT ''
employee_id INTEGER
employee_name TEXT DEFAULT ''
synced INTEGER DEFAULT 0
is_deleted INTEGER DEFAULT 0      -- Soft delete (admin only)
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
completed_at DATETIME
```

### order_items
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
order_id INTEGER NOT NULL
item_id INTEGER NOT NULL
quantity INTEGER DEFAULT 1
price REAL NOT NULL DEFAULT 0
discount_amount REAL DEFAULT 0
note TEXT DEFAULT ''
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### daily_closings
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
employee_id INTEGER NOT NULL
employee_name TEXT DEFAULT ''
date TEXT NOT NULL
total_orders INTEGER DEFAULT 0
total_revenue REAL DEFAULT 0
cash_total REAL DEFAULT 0
promptpay_total REAL DEFAULT 0
card_total REAL DEFAULT 0
truemoney_total REAL DEFAULT 0
is_closed INTEGER DEFAULT 0
closed_at DATETIME
notes TEXT DEFAULT ''
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### audit_log
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
employee_id INTEGER
employee_name TEXT DEFAULT ''
action TEXT NOT NULL
entity TEXT DEFAULT ''
entity_id INTEGER
details TEXT DEFAULT ''
old_value TEXT DEFAULT ''
new_value TEXT DEFAULT ''
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

### settings
```sql
key TEXT PRIMARY KEY
value TEXT
```

**Default Settings:**
| Key | Default Value |
|-----|---------------|
| restaurant_name | اسم المنشأة |
| restaurant_name_en | Your Business |
| restaurant_address | (empty) |
| restaurant_phone | (empty) |
| currency | ฿ |
| tax_rate | 0 |
| receipt_footer | شكراً لزيارتكم / Thank you |
| language | ar |
| delivery_grab | 0 |
| delivery_lineman | 0 |
| delivery_foodpanda | 0 |
| delivery_shopee | 0 |
| payment_cash | 1 |
| payment_promptpay | 0 |
| payment_truemoney | 0 |
| payment_card | 0 |
| invoice_retention_days | 365 |
| next_invoice_number | 1 |

### sync_log
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
device_id TEXT
last_sync DATETIME DEFAULT CURRENT_TIMESTAMP
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with PIN → returns employee object |

### Employees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/employees` | List all employees |
| POST | `/api/employees` | Create employee |
| PUT | `/api/employees/:id` | Update employee |
| DELETE | `/api/employees/:id` | Deactivate employee (soft) |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |

### Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/items` | List active items (with category filter) |
| GET | `/api/items/all` | List all items (including inactive) |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Soft delete item (set active=0) |

### Tables
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tables` | List all tables |
| POST | `/api/tables` | Create table |
| PUT | `/api/tables/:id` | Update table |
| DELETE | `/api/tables/:id` | Delete table |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List orders (filters: status, date, employee_id, not_deleted) |
| GET | `/api/orders/:id` | Get order with items |
| POST | `/api/orders` | Create order (auto-assigns invoice_number) |
| PUT | `/api/orders/:id` | Update order status/details |
| DELETE | `/api/orders/:id` | Soft delete (admin only, requires delete_orders permission) |

### Order Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/:id/items` | Add item to order |
| DELETE | `/api/order-items/:id` | Remove item from order |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List completed/cancelled orders (filters: date, employee_id, search by invoice_number, pagination) |

### Daily Closings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/daily-closings` | List closings (filters: date, employee_id) |
| POST | `/api/daily-closings/close` | Close day for employee (calculates totals) |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/daily` | Daily report by date |
| GET | `/api/reports/sales` | Sales report (from/to date, by employee) |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/audit` | List audit logs (filters: employee_id, action, date, limit) |
| GET | `/api/audit/stats` | Audit stats per employee per day |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all settings as key-value object |
| PUT | `/api/settings` | Update settings (multiple key-values) |

### Sync
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync` | Sync offline orders + get server changes |

---

## 🖥 Frontend Architecture

### Views (Navigation)
1. **POS** (`view-pos`) - Main order screen with menu grid + order panel
2. **Tables** (`view-tables`) - Table status overview
3. **Active Orders** (`view-active-orders`) - List of active orders with complete/cancel/print
4. **Invoices** (`view-invoices`) - All invoices with filters, view/edit/delete
5. **Sales** (`view-sales`) - Sales reports by date range
6. **Admin** (`view-admin`) - Admin panel with tabs

### Admin Tabs
1. **Menu** - Categories + Items CRUD
2. **Employees** - Employee management with permissions
3. **Tables** - Table management
4. **Daily Closing** - Employee daily closing
5. **Audit** - Audit trail log
6. **Settings** - Restaurant configuration
7. **Reports** - Daily reports

### Permissions System (10 permissions)
| Permission | Controls |
|------------|----------|
| `pos` | Access to POS view |
| `menu` | Menu admin tab |
| `employees` | Employees admin tab |
| `settings` | Settings admin tab |
| `audit` | Audit admin tab |
| `reports` | Reports tab + Sales tab |
| `daily_closing` | Daily closing admin tab |
| `edit_orders` | Edit invoices button |
| `delete_orders` | Delete invoices button |
| `view_invoices` | Invoices navigation tab |

### Default Admin PIN: `1234`

---

## 🌐 Multi-Device Setup

### Architecture
```
[Tablet 1] ──┐
[Tablet 2] ──┤──> [Main Server PC] ──> [SQLite DB]
[Desktop]  ──┘      (192.168.8.193:3000)
```

### How to Connect
1. Server runs on PC at `0.0.0.0:3000`
2. Tablets connect via browser: `http://192.168.8.193:3000`
3. All devices share the same database via API
4. Real-time updates via Socket.IO

### PWA Installation (Android)
1. Open Chrome on tablet
2. Navigate to `http://192.168.8.193:3000`
3. Chrome menu → "Add to Home Screen"
4. App icon appears on home screen

### Offline Support
- Service Worker caches static files
- IndexedDB stores offline orders
- Auto-sync when connection restored
- Works fully on local network without internet

---

## 🚀 Deployment Instructions

### First Time Setup
```bash
cd C:\Users\User\OneDrive\Desktop\test\pos-web
npm install
node server.js
```

### Running
```bash
node server.js
# Server starts on http://0.0.0.0:3000
# Admin PIN: 1234
```

### Key Commands
- **Start server:** `node server.js`
- **Stop server:** Kill node process
- **Database:** Auto-created at `data/pos.sqlite`
- **Backup:** Copy `data/pos.sqlite` file

---

## ✅ Completed Features

1. ✅ PIN-based login with offline fallback
2. ✅ Bilingual Arabic/English (RTL support)
3. ✅ Menu management (categories with 100+ emoji icons, items with images)
4. ✅ POS with order types (dine-in, takeaway, delivery)
5. ✅ Table management
6. ✅ Active orders with complete/cancel/print
7. ✅ Receipt generation with restaurant info + payment method
8. ✅ Sequential invoice numbering
9. ✅ Invoice listing with filters
10. ✅ Edit invoices (add/remove items after printing)
11. ✅ Delete invoices (admin only, soft delete)
12. ✅ Payment methods (Cash, PromptPay, TrueMoney, Card)
13. ✅ Delivery apps (GrabFood, LINE MAN, Foodpanda, ShopeeFood)
14. ✅ Daily closing per employee
15. ✅ Sales reports (by date, employee, payment method)
16. ✅ Audit trail
17. ✅ Employee permissions (10 granular permissions)
18. ✅ Admin-only visibility (tabs/nav hidden based on role)
19. ✅ PWA (installable on Android)
20. ✅ Offline support with IndexedDB
21. ✅ Service Worker caching
22. ✅ Real-time Socket.IO updates
23. ✅ Multi-device support via LAN
24. ✅ Configurable invoice retention period
25. ✅ Settings (restaurant name, address, phone, currency, tax, etc.)

---

## ⚠️ Known Issues / Notes

1. **Service Worker Caching:** Old files may be cached. Users must uninstall PWA and reinstall when code changes.
2. **Header Encoding:** Employee names sent via headers use `encodeURIComponent()` to avoid ISO-8859-1 errors.
3. **Database Migrations:** `db.js` handles migrations automatically for existing databases (adds missing columns).
4. **Image Storage:** Item images stored as base64 in database (max 500KB recommended).
5. **Backup:** Manual backup by copying `data/pos.sqlite`. Consider adding scheduled backup feature.

---

## 🔮 Potential Future Enhancements

1. **Inventory Management** - Track stock levels
2. **Table Reservations** - Booking system
3. **Customer Loyalty** - Points/rewards system
4. **Kitchen Display System** - Screen for kitchen orders
5. **Barcode Scanning** - Scan items for quick add
6. **Multi-location** - Multiple restaurant branches
7. **Cloud Backup** - Automatic cloud backup
8. **Receipt Printer Integration** - Thermal printer support
9. **Cash Drawer Integration** - Auto-open cash drawer
10. **Report PDF Export** - Generate PDF reports
11. **SMS/Email Receipts** - Send receipts digitally
12. **Tip Management** - Add tip to orders
13. **Split Bill** - Split order across multiple payments
14. **Combo Meals** - Bundled items with special pricing
15. **Happy Hour** - Time-based pricing

---

## 📝 Server Configuration

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |

### Auto-saves
- Database saves to disk every 5 seconds
- On SIGINT/SIGTERM, saves immediately

### Headers
- `X-Employee-Id`: Employee ID (URL-encoded)
- `X-Employee-Name`: Employee name (URL-encoded)

---

## 📚 Project History & AI Handoff Context
*(This section is maintained to help future AI assistants understand the evolution of the project without needing to read the entire chat history.)*

### Core Philosophy & Architectural Decisions
1. **No Frontend Frameworks:** The app uses Vanilla JS, HTML, and CSS (with CSS variables) to remain lightweight, blazing fast, and highly customizable. It avoids heavy build tools like Webpack or Vite.
2. **PWA First:** It is designed to be installed as a PWA on Android tablets. Caching via Service Worker (`sw.js`) and `index.html` cache-busting (e.g., `?v=17`) is critical. Whenever frontend files change, the cache version **must** be bumped.
3. **Database Simplicity:** It uses `better-sqlite3` (originally `sql.js`). The database is file-based (`data/pos.sqlite`). The schema is designed to be fully extensible via JSON `attributes` columns, but we prefer explicit columns for core features.
4. **Resilience & State:** Active orders are critical. `orders.js` handles the complex UI state of active orders, merging socket updates. Order calculations (totals, taxes) are strictly handled backend-side in `recalcOrderTotal()` within `orders.routes.js`.
5. **Atomic Operations:** When updating order items (e.g., `PUT /api/orders/:id`), we use atomic transactions (DELETE old items + INSERT new items) to prevent data corruption during network instability or rapid clicking.

### Major Milestones & Fixes

#### 1. The PWA Transition & Multi-Device Setup (v1-v15)
- Transitioned from an Electron desktop app to a standalone Express + Vanilla JS PWA.
- Implemented real-time sync across multiple cashier tablets using `Socket.io`.
- Implemented robust bilingual support (Arabic/English) with RTL layout switching.

#### 2. The "Empty Orders" & Corruption Fix (v16)
- **Bug:** Active orders were showing up with a total of `0` and no items, yet taking up space in the UI. Old items would "disappear" when adding new ones.
- **Root Cause:** A buggy `PUT` request was deleting all items from the database when it crashed mid-update, or the frontend was sending an empty item list. Also, corrupt test data existed in the DB.
- **Fix:** We deleted all corrupt orders (IDs 43, 44, 46-50) using a SQL query. We rewrote `PUT /api/orders/:id` in `orders.routes.js` to correctly use a database transaction to clear and re-insert items safely, recalculating the total securely on the backend.

#### 3. Shift Management Refinement (v16)
- **Bug:** The system was prompting the cashier to "Open Shift" every single time they logged in on the same day, causing duplicate shifts.
- **Fix:** Updated `daily-closing.js` to check if an open shift already exists for the employee for the current date (`api/daily-closings/check`). If it does, it skips the prompt and loads the existing shift ID into the session.

#### 4. The Payment Flow Overhaul (v17)
- **Request:** The user preferred the "old way" where you click "Pay" on an active order, and *then* the receipt pops up allowing you to select the payment method (Cash, Card, etc.), print, and close.
- **Fix:** We heavily modified `openPayOrderModal()` in `orders.js`.
  - The modal now displays the full order details.
  - Added an interactive **Item Editor** inside the payment modal: The cashier can add new items directly from the payment screen, adjust quantities (+/-), or delete items.
  - Added a **Search Bar** (by ID or Name) in the payment modal for lightning-fast item additions. Pressing 'Enter' auto-adds the first result.
  - Ensures the modal syncs changes to the backend in real-time, recalculating the total before the final payment is submitted.

### Next Planned Upgrades (In Progress)
- **Phase 1:** Kitchen Display System (KDS) via WebSockets.
- **Phase 2:** Modifiers (Add-ons & Options).
- **Phase 3:** Inventory & Stock Management.
- **Phase 4:** Customer Loyalty & CRM.
- **Phase 5:** Advanced Analytics & Charts.
- **Phase 6:** Granular Roles & Permissions UI.

---

*Document generated for project handoff. All code is in `C:\Users\User\OneDrive\Desktop\test\pos-web\`*
