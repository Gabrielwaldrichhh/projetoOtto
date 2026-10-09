'use strict';

const express = require('express');
const movementService = require('../services/movementService');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Historico com filtros (periodo, veiculo, placa, condutor, vigilante, status, busca).
router.get('/', (req, res) => {
  res.json(movementService.filterMovements(req.query));
});

// Saidas em aberto - alimenta a tela de REGISTRAR RETORNO.
router.get('/open', (req, res) => {
  res.json(movementService.openMovements());
});

router.get('/:id', (req, res, next) => {
  try {
    const rows = movementService.listAll().filter((m) => m.id === Number(req.params.id));
    if (!rows.length) return res.status(404).json({ error: 'Movimentacao nao encontrada.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/exit', (req, res, next) => {
  try {
    res.status(201).json(movementService.registerExit(req.body || {}, req.user));
  } catch (err) { next(err); }
});

router.post('/:id/return', (req, res, next) => {
  try {
    res.json(movementService.registerReturn(req.params.id, req.body || {}, req.user));
  } catch (err) { next(err); }
});

// Nunca apagamos registros: apenas cancelamos, com motivo e trilha de auditoria.
router.post('/:id/cancel', requireAdmin, (req, res, next) => {
  try {
    res.json(movementService.cancelMovement(req.params.id, (req.body || {}).reason, req.user));
  } catch (err) { next(err); }
});

module.exports = router;
