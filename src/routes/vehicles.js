'use strict';

const express = require('express');
const store = require('../data/store');
const audit = require('../services/auditService');
const movementService = require('../services/movementService');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { AppError } = require('../services/errors');

const router = express.Router();
router.use(authenticate);

const VALID_STATUS = ['DISPONIVEL', 'FORA', 'INATIVO'];

function normalizePlate(plate) {
  return String(plate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function validate(payload, { id } = {}) {
  const code = String(payload.code || '').trim();
  const plate = normalizePlate(payload.plate);
  if (!code) throw new AppError('Informe o prefixo/identificacao do veiculo.');
  if (!plate) throw new AppError('Informe a placa.');
  if (!String(payload.model || '').trim()) throw new AppError('Informe o modelo.');

  const km = Number(payload.current_km);
  if (!Number.isFinite(km) || km < 0) throw new AppError('KM atual invalida.');

  const duplicated = store.all('vehicles').find((v) => normalizePlate(v.plate) === plate && v.id !== Number(id));
  if (duplicated) throw new AppError('Ja existe um veiculo com esta placa.');

  return {
    code,
    brand: String(payload.brand || '').trim(),
    model: String(payload.model).trim(),
    plate,
    year: payload.year ? Number(payload.year) : null,
    current_km: Math.trunc(km),
  };
}

router.get('/', (req, res) => {
  let rows = store.all('vehicles').slice().sort((a, b) => a.code.localeCompare(b.code));
  if (req.query.status) rows = rows.filter((v) => v.status === req.query.status);
  if (req.query.available === 'true') rows = rows.filter((v) => v.active && v.status === 'DISPONIVEL');
  res.json(rows);
});

router.get('/:id/history', (req, res) => {
  const vehicle = store.find('vehicles', req.params.id);
  if (!vehicle) return res.status(404).json({ error: 'Veiculo nao encontrado.' });
  res.json(movementService.listAll().filter((m) => m.vehicle_id === vehicle.id));
});

router.post('/', requireAdmin, (req, res, next) => {
  try {
    const data = validate(req.body || {});
    const vehicle = store.insert('vehicles', { ...data, status: 'DISPONIVEL', active: true });
    audit.log({ userId: req.user.id, action: 'CRIAR', entity: 'vehicles', entityId: vehicle.id, description: `Veiculo ${vehicle.code} cadastrado.` });
    res.status(201).json(vehicle);
  } catch (err) { next(err); }
});

router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const existing = store.find('vehicles', req.params.id);
    if (!existing) throw new AppError('Veiculo nao encontrado.', 404);
    if (existing.status === 'FORA') throw new AppError('Nao e possivel editar um veiculo que esta fora.');

    const data = validate(req.body || {}, { id: existing.id });
    const status = VALID_STATUS.includes(req.body.status) ? req.body.status : existing.status;
    if (status === 'FORA') throw new AppError('O status FORA e definido automaticamente ao registrar uma saida.');

    const vehicle = store.update('vehicles', existing.id, { ...data, status, active: status !== 'INATIVO' });
    audit.log({ userId: req.user.id, action: 'EDITAR', entity: 'vehicles', entityId: vehicle.id, description: `Veiculo ${vehicle.code} atualizado.` });
    res.json(vehicle);
  } catch (err) { next(err); }
});

router.patch('/:id/toggle', requireAdmin, (req, res, next) => {
  try {
    const vehicle = store.find('vehicles', req.params.id);
    if (!vehicle) throw new AppError('Veiculo nao encontrado.', 404);
    if (vehicle.status === 'FORA') throw new AppError('Veiculo esta fora; registre o retorno antes de inativar.');

    const active = !vehicle.active;
    const updated = store.update('vehicles', vehicle.id, { active, status: active ? 'DISPONIVEL' : 'INATIVO' });
    audit.log({ userId: req.user.id, action: active ? 'ATIVAR' : 'INATIVAR', entity: 'vehicles', entityId: vehicle.id, description: `Veiculo ${vehicle.code} ${active ? 'ativado' : 'inativado'}.` });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
