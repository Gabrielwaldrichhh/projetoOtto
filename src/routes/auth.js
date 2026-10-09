'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../data/store');
const { sign, authenticate } = require('../middleware/auth');
const audit = require('../services/auditService');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Informe usuario e senha.' });

  const user = store.all('users').find((u) => u.username === String(username).trim().toLowerCase());
  if (!user || !user.active || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Usuario ou senha invalidos.' });
  }

  audit.log({ userId: user.id, action: 'LOGIN', entity: 'users', entityId: user.id, description: `Login de ${user.name}.` });

  res.json({
    token: sign(user),
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
});

router.get('/me', authenticate, (req, res) => {
  const { id, name, username, role } = req.user;
  res.json({ id, name, username, role });
});

module.exports = router;
