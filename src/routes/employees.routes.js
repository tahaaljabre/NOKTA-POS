const express = require('express');
const router = express.Router();
const { db, hashPin } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { getRequesterInfo, requireAdmin } = require('../middleware/auth.middleware');
const { requireAuthenticated } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);
router.use((req,res,next)=>{
  if(!['POST','PUT'].includes(req.method)) return next();
  if(req.currentUser.role!=='admin') return res.status(403).json({error:'للمدير فقط / Administrator only'});
  const b=req.body||{};
  if(b.role!==undefined && !['admin','cashier','waiter','kitchen'].includes(b.role)) return res.status(400).json({error:'دور غير صالح / Invalid role'});
  if(b.permissions!==undefined && (!b.permissions || Array.isArray(b.permissions) || typeof b.permissions!=='object' || Object.values(b.permissions).some(v=>typeof v!=='boolean'))) return res.status(400).json({error:'صلاحيات غير صالحة / Invalid permissions'});
  if(b.active!==undefined && ![0,1].includes(b.active)) return res.status(400).json({error:'حالة غير صالحة / Invalid account state'});
  if(b.pin && !/^[0-9]{4,6}$/.test(String(b.pin))) return res.status(400).json({error:'الرمز 4 إلى 6 أرقام / PIN needs 4 to 6 digits'});
  if(b.pin && db.prepare('SELECT id,pin FROM employees WHERE active=1').all().some(e=>String(e.id)!==(req.params.id || req.path.split('/')[1]) && require('../database/db').verifyPin(b.pin,e.pin))) return res.status(409).json({error:'الرمز مستخدم؛ اختر رمزًا مختلفًا / PIN already in use'});
  if(req.method==='PUT') {
    const old=db.prepare('SELECT role,active FROM employees WHERE id=?').get((req.params.id || req.path.split('/')[1]));
    if(!old) return res.status(404).json({error:'الموظف غير موجود / Employee not found'});
    if(old.role==='admin' && old.active && (b.active===0 || (b.role && b.role!=='admin')) && db.prepare("SELECT count(*) n FROM employees WHERE role='admin' AND active=1").get().n<=1) return res.status(409).json({error:'لا يمكن تعطيل آخر مدير / Cannot disable the last administrator'});
  }
  next();
});

// GET Employees: Admins see all; non-admins only see sanitized public list or own profile
router.get('/', (req, res) => {
  const requester = getRequesterInfo(req);
  if (!requester) return res.status(401).json({ error: 'Unauthorized' });

  if (requester.role === 'admin' || requester.permissions.employees) {
    const rows = db.prepare('SELECT id, name, name_en, username, role, permissions, phone, default_floor, default_station, active, max_discount, created_at FROM employees ORDER BY id').all();
    rows.forEach(r => {
      r.permissions = typeof r.permissions === 'string' ? JSON.parse(r.permissions || '{}') : (r.permissions || {});
    });
    return res.json(rows);
  }

  // Non-admin cashier/waiter: only sees active name list for display without sensitive pins/permissions
  const rows = db.prepare('SELECT id, name, name_en, role, default_floor, default_station FROM employees WHERE active=1').all();
  res.json(rows);
});

// Admin-only endpoints for employee management
// Admin-only endpoints for employee management
router.post('/', requireAdmin, (req, res) => {
  const { name, name_en, pin, username, password, role, permissions, phone, default_floor, default_station, max_discount } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
  const cleanUsername = username ? String(username).trim().toLowerCase() : null;
  if (cleanUsername && !/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) return res.status(400).json({ error: 'Invalid username' });
  if (password && (typeof password !== 'string' || password.length < 6)) return res.status(400).json({ error: 'Password must contain at least 6 characters' });

  const floorVal = parseInt(default_floor) || 1;
  const stationVal = default_station || (role === 'waiter' ? 'waiter_mobile' : `cashier_floor${floorVal}`);
  const maxDiscountNew = Math.min(100, Math.max(0, parseFloat(req.body.max_discount) || 100));

  const info = db.prepare('INSERT INTO employees (name, name_en, pin, username, password_hash, role, permissions, phone, default_floor, default_station, max_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    name, name_en || '', hashPin(pin), cleanUsername, password ? hashPin(password) : null, role || 'cashier', JSON.stringify(permissions || { pos: true }), phone || '', floorVal, stationVal, maxDiscountNew
  );
  logAudit(req.currentUser.id, req.currentUser.name, 'create', 'employee', info.lastInsertRowid, `Created Employee: ${name} (${role}) - Floor ${floorVal}`);
  res.json({ id: info.lastInsertRowid });
});

router.put('/:id', requireAdmin, (req, res) => {
  const { name, name_en, pin, username, password, role, permissions, phone, default_floor, default_station, active, max_discount } = req.body;
  const before = db.prepare('SELECT id,name,name_en,username,role,permissions,phone,default_floor,default_station,active,max_discount FROM employees WHERE id=?').get(req.params.id);
  if (!before) return res.status(404).json({ error: 'Employee not found' });
  const floorVal = default_floor !== undefined ? parseInt(default_floor) : undefined;
  const cleanUsername = username === undefined ? undefined : (username ? String(username).trim().toLowerCase() : null);
  if (cleanUsername && !/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) return res.status(400).json({ error: 'Invalid username' });
  if (password && (typeof password !== 'string' || password.length < 6)) return res.status(400).json({ error: 'Password must contain at least 6 characters' });
  const maxDiscountUpd = req.body.max_discount !== undefined ? Math.min(100, Math.max(0, parseFloat(req.body.max_discount) || 0)) : undefined;
  if (pin) {
    db.prepare(`
      UPDATE employees 
      SET token_rev=token_rev+1, name=COALESCE(?, name), 
          name_en=COALESCE(?, name_en), 
          pin=?,
          username=COALESCE(?, username),
          password_hash=COALESCE(?, password_hash),
          role=COALESCE(?, role), 
          permissions=COALESCE(?, permissions), 
          phone=COALESCE(?, phone),
          default_floor=COALESCE(?, default_floor),
          default_station=COALESCE(?, default_station),
          active=COALESCE(?, active),
          max_discount=COALESCE(?, max_discount)
      WHERE id=?
    `).run(name, name_en, hashPin(pin), cleanUsername, password ? hashPin(password) : null, role, permissions ? JSON.stringify(permissions) : null, phone, floorVal, default_station, active, maxDiscountUpd, req.params.id);
  } else {
    db.prepare(`
      UPDATE employees 
      SET token_rev=token_rev+1, name=COALESCE(?, name),
          name_en=COALESCE(?, name_en), 
          username=COALESCE(?, username),
          password_hash=COALESCE(?, password_hash),
          role=COALESCE(?, role), 
          permissions=COALESCE(?, permissions), 
          phone=COALESCE(?, phone),
          default_floor=COALESCE(?, default_floor),
          default_station=COALESCE(?, default_station),
          active=COALESCE(?, active),
          max_discount=COALESCE(?, max_discount)
      WHERE id=?
    `).run(name, name_en, cleanUsername, password ? hashPin(password) : null, role, permissions ? JSON.stringify(permissions) : null, phone, floorVal, default_station, active, maxDiscountUpd, req.params.id);
  }

  require('../socket/socket.handler').revokeUser(req.params.id);
  const after = db.prepare('SELECT id,name,name_en,username,role,permissions,phone,default_floor,default_station,active,max_discount FROM employees WHERE id=?').get(req.params.id);
  logAudit(req.currentUser.id, req.currentUser.name, 'update', 'employee', req.params.id, `Updated Employee: ${name || req.params.id}`, before, after);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.currentUser.id) {
    return res.status(400).json({ error: 'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول' });
  }

  const emp = db.prepare('SELECT id, name, role FROM employees WHERE id=?').get(targetId);
  if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

  // If permanent delete query parameter ?permanent=true is passed
  if (req.query.permanent === 'true') {
    db.prepare('DELETE FROM employees WHERE id=?').run(targetId);
    logAudit(req.currentUser.id, req.currentUser.name, 'delete', 'employee', targetId, `Deleted Employee permanently: ${emp.name} (${emp.role})`);
  } else {
    db.prepare('UPDATE employees SET active=0 WHERE id=?').run(targetId);
    logAudit(req.currentUser.id, req.currentUser.name, 'deactivate', 'employee', targetId, `Deactivated Employee: ${emp.name} (${emp.role})`);
  }
  require('../socket/socket.handler').revokeUser(targetId);
  res.json({ ok: true });
});

module.exports = router;
