'use strict';

const movementService = require('./movementService');

function build(query) {
  const rows = movementService
    .filterMovements(query)
    .filter((m) => m.status !== movementService.STATUS.CANCELED);

  const finished = rows.filter((m) => m.status === movementService.STATUS.CLOSED);
  const totalKm = finished.reduce((sum, m) => sum + (m.km_driven || 0), 0);

  const byVehicle = new Map();
  rows.forEach((m) => {
    const key = `${m.vehicle_code} - ${m.plate}`;
    const entry = byVehicle.get(key) || { vehicle: key, trips: 0, km: 0 };
    entry.trips += 1;
    entry.km += m.km_driven || 0;
    byVehicle.set(key, entry);
  });

  const byDriver = new Map();
  rows.forEach((m) => {
    const entry = byDriver.get(m.driver_name) || { driver: m.driver_name, trips: 0, km: 0 };
    entry.trips += 1;
    entry.km += m.km_driven || 0;
    byDriver.set(m.driver_name, entry);
  });

  return {
    summary: {
      exits: rows.length,
      returns: finished.length,
      open: rows.filter((m) => m.status === movementService.STATUS.OPEN).length,
      total_km: totalKm,
      avg_km: finished.length ? Math.round((totalKm / finished.length) * 10) / 10 : 0,
    },
    top_vehicles: [...byVehicle.values()].sort((a, b) => b.trips - a.trips).slice(0, 10),
    top_drivers: [...byDriver.values()].sort((a, b) => b.trips - a.trips).slice(0, 10),
    rows,
  };
}

function toCsv(rows) {
  const header = [
    'ID', 'Data Saida', 'Hora Saida', 'Veiculo', 'Placa', 'Condutor', 'Destino',
    'KM Saida', 'KM Retorno', 'KM Percorridos', 'Data Retorno', 'Hora Retorno',
    'Vigilante Saida', 'Vigilante Retorno', 'Status',
  ];

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

  const lines = rows.map((m) => [
    m.id, fmtDate(m.exit_datetime), fmtTime(m.exit_datetime), `${m.vehicle_code} ${m.vehicle_label}`,
    m.plate, m.driver_name, m.destination, m.exit_km, m.return_km == null ? '' : m.return_km,
    m.km_driven == null ? '' : m.km_driven, fmtDate(m.return_datetime), fmtTime(m.return_datetime),
    m.exit_guard_name, m.return_guard_name || '', m.status,
  ].map(esc).join(';'));

  // BOM para o Excel abrir acentos corretamente
  return '\uFEFF' + [header.map(esc).join(';'), ...lines].join('\r\n');
}

module.exports = { build, toCsv };
