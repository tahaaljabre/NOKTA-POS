const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { requirePermission, requireAdmin } = require('../middleware/auth.middleware');
const { logAudit } = require('../middleware/audit.middleware');

router.use(requirePermission('attendance'));

function cleanDate(value) {
  const date = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function cleanTime(value) {
  const time = String(value || '').trim();
  return !time || /^\d{2}:\d{2}(:\d{2})?$/.test(time) ? (time || null) : null;
}

router.get('/employees', (req, res) => {
  res.json(db.prepare('SELECT id,employee_code,name,name_en,phone,department,job_title,employment_type,active,hire_date FROM hr_employees ORDER BY active DESC, name').all());
});

router.post('/employees', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!String(b.employee_code || '').trim() || !String(b.name || '').trim()) return res.status(400).json({ error: 'رمز الموظف والاسم مطلوبان / Employee code and name are required' });
  try {
    const info = db.prepare(`INSERT INTO hr_employees (employee_code,name,name_en,phone,department,job_title,employment_type,hire_date)
      VALUES (?,?,?,?,?,?,?,?)`).run(String(b.employee_code).trim(), String(b.name).trim(), String(b.name_en || '').trim(), String(b.phone || '').trim(), String(b.department || '').trim(), String(b.job_title || '').trim(), String(b.employment_type || 'full_time'), cleanDate(b.hire_date));
    logAudit(req.currentUser.id, req.currentUser.name, 'create', 'hr_employee', info.lastInsertRowid, `Created HR employee: ${b.name}`);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'رمز الموظف مستخدم / Employee code already exists' });
    throw error;
  }
});

router.put('/employees/:id', requireAdmin, (req, res) => {
  const b = req.body || {};
  const before = db.prepare('SELECT * FROM hr_employees WHERE id=?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'موظف شؤون الموظفين غير موجود / HR employee not found' });
  db.prepare(`UPDATE hr_employees SET employee_code=COALESCE(?,employee_code), name=COALESCE(?,name), name_en=COALESCE(?,name_en), phone=COALESCE(?,phone), department=COALESCE(?,department), job_title=COALESCE(?,job_title), employment_type=COALESCE(?,employment_type), active=COALESCE(?,active), hire_date=COALESCE(?,hire_date) WHERE id=?`).run(
    b.employee_code ? String(b.employee_code).trim() : null, b.name ? String(b.name).trim() : null, b.name_en === undefined ? null : String(b.name_en), b.phone === undefined ? null : String(b.phone), b.department === undefined ? null : String(b.department), b.job_title === undefined ? null : String(b.job_title), b.employment_type === undefined ? null : String(b.employment_type), b.active === undefined ? null : (b.active ? 1 : 0), b.hire_date === undefined ? null : cleanDate(b.hire_date), req.params.id);
  const after = db.prepare('SELECT * FROM hr_employees WHERE id=?').get(req.params.id);
  logAudit(req.currentUser.id, req.currentUser.name, 'update', 'hr_employee', req.params.id, `Updated HR employee: ${after.name}`, before, after);
  res.json({ ok: true });
});

router.delete('/employees/:id', requireAdmin, (req, res) => {
  const before = db.prepare('SELECT * FROM hr_employees WHERE id=?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'موظف شؤون الموظفين غير موجود / HR employee not found' });
  db.prepare('UPDATE hr_employees SET active=0 WHERE id=?').run(req.params.id);
  logAudit(req.currentUser.id, req.currentUser.name, 'deactivate', 'hr_employee', req.params.id, `Deactivated HR employee: ${before.name}`, before, { ...before, active: 0 });
  res.json({ ok: true });
});

router.get('/records', (req, res) => {
  const date = cleanDate(req.query.date) || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT a.*, e.employee_code, e.name, e.name_en FROM attendance_records a JOIN hr_employees e ON e.id=a.hr_employee_id WHERE a.attendance_date=? ORDER BY e.name`).all(date);
  res.json({ date, records: rows });
});

router.post('/records', requireAdmin, (req, res) => {
  const b = req.body || {};
  const date = cleanDate(b.attendance_date);
  const checkIn = cleanTime(b.check_in);
  const checkOut = cleanTime(b.check_out);
  if (!date || !Number.isInteger(Number(b.hr_employee_id))) return res.status(400).json({ error: 'التاريخ وموظف شؤون الموظفين مطلوبان / Date and HR employee are required' });
  const employee = db.prepare('SELECT id FROM hr_employees WHERE id=? AND active=1').get(Number(b.hr_employee_id));
  if (!employee) return res.status(404).json({ error: 'موظف شؤون الموظفين غير موجود / HR employee not found' });
  db.prepare(`INSERT INTO attendance_records (hr_employee_id,attendance_date,check_in,check_out,status,source,note,approved_by,updated_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(hr_employee_id,attendance_date) DO UPDATE SET check_in=excluded.check_in,check_out=excluded.check_out,status=excluded.status,source=excluded.source,note=excluded.note,approved_by=excluded.approved_by,updated_at=CURRENT_TIMESTAMP`).run(Number(b.hr_employee_id), date, checkIn, checkOut, String(b.status || 'present'), String(b.source || 'manual'), String(b.note || '').slice(0, 500), req.currentUser.id);
  res.status(201).json({ ok: true });
});

router.get('/devices', (req, res) => {
  const rows = db.prepare('SELECT id,name,provider,host,port,active,last_sync_at,created_at FROM biometric_devices ORDER BY name').all();
  res.json(rows);
});

router.post('/devices', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!String(b.name || '').trim() || !String(b.provider || '').trim()) return res.status(400).json({ error: 'اسم الجهاز والمزود مطلوبان / Device name and provider are required' });
  const info = db.prepare('INSERT INTO biometric_devices (name,provider,host,port) VALUES (?,?,?,?)').run(String(b.name).trim(), String(b.provider).trim(), String(b.host || '').trim(), Number(b.port) || 0);
  logAudit(req.currentUser.id, req.currentUser.name, 'create', 'biometric_device', info.lastInsertRowid, `Registered biometric device: ${b.name}`);
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
