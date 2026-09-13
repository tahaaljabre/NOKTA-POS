const express = require('express');
const router = express.Router();
const { requireAuthenticated, requireAdmin, requirePermission } = require('../middleware/auth.middleware');
const { listCashiers, createCashier, updateCashier } = require('../services/cashiers.service');
router.use(requireAuthenticated);
router.get('/', (req, res) => res.json(listCashiers(req.currentUser.role === 'admin')));
router.post('/', requirePermission('cashiers'), (req, res) => {
  try { res.json(createCashier(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', requirePermission('cashiers'), (req, res) => {
  try { res.json(updateCashier(Number(req.params.id), req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
module.exports = router;
