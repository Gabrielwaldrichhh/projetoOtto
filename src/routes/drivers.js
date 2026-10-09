'use strict';

const express = require('express');
const store = require('../data/store');
const audit = require('../services/auditService');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { AppError } = require('../services/errors');

const router = express.Router();
router.use(authenticate);

function validate(payload, { id } = {}) {
  const name = String(payload.name || '').trim();
  const registration = String(payload.registration || '').trim();
  if (!name) throw new AppError('Informe o nome do condutor.');
  if (!registration) throw new AppError('Informe a matricula.');

  const duplicated = store.all('drivers').find((d) => d.registration === registration && d.id !== Number(id));
  if (duplicated) throw new AppError('Ja existe um condutor com esta matricula.');

  return {
    name,
    registration,
    department: String(payload.department || '').trim(),
    position: String(payload.position || '').trim(),
    phone: String(payload.phone || '').trim(),
  };
}

router.get('/', (req, res) => {
  let rows = store.all('drivers').slice().sort((a, b) => a.name.localeCompare(b.name));
  if (req.query.active === 'true') rows = rows.filter((d) => d.active);
  res.json(rows);
});

// Cadastro rapido durante o registro de saida: qualquer usuario autenticado pode criar.
router.post('/', (req, res, next) => {
  try {
    const data = validate(req.body || {});
    const driver = store.insert('drivers', { ...data, active: true });
    audit.log({ userId: req.user.id, action: 'CRIAR', entity: 'drivers', entityId: driver.id, description: `Condutor ${driver.name} cadastrado.` });
    res.status(201).json(driver);
  } catch (err) { next(err); }
});

router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const existing = store.find('drivers', req.params.id);
    if (!existing) throw new AppError('Condutor nao encontrado.', 404);
    const data = validate(req.body || {}, { id: existing.id });
    const driver = store.update('drivers', existing.id, data);
    audit.log({ userId: req.user.id, action: 'EDITAR', entity: 'drivers', entityId: driver.id, description: `Condutor ${driver.name} atualizado.` });
    res.json(driver);
  } catch (err) { next(err); }
});

router.patch('/:id/toggle', requireAdmin, (req, res, next) => {
  try {
    const driver = store.find('drivers', req.params.id);
    if (!driver) throw new AppError('Condutor nao encontrado.', 404);
    const updated = store.update('drivers', driver.id, { active: !driver.active });
    audit.log({ userId: req.user.id, action: updated.active ? 'ATIVAR' : 'INATIVAR', entity: 'drivers', entityId: driver.id, description: `Condutor ${driver.name} ${updated.active ? 'ativado' : 'inativado'}.` });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
