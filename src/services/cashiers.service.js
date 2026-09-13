// Cashier ownership boundary shared by shifts, sales reports, and daily closing.
const { db } = require('../database/db');

function listCashiers(includeInactive = false) {
  const sql = includeInactive ? 'SELECT * FROM cashiers ORDER BY code' : 'SELECT * FROM cashiers WHERE active=1 ORDER BY code';
  return db.prepare(sql).all();
}

function getCashier(id) {
  return db.prepare('SELECT * FROM cashiers WHERE id=?').get(id) || null;
}

function createCashier({ code, name, name_en = '' }) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{0,15}$/.test(cleanCode)) throw new Error('رمز الكاشير غير صالح / Invalid cashier code');
  if (!String(name || '').trim()) throw new Error('اسم الكاشير مطلوب / Cashier name is required');
  const result = db.prepare('INSERT INTO cashiers(code,name,name_en) VALUES (?,?,?)').run(cleanCode, String(name).trim(), String(name_en || '').trim());
  return getCashier(result.lastInsertRowid);
}

function updateCashier(id, { code, name, name_en, active }) {
  const current = getCashier(id);
  if (!current) throw new Error('الكاشير غير موجود / Cashier not found');
  const nextCode = code === undefined ? current.code : String(code).trim().toUpperCase();
  const nextName = name === undefined ? current.name : String(name).trim();
  if (!/^[A-Z][A-Z0-9_-]{0,15}$/.test(nextCode) || !nextName) throw new Error('بيانات الكاشير غير صالحة / Invalid cashier data');
  db.prepare('UPDATE cashiers SET code=?,name=?,name_en=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(nextCode, nextName, name_en === undefined ? current.name_en : String(name_en || '').trim(), active === undefined ? current.active : (active ? 1 : 0), id);
  return getCashier(id);
}

module.exports = { listCashiers, getCashier, createCashier, updateCashier };
