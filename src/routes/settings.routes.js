const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { logAudit } = require('../middleware/audit.middleware');
const { requireAuthenticated, requirePermission } = require('../middleware/auth.middleware');
router.use(requireAuthenticated);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/', requirePermission('settings'), (req, res) => {
  const body=req.body||{};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({error:'بيانات غير صالحة / Invalid request body'});
  const before = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(row => [row.key, row.value]));
  if('setup_complete' in body) return res.status(400).json({error:'إعداد داخلي محمي / Protected internal setting'});
  if(body.tax_rate!==undefined && (!Number.isFinite(Number(body.tax_rate)) || Number(body.tax_rate)<0 || Number(body.tax_rate)>100))return res.status(400).json({error:'الضريبة من 0 إلى 100 / Tax must be 0 to 100'});
  if(body.business_timezone!==undefined){try{new Intl.DateTimeFormat('en',{timeZone:body.business_timezone}).format(new Date());}catch{return res.status(400).json({error:'منطقة زمنية غير صالحة / Invalid time zone'});}}
  if(body.next_invoice_number!==undefined && (!Number.isSafeInteger(Number(body.next_invoice_number)) || Number(body.next_invoice_number)<=db.prepare('SELECT COALESCE(MAX(invoice_number),0) n FROM orders').get().n))return res.status(400).json({error:'العداد يجب أن يتجاوز آخر فاتورة / Counter must exceed the last invoice'});
  for(const key of ['payment_methods_list','delivery_methods_list'])if(body[key]!==undefined){try{const list=JSON.parse(body[key]);if(!Array.isArray(list)||!list.length||list.some(m=>!m||!/^[a-z0-9_]{1,40}$/.test(m.id)||typeof m.name!=='string')||new Set(list.map(m=>m.id)).size!==list.length)throw 0;}catch{return res.status(400).json({error:'قائمة طرق غير صالحة / Invalid methods list'});}}
  const ALLOWED_SETTINGS = new Set([
    'tax_rate','currency','currency_symbol','business_name','business_name_en',
    'business_timezone','receipt_header','receipt_footer','receipt_header_en','receipt_footer_en',
    'payment_methods_list','delivery_methods_list','default_payment_method',
    'printer_ip','printer_port','thermal_printer_enabled','kitchen_printer_enabled',
    'table_mode','order_mode','language'
  ]);
  const filteredBody = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_SETTINGS.has(k)) filteredBody[k] = v;
  }
  if (!Object.keys(filteredBody).length) return res.status(400).json({error:'مفاتيح الإعدادات غير صالحة / Invalid settings keys'});
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  db.transaction(()=>Object.entries(filteredBody).forEach(([k, v]) => {
    stmt.run(k, String(v));
  }))();
  const after = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(row => [row.key, row.value]));
  logAudit(req.currentUser.id, req.currentUser.name, 'update', 'settings', 0, 'Settings updated', before, after);
  res.json({ ok: true });
});

// Audit log endpoint (supports /api/audit and /api/settings/audit)
const handleAuditGet = (req, res) => {
  const { employee_id, action, date, limit } = req.query;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const p = [];
  if (employee_id) { sql += ' AND employee_id=?'; p.push(employee_id); }
  if (action) { sql += ' AND action=?'; p.push(action); }
  if (date) { sql += " AND DATE(created_at)=?"; p.push(date); }
  sql += ' ORDER BY id DESC';
  const lim = Math.max(1,Math.min(500,parseInt(limit)||100));
  sql += ` LIMIT ${lim}`;
  res.json(db.prepare(sql).all(...p));
};

const os = require('os');
const config = require('../config/app.config');

// Network Information endpoint for multi-device connection
router.get('/network', requirePermission('settings'), (req, res) => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ iface: name, address: net.address, url: `http://${net.address}:${config.port}` });
      }
    }
  }
  res.json({
    port: config.port,
    hostname: os.hostname(),
    localUrl: `http://localhost:${config.port}`,
    networkIps: ips,
    primaryUrl: ips.length > 0 ? ips[0].url : `http://localhost:${config.port}`
  });
});

module.exports = router;
module.exports.handleAuditGet = handleAuditGet;
