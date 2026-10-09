'use strict';

const store = require('../data/store');
const movementService = require('./movementService');

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function build() {
  const vehicles = store.all('vehicles');
  const movements = movementService.listAll().filter((m) => m.status !== movementService.STATUS.CANCELED);

  const exitsToday = movements.filter((m) => isToday(m.exit_datetime));
  const returnsToday = movements.filter((m) => isToday(m.return_datetime));
  const kmToday = returnsToday.reduce((sum, m) => sum + (m.km_driven || 0), 0);

  const outside = movementService.openMovements().map((m) => ({
    ...m,
    minutes_out: Math.max(0, Math.round((Date.now() - new Date(m.exit_datetime).getTime()) / 60000)),
  }));

  return {
    cards: {
      available: vehicles.filter((v) => v.active && v.status === 'DISPONIVEL').length,
      outside: vehicles.filter((v) => v.status === 'FORA').length,
      inactive: vehicles.filter((v) => !v.active || v.status === 'INATIVO').length,
      exits_today: exitsToday.length,
      returns_today: returnsToday.length,
      km_today: kmToday,
    },
    outside,
  };
}

module.exports = { build };
