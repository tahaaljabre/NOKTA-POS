const crypto = require('crypto');
const { db } = require('../database/db');
const config = require('../config/app.config');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', config.jwtSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}
function issueToken(employee) { return sign({ sub: employee.id, rev: db.prepare('SELECT token_rev FROM employees WHERE id=?').get(employee.id)?.token_rev ?? 0, exp: Date.now() + TOKEN_TTL_MS }); }
function verifyToken(token) {
  if (!token || typeof token !== 'string' || token.length > 2048 || token.split('.').length !== 2) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(encoded).digest('base64url');
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); return payload.exp > Date.now() && Number.isInteger(payload.sub) ? payload : null; } catch { return null; }
}
function getRequesterInfo(req) {
  const payload = verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  if (!payload) return null;
  try {
    const emp = db.prepare('SELECT id, name, name_en, role, permissions, default_floor, default_station, active, token_rev, max_discount FROM employees WHERE id=? AND active=1').get(payload.sub);
    if (!emp || emp.token_rev !== payload.rev) return null;
    emp.permissions = typeof emp.permissions === 'string' ? JSON.parse(emp.permissions || '{}') : (emp.permissions || {});
    return emp;
  } catch { return null; }
}
function checkPerm(req, perm) { const emp = getRequesterInfo(req); return !!emp && (emp.role === 'admin' || !!emp.permissions[perm]); }
function requireAuthenticated(req, res, next) {
  const emp = getRequesterInfo(req);
  if (!emp) return res.status(401).json({ error: 'Authentication required' });
  req.currentUser = emp;
  // Preserve compatibility with audit callers while overwriting untrusted client values.
  req.headers['x-employee-id'] = String(emp.id);
  req.headers['x-employee-name'] = emp.name;
  next();
}
function requirePermission(perm) { return (req, res, next) => requireAuthenticated(req, res, () => (req.currentUser.role === 'admin' || req.currentUser.permissions[perm]) ? next() : res.status(403).json({ error: `Missing permission '${perm}'` })); }
function requireAdmin(req, res, next) { return requireAuthenticated(req, res, () => req.currentUser.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access required' })); }
module.exports = { getRequesterInfo, checkPerm, requireAuthenticated, requirePermission, requireAdmin, issueToken, verifyToken };
