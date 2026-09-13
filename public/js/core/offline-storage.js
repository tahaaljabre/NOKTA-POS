/**
 * OfflineStorage — local SQLite database for offline POS operation.
 * Uses @capacitor-community/sqlite in the Android app,
 * falls back to IndexedDB in the browser.
 */
const OfflineStorage = (() => {
  const DB_NAME = 'nokta_pos_offline';
  const DB_VERSION = 1;
  let db = null;
  let isCapacitor = false;
  let sqlite = null;

  const TABLES = [
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT DEFAULT '',
      icon TEXT DEFAULT '📁',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      category_id INTEGER,
      name TEXT NOT NULL,
      name_en TEXT DEFAULT '',
      price REAL DEFAULT 0,
      price2 REAL DEFAULT 0,
      price3 REAL DEFAULT 0,
      price4 REAL DEFAULT 0,
      sku TEXT DEFAULT '',
      unit TEXT DEFAULT 'piece',
      image TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS modifiers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT DEFAULT '',
      price REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS item_modifiers (
      item_id INTEGER,
      modifier_id INTEGER,
      PRIMARY KEY (item_id, modifier_id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS tables_pos (
      id INTEGER PRIMARY KEY,
      number INTEGER NOT NULL,
      name TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'free',
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      pin TEXT DEFAULT '',
      role TEXT DEFAULT 'cashier',
      permissions TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS cashiers (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS offline_orders (
      local_id INTEGER PRIMARY KEY AUTOINCREMENT,
      offline_id TEXT UNIQUE,
      server_id INTEGER,
      employee_id INTEGER,
      employee_name TEXT DEFAULT '',
      table_id INTEGER DEFAULT 0,
      table_number INTEGER DEFAULT 0,
      order_type TEXT DEFAULT 'dine_in',
      items TEXT DEFAULT '[]',
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      payment_method TEXT DEFAULT 'cash',
      created_at TEXT,
      synced INTEGER DEFAULT 0,
      synced_at INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      data TEXT,
      created_at TEXT,
      synced INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER,
      employee_name TEXT DEFAULT '',
      opened_at TEXT,
      closed_at TEXT,
      opening_cash REAL DEFAULT 0,
      closing_cash REAL DEFAULT 0,
      status TEXT DEFAULT 'open',
      synced_at INTEGER DEFAULT 0
    )`
  ];

  async function init() {
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Sqlite) {
        isCapacitor = true;
        sqlite = window.Capacitor.Plugins.Sqlite;
        const conn = await sqlite.createConnection({ database: DB_NAME, version: DB_VERSION });
        db = conn;
        await db.open();
        for (const sql of TABLES) {
          await db.execute(sql);
        }
        console.log('[OfflineStorage] SQLite initialized');
        return true;
      }
    } catch (e) {
      console.warn('[OfflineStorage] SQLite not available, falling back to IndexedDB', e);
    }
    return initIndexedDB();
  }

  function initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const idb = e.target.result;
        const storeNames = ['categories', 'items', 'modifiers', 'item_modifiers', 'settings',
          'tables_pos', 'employees', 'cashiers', 'offline_orders', 'sync_log', 'shifts'];
        for (const name of storeNames) {
          if (!idb.objectStoreNames.contains(name)) {
            const opts = name === 'offline_orders' || name === 'sync_log'
              ? { keyPath: 'local_id', autoIncrement: true }
              : { keyPath: 'id' };
            idb.createObjectStore(name, opts);
          }
        }
      };
      request.onsuccess = (e) => { db = e.target.result; resolve(true); };
      request.onerror = () => { reject(request.error); };
    });
  }

  async function isReady() { return db !== null; }
  async function isNative() { return isCapacitor; }

  async function getAll(table) {
    if (isCapacitor && db) {
      const result = await db.query(`SELECT * FROM ${table}`);
      return result.values || [];
    }
    return idbGetAll(table);
  }

  async function getById(table, id) {
    if (isCapacitor && db) {
      const result = await db.query(`SELECT * FROM ${table} WHERE id=?`, [id]);
      return (result.values && result.values[0]) || null;
    }
    return idbGetById(table, id);
  }

  async function upsert(table, record) {
    if (isCapacitor && db) {
      const keys = Object.keys(record);
      const vals = keys.map(k => record[k]);
      const placeholders = keys.map(() => '?').join(',');
      const updates = keys.map(k => `${k}=excluded.${k}`).join(',');
      await db.run(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        vals
      );
      return true;
    }
    return idbUpsert(table, record);
  }

  async function upsertMany(table, records) {
    if (isCapacitor && db) {
      for (const rec of records) await upsert(table, rec);
      return true;
    }
    for (const rec of records) await idbUpsert(table, rec);
    return true;
  }

  async function remove(table, id) {
    if (isCapacitor && db) {
      await db.run(`DELETE FROM ${table} WHERE id=?`, [id]);
      return true;
    }
    return idbRemove(table, id);
  }

  async function runRaw(sql, params) {
    if (isCapacitor && db) {
      return await db.run(sql, params || []);
    }
    return null;
  }

  async function queryRaw(sql, params) {
    if (isCapacitor && db) {
      const result = await db.query(sql, params || []);
      return result.values || [];
    }
    return [];
  }

  async function syncFromServer(data) {
    const tx = ['categories', 'items', 'modifiers', 'settings', 'tables_pos', 'cashiers'];
    for (const table of tx) {
      if (data[table] && Array.isArray(data[table])) {
        await upsertMany(table, data[table]);
      }
    }
    if (data.item_modifiers) {
      if (isCapacitor && db) {
        await db.execute('DELETE FROM item_modifiers');
      }
      await upsertMany('item_modifiers', data.item_modifiers);
    }
    return { synced: true, timestamp: Date.now() };
  }

  async function saveOfflineOrder(order) {
    const offlineId = `offline_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const record = {
      offline_id: offlineId,
      server_id: 0,
      employee_id: order.employee_id || 0,
      employee_name: order.employee_name || '',
      table_id: order.table_id || 0,
      table_number: order.table_number || 0,
      order_type: order.order_type || 'dine_in',
      items: JSON.stringify(order.items || []),
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      discount: order.discount || 0,
      total: order.total || 0,
      status: order.status || 'pending',
      payment_method: order.payment_method || 'cash',
      created_at: new Date().toISOString(),
      synced: 0
    };
    if (isCapacitor && db) {
      const keys = Object.keys(record);
      const vals = keys.map(k => record[k]);
      await db.run(
        `INSERT INTO offline_orders (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        vals
      );
    } else {
      await idbInsert('offline_orders', record);
    }
    return offlineId;
  }

  async function getUnsyncedOrders() {
    if (isCapacitor && db) {
      const result = await db.query('SELECT * FROM offline_orders WHERE synced=0');
      return result.values || [];
    }
    const all = await idbGetAll('offline_orders');
    return all.filter(o => o.synced === 0);
  }

  async function markOrderSynced(offlineId, serverId) {
    if (isCapacitor && db) {
      await db.run('UPDATE offline_orders SET synced=1, server_id=?, synced_at=? WHERE offline_id=?',
        [serverId, Date.now(), offlineId]);
    } else {
      const all = await idbGetAll('offline_orders');
      const order = all.find(o => o.offline_id === offlineId);
      if (order) {
        order.synced = 1;
        order.server_id = serverId;
        order.synced_at = Date.now();
        await idbUpsert('offline_orders', order);
      }
    }
  }

  async function getSettings() {
    const rows = await getAll('settings');
    const obj = {};
    for (const r of rows) obj[r.key] = r.value;
    return obj;
  }

  async function setSetting(key, value) {
    return upsert('settings', { key, value, synced_at: Date.now() });
  }

  async function clearAll() {
    const tables = ['categories', 'items', 'modifiers', 'item_modifiers', 'settings',
      'tables_pos', 'employees', 'cashiers', 'offline_orders', 'sync_log', 'shifts'];
    if (isCapacitor && db) {
      for (const t of tables) await db.execute(`DELETE FROM ${t}`);
    } else {
      for (const t of tables) idbClear(t);
    }
  }

  function idbGetAll(store) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbGetById(store, id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  function idbUpsert(store, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  function idbInsert(store, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).add(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  function idbRemove(store, id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
  function idbClear(store) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    init, isReady, isNative,
    getAll, getById, upsert, upsertMany, remove,
    runRaw, queryRaw,
    syncFromServer,
    saveOfflineOrder, getUnsyncedOrders, markOrderSynced,
    getSettings, setSetting, clearAll
  };
})();

if (typeof module !== 'undefined') module.exports = OfflineStorage;
