'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../data/store');
const audit = require('../services/auditService');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { AppError } = require('../services/errors');

const router = express.Router();
router.use(authenticate);

const publicFields = ({ id, name, username, role, registration, active, created_at }) =>
  ({ id, name, username, role, registration, active, created_at });

// Lista usada tambem para preencher selects de vigilante; nunca expoe o hash.
router.get('/', (req, res) => {
  let rows = store.all('users').slice().sort((a, b) => a.name.localeCompare(b.name));
  if (req.query.role) rows = rows.filter((u) => u.role === req.query.role);
  if (req.query.active === 'true') rows = rows.filter((u) => u.active);
  res.json(rows.map(publicFields));
});

router.post('/', requireAdmin, (req, res, next) => {
  try {
    const payload = req.body || {};
    const name = String(payload.name || '').trim();
    const username = String(payload.username || '').trim().toLowerCase();
    const password = String(payload.password || '');
    const role = payload.role === 'ADMIN' ? 'ADMIN' : 'VIGILANTE';

    if (!name) throw new AppError('Informe o nome completo.');
    if (!username) throw new AppError('Informe o usuario de acesso.');
    if (password.length < 6) throw new AppError('A senha deve ter ao menos 6 caracteres.');
    if (store.all('users').some((u) => u.username === username)) throw new AppError('Este usuario ja existe.');

    const user = store.insert('users', {
      name,
      username,
      password_hash: bcrypt.hashSync(password, 10),
      role,
      registration: String(payload.registration || '').trim(),
      active: true,
    });
    audit.log({ userId: req.user.id, action: 'CRIAR', entity: 'users', entityId: user.id, description: `Usuario ${user.name} (${user.role}) cadastrado.` });
    res.status(201).json(publicFields(user));
  } catch (err) { next(err); }
});

router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const existing = store.find('users', req.params.id);
    if (!existing) throw new AppError('Usuario nao encontrado.', 404);

    const payload = req.body || {};
    const changes = {
      name: String(payload.name || existing.name).trim(),
      registration: String(payload.registration == null ? existing.registration : payload.registration).trim(),
      role: payload.role === 'ADMIN' ? 'ADMIN' : 'VIGILANTE',
    };
    if (payload.password) {
      if (String(payload.password).length < 6) throw new AppError('A senha deve ter ao menos 6 caracteres.');
      changes.password_hash = bcrypt.hashSync(String(payload.password), 10);
    }

    const user = store.update('users', existing.id, changes);
    audit.log({ userId: req.user.id, action: 'EDITAR', entity: 'users', entityId: user.id, description: `Usuario ${user.name} atualizado.` });
    res.json(publicFields(user));
  } catch (err) { next(err); }
});

router.patch('/:id/toggle', requireAdmin, (req, res, next) => {
  try {
    const user = store.find('users', req.params.id);
    if (!user) throw new AppError('Usuario nao encontrado.', 404);
    if (user.id === req.user.id) throw new AppError('Voce nao pode inativar o proprio usuario.');

    const updated = store.update('users', user.id, { active: !user.active });
    audit.log({ userId: req.user.id, action: updated.active ? 'ATIVAR' : 'INATIVAR', entity: 'users', entityId: user.id, description: `Usuario ${user.name} ${updated.active ? 'ativado' : 'inativado'}.` });
    res.json(publicFields(updated));
  } catch (err) { next(err); }
});

module.exports = router;
