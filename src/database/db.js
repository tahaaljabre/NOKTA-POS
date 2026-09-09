const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config/app.config');
const { schemaQueries } = require('./schema');
const { runMigrations } = require('./migrations');

if (!fs.existsSync(config.dbDir)) {
  fs.mkdirSync(config.dbDir, { recursive: true });
}

let _sqlDb = null;

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPin(pin, stored) {
  if (typeof stored !== 'string') return false;
  if (stored.startsWith('scrypt$')) {
    const [, salt, expected] = stored.split('$');
    if (!salt || !/^[a-f0-9]{64}$/i.test(expected || '')) return false;
    const actual = crypto.scryptSync(String(pin), salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  }
  const actual = crypto.createHash('sha256').update(String(pin)).digest('hex');
  return actual.length === stored.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(stored));
}

const db = {
  prepare(sql) {
    const normalizeParams = (params) => {
      if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) return params[0];
      let flat = [];
      for (const p of params) {
        if (Array.isArray(p)) flat.push(...p);
        else flat.push(p);
      }
      return flat.map(p => (p === undefined ? null : p));
    };

    const stmt = _sqlDb.prepare(sql);

    return {
      run(...params) {
        const safeParams = normalizeParams(params);
        return Array.isArray(safeParams) ? stmt.run(...safeParams) : stmt.run(safeParams);
      },
      get(...params) {
        const safeParams = normalizeParams(params);
        return Array.isArray(safeParams) ? stmt.get(...safeParams) : stmt.get(safeParams);
      },
      all(...params) {
        const safeParams = normalizeParams(params);
        return Array.isArray(safeParams) ? stmt.all(...safeParams) : stmt.all(safeParams);
      }
    };
  },
  transaction(fn) {
    return (...args) => {
      _sqlDb.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(...args);
        _sqlDb.exec('COMMIT');
        return result;
      } catch (error) {
        try { _sqlDb.exec('ROLLBACK'); } catch (_) {}
        throw error;
      }
    };
  },
  exec(sql) {
    return _sqlDb.exec(sql);
  },
  getRawDb() {
    return _sqlDb;
  }
};

async function initDatabase() {
  // Persistent signing key survives server restarts; test databases never write one.
  if(config.dbPath!==':memory:' && !process.env.JWT_SECRET) {
    const keyPath=require('path').join(config.dbDir,'.session-key');
    try {fs.writeFileSync(keyPath,crypto.randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}
    catch(e){if(e.code!=='EEXIST')throw e;}
    config.jwtSecret=fs.readFileSync(keyPath,'utf8').trim();
    if(config.jwtSecret.length<32)throw new Error('Invalid session signing key');
  }
  _sqlDb = new DatabaseSync(config.dbPath);
  
  // Enable WAL mode for better performance and concurrency
  if (config.dbPath !== ':memory:') _sqlDb.exec('PRAGMA journal_mode = WAL');
  _sqlDb.exec('PRAGMA foreign_keys = ON');

  // Execute Schema
  for (const query of schemaQueries) {
    try {
      _sqlDb.exec(query);
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate column')) {
        console.error('Schema init error:', e.message);
      }
    }
  }

  // Run dynamic migrations
  try {
    runMigrations(db); // Note: we pass the wrapper 'db', check how runMigrations uses it.
    // wait, the old code passed _sqlDb to runMigrations, but runMigrations used try/catch. Let's pass _sqlDb.
  } catch (e) {
    console.error('Migration error:', e.message);
  }

  // Seed default data only if the whole database is genuinely empty. A clean
  // demo can intentionally keep its menu and tables while having no employees.
  if (db.prepare('SELECT id FROM employees LIMIT 1').get()) db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('setup_complete','1')").run();
  const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get();
  const categoryCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  const tableCount = db.prepare('SELECT COUNT(*) as c FROM "tables"').get();
  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM settings').get();
  const isBrandNew = empCount?.c === 0 && categoryCount?.c === 0 && tableCount?.c === 0 && settingsCount?.c === 0;
  if (isBrandNew) {
    const cats = [
      ['المشروبات', 'Drinks', '🥤', 1],
      ['الأطباق الرئيسية', 'Main Dishes', '🍽️', 2],
      ['المقبلات', 'Appetizers', '🥗', 3],
      ['الحلويات', 'Desserts', '🍰', 4],
    ];
    const seedItems = [
      [['شاي أحمر', 'Red Tea', 2], ['قهوة عربية', 'Arabic Coffee', 3], ['عصير برتقال', 'Orange Juice', 5], ['ماء معدني', 'Mineral Water', 1]],
      [['مندي لحم', 'Mandi Lamb', 35], ['برياني دجاج', 'Chicken Biryani', 25], ['كبسة دجاج', 'Kabsa Chicken', 28], ['رز بالدجاج', 'Rice with Chicken', 20]],
      [['سلطة عربية', 'Arabic Salad', 8], ['حمص', 'Hummus', 7], ['فول', 'Foul', 6], ['جبنة', 'Cheese', 5]],
      [['كنافة', 'Kunafa', 12], ['أم علي', 'Om Ali', 10], ['بسبوسة', 'Basbousa', 8]],
    ];

    cats.forEach((c, i) => {
      const info = db.prepare('INSERT INTO categories (name, name_en, icon, sort_order) VALUES (?, ?, ?, ?)').run(c[0], c[1], c[2], c[3]);
      seedItems[i].forEach((item, j) => {
        db.prepare('INSERT INTO items (name, name_en, category_id, price, price2, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(item[0], item[1], info.lastInsertRowid, item[2], null, j + 1);
      });
    });

    for (let i = 1; i <= 10; i++) {
      db.prepare('INSERT INTO "tables" (number, name, capacity) VALUES (?, ?, ?)').run(i, `Table ${i}`, 4);
    }

    [['restaurant_name', 'اسم المنشأة'], ['restaurant_name_en', 'Your Business'],
     ['restaurant_address', ''], ['restaurant_phone', ''],
     ['currency', '฿'], ['tax_rate', '0'], ['receipt_footer', 'شكراً لزيارتكم / Thank you'],
     ['language', 'ar'],
     ['delivery_grab', '0'], ['delivery_lineman', '0'], ['delivery_foodpanda', '0'], ['delivery_shopee', '0'],
     ['payment_cash', '1'], ['payment_promptpay', '0'], ['payment_truemoney', '0'], ['payment_card', '0'],
     ['invoice_retention_days', '365'], ['next_invoice_number', '1']].forEach(s => {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(s[0], s[1]);
    });
  }

  // Ensure dynamic delivery and payment lists exist in settings for existing databases
  const hasPaymentList = db.prepare("SELECT key FROM settings WHERE key='payment_methods_list'").get();
  if (!hasPaymentList) {
    const defaultPayments = JSON.stringify([
      { id: 'cash', name: 'نقدي (Cash)' },
      { id: 'card', name: 'بطاقة (Card)' },
      { id: 'promptpay', name: 'تحويل بنكي (Transfer)' }
    ]);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('payment_methods_list', defaultPayments);
  }

  const hasDeliveryList = db.prepare("SELECT key FROM settings WHERE key='delivery_methods_list'").get();
  if (!hasDeliveryList) {
    const defaultDelivery = JSON.stringify([
      { id: 'grab', name: 'GrabFood' },
      { id: 'lineman', name: 'LINE MAN' },
      { id: 'foodpanda', name: 'Foodpanda' }
    ]);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('delivery_methods_list', defaultDelivery);
  }

  return db;
}

module.exports = { db, initDatabase, hashPin, verifyPin };
