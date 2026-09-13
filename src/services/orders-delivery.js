const { db } = require('../database/db');
const { json, error } = require('./orders-validation');

function deliveryAttributes(type, value) {
  const attributes = json(value);
  if (Array.isArray(attributes)) throw error('بيانات التوصيل غير صالحة / Invalid delivery data');
  if (type !== 'delivery') {
    if (attributes.delivery_app_id) throw error('تطبيق التوصيل يتطلب طلب توصيل / Delivery app requires delivery order');
    return { attributes, app: null };
  }
  const id = attributes.delivery_app_id;
  if (!id) return { attributes, app: null };
  let list;
  try { list = JSON.parse(db.prepare("SELECT value FROM settings WHERE key='delivery_methods_list'").get()?.value || '[]'); }
  catch { list = []; }
  const app = list.find(entry => entry.id === id && entry.active !== false);
  if (!app) throw error('تطبيق التوصيل غير متاح / Delivery app unavailable');
  return { attributes: { ...attributes, delivery_app_id: app.id, delivery_app: app.name }, app };
}

module.exports = { deliveryAttributes };
