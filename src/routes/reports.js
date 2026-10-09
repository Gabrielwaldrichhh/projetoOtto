'use strict';

const express = require('express');
const reportService = require('../services/reportService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json(reportService.build(req.query));
});

router.get('/export.csv', (req, res) => {
  const { rows } = reportService.build(req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="movimentacoes-${stamp}.csv"`);
  res.send(reportService.toCsv(rows));
});

module.exports = router;
