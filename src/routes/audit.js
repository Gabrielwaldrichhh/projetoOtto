'use strict';

const express = require('express');
const audit = require('../services/auditService');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', (req, res) => {
  res.json(audit.list());
});

module.exports = router;
