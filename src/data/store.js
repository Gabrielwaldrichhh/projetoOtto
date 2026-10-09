'use strict';

const bcrypt = require('bcryptjs');

/**
 * Store em memoria do MVP.
 * A forma dos registros ja espelha o schema final (users, vehicles, drivers,
 * movements, audit_logs), entao trocar por SQLite/Sequelize depois deve ser
 * so reescrever este arquivo mantendo a mesma interface.
 */
const db = {
  users: [],
  vehicles: [],
  drivers: [],
  movements: [],
  auditLogs: [],
  sequences: { users: 0, vehicles: 0, drivers: 0, movements: 0, auditLogs: 0 },
};

function nextId(table) {
  db.sequences[table] += 1;
  return db.sequences[table];
}

function now() {
  return new Date().toISOString();
}

function insert(table, data) {
  const record = { id: nextId(table), ...data, created_at: now(), updated_at: now() };
  db[table].push(record);
  return record;
}

function update(table, id, changes) {
  const record = db[table].find((row) => row.id === Number(id));
  if (!record) return null;
  Object.assign(record, changes, { updated_at: now() });
  return record;
}

function find(table, id) {
  return db[table].find((row) => row.id === Number(id)) || null;
}

function all(table) {
  return db[table];
}

function seed() {
  const hash = (plain) => bcrypt.hashSync(plain, 10);

  // --- usuarios (admin + vigilantes) ---
  insert('users', {
    name: 'Administrador',
    username: 'admin',
    password_hash: hash('admin123'),
    role: 'ADMIN',
    registration: '0001',
    active: true,
  });
  insert('users', {
    name: 'Joao Pereira',
    username: 'joao',
    password_hash: hash('123456'),
    role: 'VIGILANTE',
    registration: '1001',
    active: true,
  });
  insert('users', {
    name: 'Pedro Santos',
    username: 'pedro',
    password_hash: hash('123456'),
    role: 'VIGILANTE',
    registration: '1002',
    active: true,
  });
  insert('users', {
    name: 'Marcos Lima',
    username: 'marcos',
    password_hash: hash('123456'),
    role: 'VIGILANTE',
    registration: '1003',
    active: true,
  });

  // --- veiculos ---
  const vehicles = [
    { code: 'VTR-01', brand: 'Fiat', model: 'Strada', plate: 'ABC1D23', year: 2022, current_km: 45821 },
    { code: 'VTR-02', brand: 'Volkswagen', model: 'Saveiro', plate: 'DEF4G56', year: 2021, current_km: 78210 },
    { code: 'VTR-03', brand: 'Chevrolet', model: 'Onix', plate: 'GHI7J89', year: 2023, current_km: 20345 },
    { code: 'VTR-04', brand: 'Renault', model: 'Kwid', plate: 'JKL0M12', year: 2020, current_km: 96540 },
    { code: 'VAN-01', brand: 'Mercedes-Benz', model: 'Sprinter', plate: 'MNO3P45', year: 2019, current_km: 152300 },
    { code: 'CAM-01', brand: 'Ford', model: 'Cargo 816', plate: 'PQR6S78', year: 2018, current_km: 210980 },
  ];
  vehicles.forEach((v) => insert('vehicles', { ...v, status: 'DISPONIVEL', active: true }));

  // --- condutores ---
  const drivers = [
    { name: 'Carlos Silva', registration: '2001', department: 'Almoxarifado', position: 'Auxiliar', phone: '(11) 98888-1111' },
    { name: 'Ana Souza', registration: '2002', department: 'Financeiro', position: 'Analista', phone: '(11) 98888-2222' },
    { name: 'Roberto Alves', registration: '2003', department: 'Manutencao', position: 'Tecnico', phone: '(11) 98888-3333' },
    { name: 'Fernanda Dias', registration: '2004', department: 'Comercial', position: 'Supervisora', phone: '' },
    { name: 'Lucas Martins', registration: '2005', department: 'Logistica', position: 'Motorista', phone: '(11) 98888-5555' },
  ];
  drivers.forEach((d) => insert('drivers', { ...d, active: true }));
}

module.exports = { db, insert, update, find, all, nextId, now, seed };
