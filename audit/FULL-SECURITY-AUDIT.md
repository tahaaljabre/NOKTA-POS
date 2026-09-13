# NOKTA POS — Full Security & Correctness Audit Report

**Date:** 2026-09-13
**Scope:** Full codebase — 21 backend route files, ~15 service/middleware files, all frontend JS/HTML/CSS, service worker, and configuration.
**Auditor:** AI-Assisted Comprehensive Review

---

## Executive Summary

The NOKTA POS system is a well-structured Node.js/Express/SQLite point-of-sale application for restaurant operations. The backend architecture is solid: server-side price calculation, parameterized SQL queries, HMAC-SHA256 JWT tokens with timing-safe comparison, and atomic transaction handling. However, this audit identified **5 critical vulnerabilities**, **8 high-severity issues**, **15 medium-severity problems**, and **12 low-severity findings** that require attention.

**Critical Findings:**
1. Client-controlled tax rate in `updateOrder` allows tax evasion
2. Auth tokens passed via URL fragments and stored in `localStorage`
3. Supplier financial endpoints completely unprotected
4. Sales reports lack data isolation between cashiers

---

## CRITICAL — Immediate Fix Required

### C1. Client Can Override Tax Rate on Order Update
**File:** `src/services/orders.service.js` line 68
**Severity:** CRITICAL

```js
const taxP = input.tax_percent !== undefined ? Number(input.tax_percent) : old.tax_percent;
```

In `updateOrder`, `tax_percent` is accepted directly from the browser request body. A cashier with only `pos` permission can send `tax_percent: 0` to eliminate tax entirely, or a negative value to create negative tax. The `totals()` function does not validate or clamp `tax_percent`.

In contrast, `createOrder` correctly reads the tax rate from the `settings` table (line 20-21).

**Impact:** Financial fraud — a malicious employee can zero out tax on any order during edit.

**Fix:** Read `tax_percent` from `settings` table in `updateOrder`, same as `createOrder` does. Remove `input.tax_percent` from the accepted input.

---

### C2. Auth Tokens Passed via URL Fragment
**Files:** `public/js/core/login-handler.js` lines 89, 137; `public/js/kds.js` line 6
**Severity:** CRITICAL

The kitchen display screen (KDS) session is passed as `kds.html#session=TOKEN`. URL fragments are:
- Visible in browser history
- Stored in browser history entries
- Accessible to browser extensions
- Potentially logged by proxy/monitoring software

`kds.js:6` writes the fragment value directly to `localStorage`.

**Impact:** Session hijacking via browser history, extensions, or monitoring.

**Fix:** Use `postMessage` from the opener window, or a one-time-use session endpoint that exchanges a short-lived code for a token.

---

### C3. Auth Token Stored in localStorage
**Files:** `public/js/core/login-handler.js` lines 83, 133; `public/js/kds.js` line 6
**Severity:** CRITICAL

```js
localStorage.setItem('pos_kitchen_token', data.token);
```

`localStorage` persists across sessions and is accessible to **any script** running on the same origin. Any XSS vulnerability (even from a third-party script or browser extension) can read the full session token.

**Impact:** Full session compromise via any XSS vector.

**Fix:** Move to `sessionStorage` (cleared on tab close) or implement httpOnly cookies set by the server. At minimum, use `sessionStorage`.

---

### C4. Supplier Financial Endpoints Have No Permission Checks
**File:** `src/routes/suppliers.routes.js` lines 227, 436, 455, 557
**Severity:** CRITICAL

| Endpoint | Line | Issue |
|---|---|---|
| `GET /:id/statement` | 227 | Only `requireAuthenticated` — any user sees full supplier financial statement |
| `GET /:id/purchases` | 436 | Only `requireAuthenticated` — any user lists all purchase invoices |
| `POST /:id/payments` | 455 | Only `requireAuthenticated` — any user can create payment vouchers |
| `GET /:id/payments` | 557 | Only `requireAuthenticated` — any user views all payment vouchers |

There is a business-logic check for cashier ownership on the payment endpoint (line 476), but this is not a route-level permission gate. A waiter with no `manage_payments` permission can still reach the endpoint.

**Impact:** Any authenticated employee (cashier, waiter, kitchen staff) can view supplier financial data and create payment vouchers.

**Fix:** Add `requirePermission('manage_suppliers')` to statement and purchases endpoints. Add `requirePermission('manage_payments')` to payment endpoints.

---

### C5. Sales Reports Lack Data Isolation
**File:** `src/routes/reports.routes.js` lines 48, 62
**Severity:** CRITICAL

Any user with the `reports` permission can query **any employee's** sales data, including other cashiers' revenue, payment methods, and daily closing details. There is no automatic filtering by `cashier_code` for non-admin users.

**Impact:** Privacy violation and data leakage — a cashier can see all financial details of every other cashier.

**Fix:** For non-admin users, automatically filter reports by `req.currentUser.cashier_code`. The `cashier_code` filter parameter should be ignored for non-admin users.

---

## HIGH — Fix Within Sprint

### H1. Hard Delete of Tables Orphans Order References
**File:** `src/routes/tables.routes.js` line 48
**Severity:** HIGH

```js
db.prepare('DELETE FROM "tables" WHERE id = ?').run(id);
```

Unlike every other entity in the system which uses soft delete (`is_deleted`), tables are hard-deleted. Any historical orders referencing that `table_id` will have orphaned foreign keys.

**Fix:** Add `is_deleted` flag to tables, or at minimum check for referencing orders before deletion.

---

### H2. Hard Delete of Employees Destroys Audit Trail
**File:** `src/routes/employees.routes.js` lines 134-136
**Severity:** HIGH

```js
db.prepare('DELETE FROM employees WHERE id = ?').run(id);
```

Permanent delete of an employee destroys:
- `audit_log.employee_id` references
- `orders.employee_id` references
- `shifts.employee_id` references

This breaks historical data integrity.

**Fix:** Remove the permanent delete option, or cascade the deletion carefully (reassign audit logs, anonymize order references).

---

### H3. Settings Endpoint Exposes Sensitive Data to All Users
**File:** `src/routes/settings.routes.js` lines 8-13
**Severity:** HIGH

```js
router.get('/', requireAuthenticated, (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
```

Any authenticated user (including waiters and kitchen staff) can read ALL settings including `printer_ip`, `printer_port`, `tax_number`, `restaurant_phone`, `restaurant_address`, and `printers_config`.

**Fix:** Gate behind `requirePermission('settings')` or filter sensitive settings by role.

---

### H4. Any Authenticated User Can Open Shifts
**File:** `src/routes/shifts.routes.js` line 21
**Severity:** HIGH

The `POST /open` endpoint only requires `requireAuthenticated`. Any authenticated employee — including waiters and kitchen staff — can open a cashier shift.

**Fix:** Add role check (e.g., `requirePermission('pos')` or check that the user is a cashier).

---

### H5. Any Authenticated User Can Open Daily Closing
**File:** `src/routes/daily-closing.routes.js` line 81
**Severity:** HIGH

Same issue as H4. The `POST /open` endpoint for daily closings has no permission check beyond authentication.

**Fix:** Add `requirePermission('daily_closing')` or equivalent role check.

---

### H6. Get All Items Returns Inactive Items
**File:** `src/routes/items.routes.js` lines 20-23
**Severity:** HIGH

```js
router.get('/all', requireAuthenticated, async (req, res) => {
  const items = db.prepare('SELECT * FROM items').all();
```

The `/all` endpoint returns **every** item including deactivated ones. Any authenticated user can see inactive menu items.

**Fix:** Add `WHERE active = 1` or gate behind an admin/`menu` permission.

---

### H7. Stored XSS via Category Names in innerHTML
**Files:** `public/js/features/catalog/catalog-admin-list.js` lines 76, 143
**Severity:** HIGH

```js
catName // inserted directly into innerHTML without escapeHtml()
```

Category names from the database are inserted into `innerHTML` without `escapeHtml()`. If an admin creates a category with a name like `<img src=x onerror=alert(1)>`, it will execute in every user's browser when they view the admin panel.

**Fix:** Wrap all dynamic values in `escapeHtml()` before inserting into `innerHTML`.

---

### H8. Unescaped Data in Print Window
**File:** `public/js/features/suppliers/supplier-payments.js` line 468
**Severity:** HIGH

```js
currentUser?.name // not escaped in print HTML
```

`currentUser?.name` is inserted into the print window HTML without `escapeHtml()`. If a user's name contains HTML (created via a compromised admin panel), it executes in the print window.

**Fix:** Escape all dynamic values in print templates.

---

## MEDIUM — Fix Before Release

### M1. Brute-Force Limiter Ignores Reverse Proxy
**File:** `src/app.js` lines 90-116
**Severity:** MEDIUM

The rate limiter uses `req.ip` without configuring `trust proxy`. Behind a reverse proxy (nginx, load balancer), all clients share the same `req.ip` (the proxy IP), making the rate limiter either ineffective (all users share one bucket) or overly restrictive.

**Fix:** Configure `app.set('trust proxy', 1)` if behind a proxy, or use `X-Forwarded-For` header.

---

### M2. Audit Log Failures Silently Swallowed
**File:** `src/middleware/audit.middleware.js` lines 19-21
**Severity:** MEDIUM

```js
} catch (e) { console.error('Audit log error:', e.message); }
```

If the audit table is full, corrupt, or the DB is read-only, all audit entries are lost without the caller knowing. In a regulated POS environment, this is a compliance risk.

**Fix:** Throw the error or return a failure indicator so callers can handle it.

---

### M3. Customer PUT Returns Success Even When Nothing Updates
**File:** `src/routes/customers.routes.js` lines 50-64
**Severity:** MEDIUM

If a customer ID doesn't exist, the `COALESCE` update affects 0 rows, but the response is still `{ ok: true }`. The caller has no way to know the update had no effect.

**Fix:** Check `changes` from the `run()` result and return 404 if 0 rows affected.

---

### M4. PIN Login Loads All Active Employees into Memory
**File:** `src/routes/auth.routes.js` lines 12-18
**Severity:** MEDIUM

```js
const employees = db.prepare('SELECT * FROM employees WHERE active = 1').all();
```

Every PIN login loads **all** active employees into Node.js memory and filters in JavaScript. This also loads `password_hash`, `pin`, and `permissions` for every employee into the process.

**Fix:** Use a SQL query with `WHERE pin = ?` and compare hashes for the matched row only.

---

### M5. Invoice Number Generation Has TOCTOU Race Condition
**File:** `src/services/orders.effects.js` lines 22-26
**Severity:** MEDIUM

Two concurrent transactions could both read the same max invoice number and compute the same `n`. The `INSERT OR REPLACE` would overwrite with the same value, producing duplicate invoice numbers under concurrent load.

**Fix:** Use a transaction-level counter or `INSERT OR REPLACE` with an atomic increment pattern.

---

### M6. Supplier Purchase Number Has Race Condition
**File:** `src/routes/suppliers.routes.js` lines 339-348
**Severity:** MEDIUM

Same TOCTOU issue as M5 — two concurrent purchase requests could generate the same `PUR-XXXX` number. The `UNIQUE` constraint prevents duplicates but produces confusing errors.

**Fix:** Use an atomic counter pattern.

---

### M7. LIMIT/OFFSET String Interpolation in SQL
**Files:** `src/routes/invoices.routes.js` line 20; `src/routes/settings.routes.js` line 57
**Severity:** MEDIUM

```js
sql += ` LIMIT ${lim} OFFSET ${off}`;
```

While `parseInt` and `Math.max/min` clamping prevent injection, this pattern violates the parameterized query convention and is brittle to future changes.

**Fix:** Since SQLite's `LIMIT` doesn't accept parameters in most drivers, document this as an accepted pattern, or use a subquery wrapper.

---

### M8. Missing escapeHtml in Multiple Frontend Locations
**Files:** Multiple (see table)
**Severity:** MEDIUM

| File | Line | Unescaped Value |
|---|---|---|
| `js/audit-render.js` | 32, 177 | `invoice_number`, `entity_id` |
| `js/features/suppliers/suppliers-admin.js` | 532 | `supplier.category` fallback |
| `js/features/shifts/shift-closing-dashboard.js` | 82, 107 | delivery app names |
| `js/features/settings/settings-network.js` | 25 | IP URL in onclick string |

**Fix:** Apply `escapeHtml()` to all dynamic values before `innerHTML` or template literal insertion.

---

### M9. No Content Security Policy Header in HTML
**File:** `public/index.html`
**Severity:** MEDIUM

There is no CSP meta tag in the HTML. While the server-side CSP was added in `src/app.js` (line 67-74), the HTML meta tag is missing as a fallback. `'unsafe-inline'` is required due to inline `onclick` attributes throughout the templates.

**Fix:** Extract inline scripts to external files and add a strict CSP meta tag.

---

### M10. Token in IndexedDB for Background Sync
**File:** `public/sw.js` lines 57-59
**Severity:** MEDIUM

The service worker stores `auth_token` in offline order objects in IndexedDB for background sync. IndexedDB is accessible to any script on the same origin.

**Fix:** Use a short-lived sync token instead of the full session token.

---

### M11. Socket.IO Token Sent in Cleartext
**File:** `public/js/kds.js` line 13
**Severity:** MEDIUM

```js
io({ auth: { token: kitchenToken } })
```

If the socket connection doesn't use `wss://` (TLS), the auth token is transmitted in cleartext. The production server requires TLS, but development mode doesn't.

**Fix:** Ensure TLS is always used, or add a check in the socket connection.

---

### M12. No Token Refresh/Expiration Handling
**File:** `public/js/core/api-client.js`
**Severity:** MEDIUM

The token is obtained at login and never refreshed. The API client throws a generic error on 401 but doesn't redirect to login or attempt refresh.

**Fix:** Implement 401 interception that redirects to the login screen.

---

### M13. Settings Validation Race Condition
**File:** `src/routes/settings.routes.js` line 22
**Severity:** MEDIUM

The `next_invoice_number` validation reads the current max, checks if the new value is greater, then writes — all outside a transaction. Two concurrent requests could both pass the check.

**Fix:** Move the check inside the write transaction.

---

### M14. Auth Header DecodeURIComponent Can Throw
**File:** `src/app.js` lines 81-84
**Severity:** MEDIUM

`decodeURIComponent` on `x-employee-name` header can throw on malformed UTF-8 sequences. The `catch(e){}` silently swallows it and passes the raw value through.

**Fix:** Use a try/catch that falls back to the raw header value explicitly.

---

### M15. Cashier Code Not Uppercased on Employee Create
**File:** `src/routes/employees.routes.js` lines 61-63
**Severity:** MEDIUM

When creating a waiter with a `cashier_code`, the code is stored as-is. But `cashiers.service.js` stores codes as uppercase. This could cause case-sensitive lookup mismatches.

**Fix:** Normalize `cashier_code` to uppercase before saving.

---

## LOW — Fix When Convenient

| # | File | Issue |
|---|---|---|
| L1 | `src/routes/customers.routes.js:8` | `GET /` accessible to any authenticated user (no `customers` permission) |
| L2 | `src/routes/print.routes.js:39` | Any authenticated user can trigger printing of any invoice |
| L3 | `src/routes/print.routes.js:42` | `req.user?.name` should be `req.currentUser?.name` (always returns 'unknown') |
| L4 | `src/routes/attendance.routes.js:56` | Attendance records visible to any `attendance`-permissioned user (no data isolation) |
| L5 | `public/js/core/app-bootstrap.js:42` | `Math.random()` for device ID (not cryptographically secure, but non-security use) |
| L6 | `public/i18n/en.js:191,46` | Duplicate `change_due` key (second overwrites first) |
| L7 | Multiple files | Hardcoded Arabic/English fallbacks instead of `t()` i18n function |
| L8 | `src/routes/settings.routes.js:22` | `next_invoice_number` race condition outside transaction |
| L9 | `src/routes/suppliers.routes.js:574` | Dead code — duplicate `GET /stats/summary` definition unreachable |
| L10 | `src/routes/tables.routes.js:18` | No uniqueness validation on table `number` field |
| L11 | `public/index.html:16` | Hardcoded `http://localhost:3000` redirect (only for `file://` protocol) |
| L12 | `src/services/orders.effects.js:40` | Predictable fallback cashier code (`String.fromCharCode(64 + id)`) |

---

## What the Codebase Does Well

| Area | Details |
|---|---|
| **Server-side pricing** | `normalizeItems` reads prices from DB only. Client prices are never trusted. |
| **Auth middleware** | Overwrites `x-employee-id` and `x-employee-name` headers with authenticated data. |
| **Token revocation** | `token_rev` in DB is checked on every request — immediate session invalidation. |
| **SQL injection prevention** | All queries use `db.prepare()` with parameterized statements. |
| **Inventory protection** | `applyEffects` prevents negative stock levels. |
| **Transaction safety** | `BEGIN IMMEDIATE` with `COMMIT/ROLLBACK` ensures data integrity. |
| **Offline idempotency** | `offline_id` prevents duplicate orders from the same device. |
| **JWT implementation** | Custom HMAC-SHA256 with `timingSafeEqual` for signature comparison. |
| **XSS escaping** | `escapeHtml()` is consistently used in most (not all) dynamic content. |
| **Input validation** | `number()`, `text()`, `json()` helpers in services validate all input. |

---

## Recommended Fix Order

| Priority | Issue | Effort |
|---|---|---|
| **1** | C1 — Fix `tax_percent` trust in `updateOrder` | 15 min |
| **2** | C4 — Add permissions to supplier endpoints | 30 min |
| **3** | H7 — Add `escapeHtml` to category names | 15 min |
| **4** | H8 — Add `escapeHtml` to print templates | 15 min |
| **5** | C3 — Move token from `localStorage` to `sessionStorage` | 1 hour |
| **6** | C2 — Remove token from URL fragments | 2 hours |
| **7** | C5 — Add data isolation to reports | 1 hour |
| **8** | H3 — Gate settings endpoint by permission | 15 min |
| **9** | H4/H5 — Add permission checks to shift/closing open | 30 min |
| **10** | H1/H2 — Convert hard deletes to soft deletes | 1 hour |
| **11** | M8 — Fix remaining `escapeHtml` gaps | 1 hour |
| **12** | M5/M6 — Fix invoice number race conditions | 1 hour |
| **13** | M9 — Add CSP meta tag | 30 min |
| **14** | M12 — Implement 401 redirect to login | 1 hour |
| **15** | Remaining medium/low issues | 2-3 hours |

---

**Total estimated effort for all critical/high fixes: ~8 hours**
**Total estimated effort for all findings: ~16-20 hours**
