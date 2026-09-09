const express = require('express');
const router = express.Router();
const { db, verifyPin } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { issueToken } = require('../middleware/auth.middleware');

router.post('/login', (req, res) => {
  const { pin, username, password } = req.body;
  let emp;
  if (username || password) {
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    emp = db.prepare('SELECT * FROM employees WHERE username=? AND active=1').get(String(username).trim().toLowerCase());
    if (!emp || !verifyPin(password, emp.password_hash || emp.pin)) emp = null;
  } else {
    if (!/^[0-9]{4,6}$/.test(String(pin || ''))) return res.status(400).json({ error: 'PIN must contain 4 to 6 digits' });
    const candidates = db.prepare('SELECT * FROM employees WHERE active = 1').all();
    const matches = candidates.filter(employee => verifyPin(pin, employee.pin));
    emp = matches.length === 1 ? matches[0] : null;
  }
  if (!emp) return res.status(401).json({ error: 'PIN incorrect' });

  logAudit(emp.id, emp.name, 'login', 'employee', emp.id, `Employee Logged In: ${emp.name} (${emp.role}) - Floor ${emp.default_floor || 1}`);
  res.json({
    id: emp.id,
    name: emp.name,
    name_en: emp.name_en,
    role: emp.role || 'cashier',
    phone: emp.phone || '',
    default_floor: emp.default_floor || (emp.role === 'waiter' ? 1 : 1),
    default_station: emp.default_station || (emp.role === 'waiter' ? 'waiter_mobile' : 'cashier_floor1'),
    max_discount: emp.max_discount !== null && emp.max_discount !== undefined ? emp.max_discount : 100,
    permissions: typeof emp.permissions === 'string' ? JSON.parse(emp.permissions || '{}') : (emp.permissions || {}),
    token: issueToken(emp)
  });
});

router.get('/setup-status', (req, res) => {
  const admin = db.prepare("SELECT id, username FROM employees WHERE role='admin' AND active=1 ORDER BY id LIMIT 1").get();
  res.json({ setup_required: !admin && !db.prepare("SELECT value FROM settings WHERE key='setup_complete'").get(), recovery_required: !admin && !!db.prepare("SELECT value FROM settings WHERE key='setup_complete'").get(), migration_required: !!admin && !admin.username });
});

router.post('/setup-admin', (req, res) => {
  const { name, username, password } = req.body || {};
  const cleanUsername = String(username || '').trim().toLowerCase();
  const strongPassword = typeof password === 'string' && password.length >= 6 && /[a-z]/i.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  if (!String(name || '').trim() || !/^[a-z0-9._-]{3,32}$/.test(cleanUsername) || !strongPassword) return res.status(400).json({ error: 'Use a name, a 3–32 character username, and a strong password of at least 6 characters.' });
  const existingAdmin = db.prepare("SELECT id, pin, username FROM employees WHERE role='admin' AND active=1 ORDER BY id LIMIT 1").get();
  if (existingAdmin) {
    const { current_pin } = req.body || {};
    if (existingAdmin.username) return res.status(409).json({ error: 'Initial setup has already been completed' });
    if (!verifyPin(current_pin, existingAdmin.pin)) return res.status(401).json({ error: 'Current manager PIN is incorrect' });
    db.prepare('UPDATE employees SET username=?, pin=?,token_rev=token_rev+1 WHERE id=?').run(cleanUsername, require('../database/db').hashPin(password), existingAdmin.id);
    logAudit(existingAdmin.id, String(name).trim(), 'admin_login_migrated', 'employee', existingAdmin.id, 'Administrator login migrated without changing business data');
    return res.status(200).json({ ok: true, migrated: true });
  }
  if (db.prepare("SELECT value FROM settings WHERE key='setup_complete'").get() || db.prepare('SELECT id FROM employees LIMIT 1').get()) return res.status(409).json({error:'التهيئة مغلقة؛ يلزم استرجاع إداري محلي / Setup locked; local administrator recovery required'});
  const permissions = { pos: true, menu: true, reports: true, settings: true, audit: true, employees: true, customers: true, inventory: true, tables: true, daily_closing: true, edit_orders: true, delete_orders: true, view_invoices: true };
  try {
    const info = db.prepare('INSERT INTO employees (username, name, name_en, pin, role, permissions) VALUES (?, ?, ?, ?, ?, ?)').run(cleanUsername, String(name).trim(), 'Manager', require('../database/db').hashPin(password), 'admin', JSON.stringify(permissions));
    db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('setup_complete','1')").run();
    logAudit(info.lastInsertRowid, String(name).trim(), 'initial_admin_created', 'employee', info.lastInsertRowid, 'Initial administrator account created');
    res.status(201).json({ ok: true });
  } catch (err) { res.status(409).json({ error: 'Username is already in use' }); }
});

module.exports = router;
