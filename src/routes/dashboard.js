'use strict';

const express = require('express');
const dashboardService = require('../services/dashboardService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json(dashboardService.build());
});

module.exports = router;
