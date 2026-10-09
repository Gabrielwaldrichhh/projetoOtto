'use strict';

/**
 * Teste do fluxo minimo obrigatorio, sem dependencias externas.
 * Executar com: npm test
 */
const assert = require('assert');
const http = require('http');
const { createApp } = require('../src/app');

const server = http.createServer(createApp());
let base = '';
let pass = 0;

async function api(method, pathname, { token, body } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    data = text;
  }
  return { status: res.status, data };
}

function check(label, fn) {
  fn();
  pass += 1;
  console.log(`  ok  ${label}`);
}

async function main() {
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  // 1. LOGIN
  const badLogin = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'errada' } });
  check('login com senha errada e rejeitado', () => assert.strictEqual(badLogin.status, 401));

  const admin = await api('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
  check('login do admin funciona', () => assert.strictEqual(admin.status, 200));
  const adminToken = admin.data.token;

  const joao = await api('POST', '/api/auth/login', { body: { username: 'joao', password: '123456' } });
  const joaoToken = joao.data.token;
  const pedro = await api('POST', '/api/auth/login', { body: { username: 'pedro', password: '123456' } });
  const pedroToken = pedro.data.token;
  check('login dos vigilantes funciona', () => assert.ok(joaoToken && pedroToken));

  const noAuth = await api('GET', '/api/vehicles');
  check('rota protegida exige token', () => assert.strictEqual(noAuth.status, 401));

  // 2. CADASTRAR VEICULO
  const vehicle = await api('POST', '/api/vehicles', {
    token: adminToken,
    body: { code: 'VTR-99', brand: 'Fiat', model: 'Toro', plate: 'TST9A99', year: 2024, current_km: 10000 },
  });
  check('admin cadastra veiculo', () => assert.strictEqual(vehicle.status, 201));
  const vehicleId = vehicle.data.id;

  const forbidden = await api('POST', '/api/vehicles', {
    token: joaoToken,
    body: { code: 'VTR-98', model: 'Gol', plate: 'XXX1X11', current_km: 0 },
  });
  check('vigilante nao cadastra veiculo (403)', () => assert.strictEqual(forbidden.status, 403));

  // 3. CADASTRAR VIGILANTE
  const guard = await api('POST', '/api/users', {
    token: adminToken,
    body: { name: 'Carlos Vigilante', username: 'carlosv', password: '123456', role: 'VIGILANTE', registration: '1099' },
  });
  check('admin cadastra vigilante', () => assert.strictEqual(guard.status, 201));
  check('hash de senha nao e exposto', () => assert.ok(!('password_hash' in guard.data)));

  // 4. CADASTRAR CONDUTOR
  const driver = await api('POST', '/api/drivers', {
    token: joaoToken,
    body: { name: 'Mariana Teste', registration: '2099', department: 'TI', position: 'Analista' },
  });
  check('vigilante cadastra condutor (cadastro rapido)', () => assert.strictEqual(driver.status, 201));
  const driverId = driver.data.id;

  // 5. VALIDACOES DE KM NA SAIDA
  const kmBaixo = await api('POST', '/api/movements/exit', {
    token: joaoToken,
    body: { vehicle_id: vehicleId, driver_id: driverId, exit_km: 9000, destination: 'Teste' },
  });
  check('KM de saida menor que o KM atual e bloqueado', () => assert.strictEqual(kmBaixo.status, 400));

  const kmNegativo = await api('POST', '/api/movements/exit', {
    token: joaoToken,
    body: { vehicle_id: vehicleId, driver_id: driverId, exit_km: -5, destination: 'Teste' },
  });
  check('KM negativo e bloqueado', () => assert.strictEqual(kmNegativo.status, 400));

  const semDestino = await api('POST', '/api/movements/exit', {
    token: joaoToken,
    body: { vehicle_id: vehicleId, driver_id: driverId, exit_km: 10000 },
  });
  check('saida sem destino e bloqueada', () => assert.strictEqual(semDestino.status, 400));

  // 6. REGISTRAR SAIDA
  const exit = await api('POST', '/api/movements/exit', {
    token: joaoToken,
    body: {
      vehicle_id: vehicleId,
      driver_id: driverId,
      exit_km: 10050,
      destination: 'Almoxarifado',
      exit_notes: 'Entrega de material',
    },
  });
  check('saida registrada', () => assert.strictEqual(exit.status, 201));
  const movementId = exit.data.id;
  check('vigilante da saida e o usuario logado', () => assert.strictEqual(exit.data.exit_guard_name, 'Joao Pereira'));
  check('data/hora da saida vem do servidor', () => assert.ok(exit.data.exit_datetime));

  // 7. VEICULO FICA FORA
  const afterExit = await api('GET', '/api/vehicles', { token: joaoToken });
  const outVehicle = afterExit.data.find((v) => v.id === vehicleId);
  check('veiculo fica com status FORA', () => assert.strictEqual(outVehicle.status, 'FORA'));

  const secondExit = await api('POST', '/api/movements/exit', {
    token: joaoToken,
    body: { vehicle_id: vehicleId, driver_id: driverId, exit_km: 10100, destination: 'Outro' },
  });
  check('veiculo FORA nao recebe nova saida', () => assert.strictEqual(secondExit.status, 400));

  const openList = await api('GET', '/api/movements/open', { token: pedroToken });
  check('saida aparece na lista de abertas', () => assert.ok(openList.data.some((m) => m.id === movementId)));

  // 8. VALIDACAO DO RETORNO
  const kmRetornoBaixo = await api('POST', `/api/movements/${movementId}/return`, {
    token: pedroToken,
    body: { return_km: 10000 },
  });
  check('KM de retorno menor que o de saida e bloqueado', () => assert.strictEqual(kmRetornoBaixo.status, 400));

  // 9. OUTRO VIGILANTE REGISTRA RETORNO
  const ret = await api('POST', `/api/movements/${movementId}/return`, {
    token: pedroToken,
    body: { return_km: 10108, return_notes: 'Sem avarias' },
  });
  check('retorno registrado por outro vigilante', () => assert.strictEqual(ret.status, 200));
  check('KM percorrido calculado (58 km)', () => assert.strictEqual(ret.data.km_driven, 58));
  check('vigilante do retorno e Pedro', () => assert.strictEqual(ret.data.return_guard_name, 'Pedro Santos'));

  // 10. VEICULO VOLTA PARA DISPONIVEL E KM ATUALIZADO
  const afterReturn = await api('GET', '/api/vehicles', { token: joaoToken });
  const backVehicle = afterReturn.data.find((v) => v.id === vehicleId);
  check('veiculo volta para DISPONIVEL', () => assert.strictEqual(backVehicle.status, 'DISPONIVEL'));
  check('KM atual do veiculo atualizado', () => assert.strictEqual(backVehicle.current_km, 10108));

  const duplicate = await api('POST', `/api/movements/${movementId}/return`, {
    token: pedroToken,
    body: { return_km: 10200 },
  });
  check('nao permite dois retornos para a mesma saida', () => assert.strictEqual(duplicate.status, 400));

  // 11. HISTORICO E FILTROS
  const history = await api('GET', '/api/movements', { token: joaoToken });
  check('movimentacao aparece no historico', () => assert.ok(history.data.some((m) => m.id === movementId)));

  const filtered = await api('GET', `/api/movements?vehicle_id=${vehicleId}&status=FINALIZADA`, { token: joaoToken });
  check('filtro por veiculo e status funciona', () =>
    assert.ok(filtered.data.every((m) => m.vehicle_id === vehicleId && m.status === 'FINALIZADA')));

  const searched = await api('GET', '/api/movements?search=Mariana', { token: joaoToken });
  check('busca textual funciona', () => assert.ok(searched.data.some((m) => m.id === movementId)));

  // 12. RELATORIOS E CSV
  const report = await api('GET', `/api/reports?vehicle_id=${vehicleId}`, { token: adminToken });
  check('relatorio traz a movimentacao', () => assert.strictEqual(report.data.summary.returns, 1));
  check('relatorio soma KM total', () => assert.strictEqual(report.data.summary.total_km, 58));
  check('relatorio calcula media de KM', () => assert.strictEqual(report.data.summary.avg_km, 58));
  check('relatorio lista veiculos mais usados', () => assert.ok(report.data.top_vehicles.length >= 1));

  const csv = await fetch(`${base}/api/reports/export.csv?vehicle_id=${vehicleId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const csvText = await csv.text();
  check('CSV exportado', () => assert.ok(csv.status === 200 && csvText.includes('TST9A99')));

  // 13. DASHBOARD
  const dash = await api('GET', '/api/dashboard', { token: joaoToken });
  check('dashboard retorna cards', () => assert.ok(typeof dash.data.cards.available === 'number'));
  check('dashboard conta saida de hoje', () => assert.ok(dash.data.cards.exits_today >= 1));
  check('dashboard conta KM de hoje', () => assert.ok(dash.data.cards.km_today >= 58));

  // 14. CANCELAMENTO + AUDITORIA
  const exit2 = await api('POST', '/api/movements/exit', {
    token: joaoToken,
    body: { vehicle_id: vehicleId, driver_id: driverId, exit_km: 10108, destination: 'Saida para cancelar' },
  });
  const cancelNoReason = await api('POST', `/api/movements/${exit2.data.id}/cancel`, { token: adminToken, body: {} });
  check('cancelamento exige motivo', () => assert.strictEqual(cancelNoReason.status, 400));

  const cancelAsGuard = await api('POST', `/api/movements/${exit2.data.id}/cancel`, {
    token: joaoToken,
    body: { reason: 'teste' },
  });
  check('vigilante nao cancela movimentacao (403)', () => assert.strictEqual(cancelAsGuard.status, 403));

  const canceled = await api('POST', `/api/movements/${exit2.data.id}/cancel`, {
    token: adminToken,
    body: { reason: 'Lancamento duplicado' },
  });
  check('admin cancela movimentacao', () => assert.strictEqual(canceled.data.status, 'CANCELADA'));

  const afterCancel = await api('GET', '/api/vehicles', { token: adminToken });
  check('cancelar saida aberta libera o veiculo', () =>
    assert.strictEqual(afterCancel.data.find((v) => v.id === vehicleId).status, 'DISPONIVEL'));

  const stillThere = await api('GET', `/api/movements/${exit2.data.id}`, { token: adminToken });
  check('registro cancelado nao e apagado', () => assert.strictEqual(stillThere.status, 200));

  const auditLog = await api('GET', '/api/audit', { token: adminToken });
  check('auditoria registra o cancelamento com motivo', () =>
    assert.ok(auditLog.data.some((l) => l.action === 'CANCELAMENTO' && l.description.includes('Lancamento duplicado'))));
  check('auditoria registra quem fez a acao', () =>
    assert.ok(auditLog.data.some((l) => l.action === 'SAIDA' && l.user_name === 'Joao Pereira')));

  const auditAsGuard = await api('GET', '/api/audit', { token: joaoToken });
  check('vigilante nao acessa auditoria (403)', () => assert.strictEqual(auditAsGuard.status, 403));

  // 15. VEICULO INATIVO
  const toggled = await api('PATCH', `/api/vehicles/${vehicleId}/toggle`, { token: adminToken });
  check('admin inativa veiculo', () => assert.strictEqual(toggled.data.status, 'INATIVO'));

  const inactiveExit = await api('POST', '/api/movements/exit', {
    token: joaoToken,
    body: { vehicle_id: vehicleId, driver_id: driverId, exit_km: 10200, destination: 'Teste' },
  });
  check('veiculo INATIVO nao pode sair', () => assert.strictEqual(inactiveExit.status, 400));

  const dupPlate = await api('POST', '/api/vehicles', {
    token: adminToken,
    body: { code: 'VTR-97', model: 'Uno', plate: 'TST9A99', current_km: 0 },
  });
  check('placa duplicada e bloqueada', () => assert.strictEqual(dupPlate.status, 400));

  server.close();
  console.log(`\n  ${pass} verificacoes passaram.\n`);
}

main().catch((err) => {
  console.error('\n  FALHOU:', err.message);
  server.close();
  process.exit(1);
});
