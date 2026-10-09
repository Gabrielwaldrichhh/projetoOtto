'use strict';

const store = require('../data/store');
const audit = require('./auditService');
const { AppError } = require('./errors');

const STATUS = { OPEN: 'ABERTA', CLOSED: 'FINALIZADA', CANCELED: 'CANCELADA' };

function parseKm(value, label) {
  const km = Number(value);
  if (!Number.isFinite(km)) throw new AppError(`${label} invalida.`);
  if (km < 0) throw new AppError(`${label} nao pode ser negativa.`);
  return Math.trunc(km);
}

/** Enriquecer a movimentacao com nomes de veiculo/condutor/vigilantes. */
function hydrate(movement) {
  const vehicle = store.find('vehicles', movement.vehicle_id);
  const driver = store.find('drivers', movement.driver_id);
  const exitGuard = store.find('users', movement.exit_guard_id);
  const returnGuard = movement.return_guard_id ? store.find('users', movement.return_guard_id) : null;

  return {
    ...movement,
    vehicle_code: vehicle ? vehicle.code : '-',
    vehicle_label: vehicle ? `${vehicle.brand} ${vehicle.model}` : '-',
    plate: vehicle ? vehicle.plate : '-',
    driver_name: driver ? driver.name : '-',
    exit_guard_name: exitGuard ? exitGuard.name : '-',
    return_guard_name: returnGuard ? returnGuard.name : null,
  };
}

function listAll() {
  return store.all('movements').slice().sort((a, b) => b.id - a.id).map(hydrate);
}

function openMovements() {
  return listAll().filter((m) => m.status === STATUS.OPEN);
}

function registerExit(payload, currentUser) {
  const vehicle = store.find('vehicles', payload.vehicle_id);
  if (!vehicle) throw new AppError('Veiculo nao encontrado.', 404);
  if (!vehicle.active || vehicle.status === 'INATIVO') throw new AppError('Veiculo inativo nao pode sair.');
  if (vehicle.status === 'FORA') throw new AppError('Veiculo ja esta fora.');

  const driver = store.find('drivers', payload.driver_id);
  if (!driver) throw new AppError('Condutor nao encontrado.', 404);
  if (!driver.active) throw new AppError('Condutor inativo.');

  // O vigilante da saida e sempre o usuario logado (evita escolha manual).
  const guard = currentUser;

  const exitKm = parseKm(payload.exit_km, 'KM de saida');
  if (exitKm < vehicle.current_km) {
    throw new AppError(`KM de saida (${exitKm}) nao pode ser menor que o KM atual do veiculo (${vehicle.current_km}).`);
  }

  const destination = String(payload.destination || '').trim();
  if (!destination) throw new AppError('Informe o motivo/destino da saida.');

  const movement = store.insert('movements', {
    vehicle_id: vehicle.id,
    driver_id: driver.id,
    exit_km: exitKm,
    return_km: null,
    km_driven: null,
    exit_datetime: store.now(), // data/hora sempre do servidor
    return_datetime: null,
    exit_guard_id: guard.id,
    return_guard_id: null,
    destination,
    exit_notes: String(payload.exit_notes || '').trim(),
    return_notes: null,
    status: STATUS.OPEN,
    canceled_reason: null,
  });

  store.update('vehicles', vehicle.id, { status: 'FORA', current_km: exitKm });

  audit.log({
    userId: guard.id,
    action: 'SAIDA',
    entity: 'movements',
    entityId: movement.id,
    description: `Saida do veiculo ${vehicle.code} (${vehicle.plate}) com ${driver.name}, KM ${exitKm}.`,
  });

  return hydrate(movement);
}

function registerReturn(movementId, payload, currentUser) {
  const movement = store.find('movements', movementId);
  if (!movement) throw new AppError('Movimentacao nao encontrada.', 404);
  if (movement.status === STATUS.CLOSED) throw new AppError('Esta saida ja teve o retorno registrado.');
  if (movement.status === STATUS.CANCELED) throw new AppError('Movimentacao cancelada.');

  const returnKm = parseKm(payload.return_km, 'KM de retorno');
  if (returnKm < movement.exit_km) {
    throw new AppError(`KM de retorno (${returnKm}) nao pode ser menor que o KM de saida (${movement.exit_km}).`);
  }

  const guard = currentUser;
  const kmDriven = returnKm - movement.exit_km;

  store.update('movements', movement.id, {
    return_km: returnKm,
    km_driven: kmDriven,
    return_datetime: store.now(),
    return_guard_id: guard.id,
    return_notes: String(payload.return_notes || '').trim(),
    status: STATUS.CLOSED,
  });

  const vehicle = store.find('vehicles', movement.vehicle_id);
  if (vehicle) store.update('vehicles', vehicle.id, { status: 'DISPONIVEL', current_km: returnKm });

  audit.log({
    userId: guard.id,
    action: 'RETORNO',
    entity: 'movements',
    entityId: movement.id,
    description: `Retorno do veiculo ${vehicle ? vehicle.code : movement.vehicle_id}, KM ${returnKm}, ${kmDriven} km percorridos.`,
  });

  return hydrate(store.find('movements', movement.id));
}

function cancelMovement(movementId, reason, currentUser) {
  const movement = store.find('movements', movementId);
  if (!movement) throw new AppError('Movimentacao nao encontrada.', 404);
  if (movement.status === STATUS.CANCELED) throw new AppError('Movimentacao ja esta cancelada.');
  const motive = String(reason || '').trim();
  if (!motive) throw new AppError('Informe o motivo do cancelamento.');

  const wasOpen = movement.status === STATUS.OPEN;
  store.update('movements', movement.id, { status: STATUS.CANCELED, canceled_reason: motive });

  // Saida em aberto cancelada devolve o veiculo para disponivel e desfaz o KM.
  const vehicle = store.find('vehicles', movement.vehicle_id);
  if (wasOpen && vehicle) {
    store.update('vehicles', vehicle.id, { status: 'DISPONIVEL' });
  }

  audit.log({
    userId: currentUser.id,
    action: 'CANCELAMENTO',
    entity: 'movements',
    entityId: movement.id,
    description: `Movimentacao #${movement.id} cancelada. Motivo: ${motive}`,
  });

  return hydrate(store.find('movements', movement.id));
}

function filterMovements(query) {
  let rows = listAll();
  const { start, end, vehicle_id, plate, driver_id, guard_id, status, search } = query;

  if (start) {
    const from = new Date(`${start}T00:00:00`);
    rows = rows.filter((m) => new Date(m.exit_datetime) >= from);
  }
  if (end) {
    const to = new Date(`${end}T23:59:59`);
    rows = rows.filter((m) => new Date(m.exit_datetime) <= to);
  }
  if (vehicle_id) rows = rows.filter((m) => m.vehicle_id === Number(vehicle_id));
  if (driver_id) rows = rows.filter((m) => m.driver_id === Number(driver_id));
  if (guard_id) {
    const gid = Number(guard_id);
    rows = rows.filter((m) => m.exit_guard_id === gid || m.return_guard_id === gid);
  }
  if (status) rows = rows.filter((m) => m.status === status);
  if (plate) {
    const p = plate.toLowerCase();
    rows = rows.filter((m) => (m.plate || '').toLowerCase().includes(p));
  }
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((m) =>
      [m.vehicle_code, m.vehicle_label, m.plate, m.driver_name, m.destination, m.exit_guard_name, m.return_guard_name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(s))
    );
  }
  return rows;
}

module.exports = {
  STATUS,
  hydrate,
  listAll,
  openMovements,
  registerExit,
  registerReturn,
  cancelMovement,
  filterMovements,
};
