const { db } = require('../database/db');

function logAudit(empId, empName, action, entity, entityId, details, oldVal = '', newVal = '', ip = '') {
  try {
    db.prepare(`
      INSERT INTO audit_log (employee_id, employee_name, action, entity, entity_id, details, old_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      empId || 0,
      empName || 'System',
      action,
      entity || '',
      entityId || 0,
      details || '',
      typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal || ''),
      typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal || ''),
      ip || ''
    );
  } catch (e) {
    console.error('Audit logging error:', e.message);
  }
}

module.exports = { logAudit };
