/* Telas e fluxos do sistema. */
(() => {
  const { esc, fmt, toast, modal, options, table, vehicleLabel } = UI;

  const state = { user: null, view: 'dashboard' };
  const el = {
    login: document.getElementById('login-screen'),
    app: document.getElementById('app'),
    view: document.getElementById('view'),
    tabs: document.getElementById('tabs'),
    chip: document.getElementById('user-chip'),
  };

  const isAdmin = () => state.user && state.user.role === 'ADMIN';

  // ======================= LOGIN =======================
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(loginForm).entries());
      const result = await Api.login(data.username, data.password);
      Api.setSession(result.token, result.user);
      state.user = result.user;
      start();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    Api.clearSession();
    window.location.reload();
  });

  function start() {
    el.login.hidden = true;
    el.app.hidden = false;
    el.chip.textContent = state.user.name + ' - ' + state.user.role;
    el.tabs.querySelectorAll('[data-admin]').forEach((b) => { b.hidden = !isAdmin(); });
    navigate('dashboard');
  }

  el.tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (btn) navigate(btn.dataset.view);
  });

  function navigate(view) {
    state.view = view;
    el.tabs.querySelectorAll('button[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    render();
  }

  async function render() {
    el.view.innerHTML = '<p class="muted">Carregando...</p>';
    try {
      await views[state.view]();
    } catch (err) {
      el.view.innerHTML = '<div class="form-error">' + esc(err.message) + '</div>';
    }
  }

  // ======================= DASHBOARD =======================
  const views = {};

  views.dashboard = async () => {
    const data = await Api.get('/dashboard');
    const c = data.cards;

    el.view.innerHTML =
      '<div class="actions">' +
        '<button class="action-btn exit" id="btn-exit">REGISTRAR SAIDA</button>' +
        '<button class="action-btn return" id="btn-return">REGISTRAR RETORNO</button>' +
      '</div>' +
      '<div class="cards">' +
        card('Veiculos disponiveis', c.available, 'green') +
        card('Veiculos fora', c.outside, 'blue') +
        card('Saidas hoje', c.exits_today) +
        card('Retornos hoje', c.returns_today) +
        card('KM rodados hoje', fmt.km(c.km_today), 'amber') +
      '</div>' +
      '<h3>Veiculos atualmente fora</h3>' +
      table({
        columns: ['Veiculo', 'Placa', 'Quem saiu', 'Saida', 'KM saida', 'Vigilante', 'Destino', 'Tempo fora', ''],
        rows: data.outside,
        empty: 'Nenhum veiculo fora neste momento.',
        renderRow: (m) =>
          '<tr>' +
            td(m.vehicle_code + ' - ' + m.vehicle_label) +
            td(m.plate) +
            td(m.driver_name) +
            td(fmt.time(m.exit_datetime)) +
            td(fmt.km(m.exit_km)) +
            td(m.exit_guard_name) +
            td(m.destination) +
            td(fmt.duration(m.minutes_out)) +
            '<td><button class="btn sm" data-return-id="' + m.id + '">RETORNO</button></td>' +
          '</tr>',
      });

    document.getElementById('btn-exit').addEventListener('click', openExitModal);
    document.getElementById('btn-return').addEventListener('click', () => openReturnPicker());
    el.view.querySelectorAll('[data-return-id]').forEach((btn) => {
      btn.addEventListener('click', () => openReturnModal(Number(btn.dataset.returnId)));
    });
  };

  const card = (label, value, tone) =>
    '<div class="card ' + (tone || '') + '"><div class="label">' + esc(label) + '</div><div class="value">' + esc(value) + '</div></div>';

  const td = (value) => '<td>' + esc(value == null || value === '' ? '-' : value) + '</td>';

  // ======================= REGISTRAR SAIDA =======================
  async function openExitModal() {
    const [vehicles, drivers] = await Promise.all([
      Api.get('/vehicles?available=true'),
      Api.get('/drivers?active=true'),
    ]);

    if (!vehicles.length) {
      toast('Nenhum veiculo disponivel para saida.', 'error');
      return;
    }

    const body =
      '<div class="field"><label>Veiculo</label>' +
        '<select name="vehicle_id" required data-vehicle>' +
          options(vehicles, { label: vehicleLabel, placeholder: 'Selecione o veiculo' }) +
        '</select></div>' +
      '<div class="grid-2">' +
        '<div class="field"><label>Placa</label><input data-plate readonly placeholder="-"></div>' +
        '<div class="field"><label>KM de saida</label><input name="exit_km" type="number" min="0" step="1" required data-km></div>' +
      '</div>' +
      '<p class="muted" data-km-hint style="margin:-8px 0 14px;font-size:13px"></p>' +
      '<div class="field"><label>Quem esta saindo com o veiculo</label>' +
        '<select name="driver_id" required data-driver>' +
          options(drivers, { label: (d) => d.name + (d.department ? ' - ' + d.department : ''), placeholder: 'Selecione o condutor' }) +
        '</select>' +
        '<button type="button" class="btn ghost sm" data-new-driver style="margin-top:8px">+ Cadastrar novo condutor</button>' +
      '</div>' +
      '<div class="field"><label>Motivo / Destino</label><input name="destination" required placeholder="Ex.: Almoxarifado"></div>' +
      '<div class="field"><label>Observacao (opcional)</label><textarea name="exit_notes"></textarea></div>' +
      '<p class="muted" style="font-size:13px;margin:0">Data, hora e vigilante responsavel (' + esc(state.user.name) + ') sao registrados automaticamente.</p>';

    modal({
      title: 'Registrar saida',
      body,
      confirmLabel: 'REGISTRAR SAIDA',
      confirmClass: 'green',
      onMount: ({ form }) => {
        const select = form.querySelector('[data-vehicle]');
        const plate = form.querySelector('[data-plate]');
        const km = form.querySelector('[data-km]');
        const hint = form.querySelector('[data-km-hint]');

        // Placa e KM minimo preenchidos ao escolher o veiculo.
        select.addEventListener('change', () => {
          const v = vehicles.find((x) => String(x.id) === select.value);
          plate.value = v ? v.plate : '';
          if (v) {
            km.value = v.current_km;
            km.min = v.current_km;
            hint.textContent = 'KM atual registrado: ' + fmt.km(v.current_km) + ' (nao pode ser menor).';
          } else {
            km.value = '';
            hint.textContent = '';
          }
        });

        form.querySelector('[data-new-driver]').addEventListener('click', () => {
          openQuickDriverModal((driver) => {
            const sel = form.querySelector('[data-driver]');
            sel.insertAdjacentHTML('beforeend', '<option value="' + driver.id + '">' + esc(driver.name) + '</option>');
            sel.value = driver.id;
          });
        });
      },
      onSubmit: async (data, { close }) => {
        const vehicle = vehicles.find((x) => String(x.id) === data.vehicle_id);
        const driver = drivers.find((x) => String(x.id) === data.driver_id);
        const confirmText =
          'Veiculo: <b>' + esc(vehicle ? vehicleLabel(vehicle) : '') + '</b><br>' +
          'Condutor: <b>' + esc(driver ? driver.name : document.querySelector('[data-driver] option:checked').textContent) + '</b><br>' +
          'KM de saida: <b>' + esc(fmt.km(data.exit_km)) + '</b><br>' +
          'Destino: <b>' + esc(data.destination) + '</b>';

        close();
        UI.confirm({
          title: 'Confirmar saida',
          message: confirmText,
          confirmLabel: 'REGISTRAR SAIDA',
          confirmClass: 'green',
          onConfirm: async () => {
            await Api.post('/movements/exit', data);
            toast('Saida registrada com sucesso.');
            render();
          },
        });
      },
    });
  }

  function openQuickDriverModal(onCreated) {
    modal({
      title: 'Novo condutor',
      body:
        '<div class="field"><label>Nome</label><input name="name" required></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>Matricula</label><input name="registration" required></div>' +
          '<div class="field"><label>Setor</label><input name="department"></div>' +
          '<div class="field"><label>Cargo</label><input name="position"></div>' +
          '<div class="field"><label>Telefone (opcional)</label><input name="phone"></div>' +
        '</div>',
      confirmLabel: 'CADASTRAR',
      onSubmit: async (data, { close }) => {
        const driver = await Api.post('/drivers', data);
        toast('Condutor cadastrado.');
        close();
        if (onCreated) onCreated(driver);
      },
    });
  }

  // ======================= REGISTRAR RETORNO =======================
  async function openReturnPicker() {
    const open = await Api.get('/movements/open');
    if (!open.length) {
      toast('Nenhum veiculo esta fora neste momento.', 'error');
      return;
    }

    modal({
      title: 'Registrar retorno',
      body:
        '<div class="field"><label>Selecione o veiculo que esta retornando</label>' +
          '<select name="movement_id" required>' +
            options(open, {
              value: 'id',
              label: (m) => m.vehicle_code + ' - ' + m.plate + ' | ' + m.driver_name + ' | saiu ' + fmt.time(m.exit_datetime),
              placeholder: 'Selecione',
            }) +
          '</select></div>',
      confirmLabel: 'CONTINUAR',
      onSubmit: async (data, { close }) => {
        close();
        openReturnModal(Number(data.movement_id));
      },
    });
  }

  async function openReturnModal(movementId) {
    const m = await Api.get('/movements/' + movementId);

    const body =
      '<div class="info-box"><dl>' +
        '<dt>Veiculo</dt><dd>' + esc(m.vehicle_code + ' - ' + m.vehicle_label) + '</dd>' +
        '<dt>Placa</dt><dd>' + esc(m.plate) + '</dd>' +
        '<dt>Saida</dt><dd>' + esc(fmt.dateTime(m.exit_datetime)) + '</dd>' +
        '<dt>KM de saida</dt><dd>' + esc(fmt.km(m.exit_km)) + '</dd>' +
        '<dt>Condutor</dt><dd>' + esc(m.driver_name) + '</dd>' +
        '<dt>Vigilante da saida</dt><dd>' + esc(m.exit_guard_name) + '</dd>' +
        '<dt>Destino</dt><dd>' + esc(m.destination) + '</dd>' +
      '</dl></div>' +
      '<div class="km-preview" data-preview>KM percorridos: -</div>' +
      '<div class="field"><label>KM de retorno</label>' +
        '<input name="return_km" type="number" min="' + m.exit_km + '" step="1" required data-return-km autofocus></div>' +
      '<div class="field"><label>Observacao de retorno (opcional)</label><textarea name="return_notes"></textarea></div>' +
      '<p class="muted" style="font-size:13px;margin:0">Data, hora e vigilante do recebimento (' + esc(state.user.name) + ') sao registrados automaticamente.</p>';

    modal({
      title: 'Registrar retorno',
      body,
      confirmLabel: 'REGISTRAR RETORNO',
      onMount: ({ form }) => {
        const input = form.querySelector('[data-return-km]');
        const preview = form.querySelector('[data-preview]');
        input.addEventListener('input', () => {
          const value = Number(input.value);
          if (!input.value || !Number.isFinite(value)) {
            preview.textContent = 'KM percorridos: -';
          } else if (value < m.exit_km) {
            preview.textContent = 'KM de retorno nao pode ser menor que ' + fmt.km(m.exit_km);
          } else {
            preview.textContent = 'KM percorridos: ' + fmt.km(value - m.exit_km) + ' km';
          }
        });
      },
      onSubmit: async (data, { close }) => {
        const driven = Number(data.return_km) - m.exit_km;
        close();
        UI.confirm({
          title: 'Confirmar retorno',
          message:
            'Veiculo: <b>' + esc(m.vehicle_code + ' - ' + m.plate) + '</b><br>' +
            'KM de retorno: <b>' + esc(fmt.km(data.return_km)) + '</b><br>' +
            'KM percorridos: <b>' + esc(fmt.km(driven)) + ' km</b>',
          confirmLabel: 'REGISTRAR RETORNO',
          onConfirm: async () => {
            const result = await Api.post('/movements/' + movementId + '/return', data);
            toast('Retorno registrado. KM percorridos: ' + fmt.km(result.km_driven) + ' km.');
            render();
          },
        });
      },
    });
  }

  // ======================= MOVIMENTACOES =======================
  views.movements = async () => {
    const [vehicles, drivers, guards] = await Promise.all([
      Api.get('/vehicles'),
      Api.get('/drivers'),
      Api.get('/users'),
    ]);

    el.view.innerHTML =
      '<h2 class="page-title">Movimentacoes</h2>' +
      '<div class="filters"><form id="filters"><div class="grid-2">' +
        '<div class="field"><label>De</label><input type="date" name="start"></div>' +
        '<div class="field"><label>Ate</label><input type="date" name="end"></div>' +
        '<div class="field"><label>Veiculo</label><select name="vehicle_id">' +
          options(vehicles, { label: vehicleLabel, placeholder: 'Todos' }) + '</select></div>' +
        '<div class="field"><label>Placa</label><input name="plate" placeholder="Todas"></div>' +
        '<div class="field"><label>Condutor</label><select name="driver_id">' +
          options(drivers, { placeholder: 'Todos' }) + '</select></div>' +
        '<div class="field"><label>Vigilante</label><select name="guard_id">' +
          options(guards, { placeholder: 'Todos' }) + '</select></div>' +
        '<div class="field"><label>Status</label><select name="status">' +
          '<option value="">Todos</option><option value="ABERTA">Aberta</option>' +
          '<option value="FINALIZADA">Finalizada</option><option value="CANCELADA">Cancelada</option>' +
        '</select></div>' +
        '<div class="field"><label>Pesquisar</label><input name="search" placeholder="Veiculo, placa, condutor, destino..."></div>' +
      '</div><div class="buttons">' +
        '<button class="btn" type="submit">FILTRAR</button>' +
        '<button class="btn ghost" type="reset">LIMPAR</button>' +
      '</div></form></div>' +
      '<div id="movements-table"><p class="muted">Carregando...</p></div>';

    const form = document.getElementById('filters');
    const target = document.getElementById('movements-table');

    async function load() {
      const params = Object.fromEntries(new FormData(form).entries());
      const rows = await Api.get('/movements' + Api.qs(params));

      target.innerHTML = table({
        columns: ['Data', 'Veiculo', 'Placa', 'Condutor', 'KM saida', 'KM retorno', 'KM perc.', 'Hora saida',
          'Hora retorno', 'Vig. saida', 'Vig. retorno', 'Destino', 'Status', ''],
        rows,
        renderRow: (m) =>
          '<tr>' +
            td(fmt.date(m.exit_datetime)) +
            td(m.vehicle_code + ' - ' + m.vehicle_label) +
            td(m.plate) +
            td(m.driver_name) +
            td(fmt.km(m.exit_km)) +
            td(fmt.km(m.return_km)) +
            td(m.km_driven == null ? '-' : fmt.km(m.km_driven) + ' km') +
            td(fmt.time(m.exit_datetime)) +
            td(m.return_datetime ? fmt.time(m.return_datetime) : '-') +
            td(m.exit_guard_name) +
            td(m.return_guard_name) +
            td(m.destination) +
            '<td>' + fmt.badge(m.status) + '</td>' +
            '<td class="row-actions">' +
              (m.status === 'ABERTA' ? '<button class="btn sm" data-return-id="' + m.id + '">RETORNO</button>' : '') +
              (isAdmin() && m.status !== 'CANCELADA' ? '<button class="btn sm danger" data-cancel-id="' + m.id + '">CANCELAR</button>' : '') +
            '</td>' +
          '</tr>',
      });

      target.querySelectorAll('[data-return-id]').forEach((btn) => {
        btn.addEventListener('click', () => openReturnModal(Number(btn.dataset.returnId)));
      });
      target.querySelectorAll('[data-cancel-id]').forEach((btn) => {
        btn.addEventListener('click', () => openCancelModal(Number(btn.dataset.cancelId), load));
      });
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
    form.addEventListener('reset', () => setTimeout(load, 0));
    load();
  };

  function openCancelModal(movementId, reload) {
    modal({
      title: 'Cancelar movimentacao #' + movementId,
      body:
        '<p style="margin-top:0">O registro <b>nao sera apagado</b>: ele fica marcado como CANCELADA e a acao entra na auditoria com seu nome, data e hora.</p>' +
        '<div class="field"><label>Motivo do cancelamento</label><textarea name="reason" required></textarea></div>',
      confirmLabel: 'CONFIRMAR CANCELAMENTO',
      confirmClass: 'danger',
      onSubmit: async (data, { close }) => {
        await Api.post('/movements/' + movementId + '/cancel', data);
        toast('Movimentacao cancelada.');
        close();
        if (reload) reload();
      },
    });
  }

  // ======================= VEICULOS =======================
  views.vehicles = async () => {
    const rows = await Api.get('/vehicles');

    el.view.innerHTML =
      '<div class="section-head"><h2>Veiculos</h2>' +
        (isAdmin() ? '<button class="btn" id="btn-new-vehicle">+ NOVO VEICULO</button>' : '') +
      '</div>' +
      table({
        columns: ['ID', 'Prefixo', 'Marca', 'Modelo', 'Placa', 'Ano', 'KM atual', 'Status', ''],
        rows,
        renderRow: (v) =>
          '<tr>' +
            td(v.id) + td(v.code) + td(v.brand) + td(v.model) + td(v.plate) + td(v.year) + td(fmt.km(v.current_km)) +
            '<td>' + fmt.badge(v.status) + '</td>' +
            '<td class="row-actions">' +
              '<button class="btn ghost sm" data-history="' + v.id + '">Historico</button>' +
              (isAdmin() ? '<button class="btn ghost sm" data-edit="' + v.id + '">Editar</button>' +
                '<button class="btn ghost sm" data-toggle="' + v.id + '">' + (v.active ? 'Inativar' : 'Ativar') + '</button>' : '') +
            '</td>' +
          '</tr>',
      });

    if (isAdmin()) {
      document.getElementById('btn-new-vehicle').addEventListener('click', () => openVehicleModal(null));
      el.view.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.addEventListener('click', () => openVehicleModal(rows.find((v) => v.id === Number(btn.dataset.edit))));
      });
      el.view.querySelectorAll('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await Api.patch('/vehicles/' + btn.dataset.toggle + '/toggle');
            toast('Status do veiculo atualizado.');
            render();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
    }

    el.view.querySelectorAll('[data-history]').forEach((btn) => {
      btn.addEventListener('click', () => openVehicleHistory(Number(btn.dataset.history)));
    });
  };

  function openVehicleModal(vehicle) {
    const v = vehicle || {};
    modal({
      title: vehicle ? 'Editar veiculo' : 'Novo veiculo',
      body:
        '<div class="grid-2">' +
          '<div class="field"><label>Prefixo / identificacao</label><input name="code" required value="' + esc(v.code || '') + '"></div>' +
          '<div class="field"><label>Placa</label><input name="plate" required value="' + esc(v.plate || '') + '"></div>' +
          '<div class="field"><label>Marca</label><input name="brand" value="' + esc(v.brand || '') + '"></div>' +
          '<div class="field"><label>Modelo</label><input name="model" required value="' + esc(v.model || '') + '"></div>' +
          '<div class="field"><label>Ano</label><input name="year" type="number" min="1950" max="2100" value="' + esc(v.year || '') + '"></div>' +
          '<div class="field"><label>KM atual</label><input name="current_km" type="number" min="0" step="1" required value="' + esc(v.current_km == null ? 0 : v.current_km) + '"></div>' +
        '</div>' +
        (vehicle
          ? '<div class="field"><label>Status</label><select name="status">' +
              '<option value="DISPONIVEL"' + (v.status === 'DISPONIVEL' ? ' selected' : '') + '>DISPONIVEL</option>' +
              '<option value="INATIVO"' + (v.status === 'INATIVO' ? ' selected' : '') + '>INATIVO</option>' +
            '</select></div>'
          : ''),
      confirmLabel: 'SALVAR',
      onSubmit: async (data, { close }) => {
        if (vehicle) await Api.put('/vehicles/' + vehicle.id, data);
        else await Api.post('/vehicles', data);
        toast('Veiculo salvo.');
        close();
        render();
      },
    });
  }

  async function openVehicleHistory(vehicleId) {
    const rows = await Api.get('/vehicles/' + vehicleId + '/history');
    modal({
      title: 'Historico do veiculo',
      wide: true,
      body: table({
        columns: ['Data', 'Condutor', 'KM saida', 'KM retorno', 'KM perc.', 'Destino', 'Status'],
        rows,
        empty: 'Este veiculo ainda nao possui movimentacoes.',
        renderRow: (m) =>
          '<tr>' + td(fmt.dateTime(m.exit_datetime)) + td(m.driver_name) + td(fmt.km(m.exit_km)) +
          td(fmt.km(m.return_km)) + td(m.km_driven == null ? '-' : fmt.km(m.km_driven) + ' km') +
          td(m.destination) + '<td>' + fmt.badge(m.status) + '</td></tr>',
      }),
    });
  }

  // ======================= CONDUTORES =======================
  views.drivers = async () => {
    const rows = await Api.get('/drivers');

    el.view.innerHTML =
      '<div class="section-head"><h2>Condutores</h2>' +
        '<button class="btn" id="btn-new-driver">+ NOVO CONDUTOR</button>' +
      '</div>' +
      table({
        columns: ['ID', 'Nome', 'Matricula', 'Setor', 'Cargo', 'Telefone', 'Ativo', ''],
        rows,
        renderRow: (d) =>
          '<tr>' + td(d.id) + td(d.name) + td(d.registration) + td(d.department) + td(d.position) + td(d.phone) +
          '<td>' + fmt.badge(d.active ? 'SIM' : 'NAO') + '</td>' +
          '<td class="row-actions">' +
            (isAdmin()
              ? '<button class="btn ghost sm" data-edit="' + d.id + '">Editar</button>' +
                '<button class="btn ghost sm" data-toggle="' + d.id + '">' + (d.active ? 'Inativar' : 'Ativar') + '</button>'
              : '<span class="muted">-</span>') +
          '</td></tr>',
      });

    document.getElementById('btn-new-driver').addEventListener('click', () => openDriverModal(null));
    el.view.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openDriverModal(rows.find((d) => d.id === Number(btn.dataset.edit))));
    });
    el.view.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await Api.patch('/drivers/' + btn.dataset.toggle + '/toggle');
          toast('Status do condutor atualizado.');
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  };

  function openDriverModal(driver) {
    const d = driver || {};
    modal({
      title: driver ? 'Editar condutor' : 'Novo condutor',
      body:
        '<div class="field"><label>Nome</label><input name="name" required value="' + esc(d.name || '') + '"></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>Matricula</label><input name="registration" required value="' + esc(d.registration || '') + '"></div>' +
          '<div class="field"><label>Setor</label><input name="department" value="' + esc(d.department || '') + '"></div>' +
          '<div class="field"><label>Cargo</label><input name="position" value="' + esc(d.position || '') + '"></div>' +
          '<div class="field"><label>Telefone (opcional)</label><input name="phone" value="' + esc(d.phone || '') + '"></div>' +
        '</div>',
      confirmLabel: 'SALVAR',
      onSubmit: async (data, { close }) => {
        if (driver) await Api.put('/drivers/' + driver.id, data);
        else await Api.post('/drivers', data);
        toast('Condutor salvo.');
        close();
        render();
      },
    });
  }

  // ======================= VIGILANTES / USUARIOS =======================
  views.guards = async () => {
    const rows = await Api.get('/users');

    el.view.innerHTML =
      '<div class="section-head"><h2>Vigilantes e usuarios</h2>' +
        '<button class="btn" id="btn-new-user">+ NOVO USUARIO</button>' +
      '</div>' +
      '<p class="muted" style="margin-top:-6px">O vigilante logado e usado automaticamente como responsavel pela entrega e pelo recebimento das chaves.</p>' +
      table({
        columns: ['ID', 'Nome', 'Usuario', 'Matricula', 'Perfil', 'Ativo', ''],
        rows,
        renderRow: (u) =>
          '<tr>' + td(u.id) + td(u.name) + td(u.username) + td(u.registration) +
          '<td>' + fmt.badge(u.role) + '</td>' +
          '<td>' + fmt.badge(u.active ? 'SIM' : 'NAO') + '</td>' +
          '<td class="row-actions">' +
            '<button class="btn ghost sm" data-edit="' + u.id + '">Editar</button>' +
            (u.id === state.user.id ? '' : '<button class="btn ghost sm" data-toggle="' + u.id + '">' + (u.active ? 'Inativar' : 'Ativar') + '</button>') +
          '</td></tr>',
      });

    document.getElementById('btn-new-user').addEventListener('click', () => openUserModal(null));
    el.view.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openUserModal(rows.find((u) => u.id === Number(btn.dataset.edit))));
    });
    el.view.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await Api.patch('/users/' + btn.dataset.toggle + '/toggle');
          toast('Status do usuario atualizado.');
          render();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  };

  function openUserModal(user) {
    const u = user || {};
    modal({
      title: user ? 'Editar usuario' : 'Novo usuario',
      body:
        '<div class="field"><label>Nome completo</label><input name="name" required value="' + esc(u.name || '') + '"></div>' +
        '<div class="grid-2">' +
          (user
            ? '<div class="field"><label>Usuario</label><input value="' + esc(u.username) + '" readonly></div>'
            : '<div class="field"><label>Usuario de acesso</label><input name="username" required></div>') +
          '<div class="field"><label>Matricula</label><input name="registration" value="' + esc(u.registration || '') + '"></div>' +
          '<div class="field"><label>Perfil</label><select name="role">' +
            '<option value="VIGILANTE"' + (u.role === 'VIGILANTE' || !user ? ' selected' : '') + '>VIGILANTE</option>' +
            '<option value="ADMIN"' + (u.role === 'ADMIN' ? ' selected' : '') + '>ADMIN</option>' +
          '</select></div>' +
          '<div class="field"><label>Senha' + (user ? ' (deixe vazio para manter)' : '') + '</label>' +
            '<input name="password" type="password" minlength="6"' + (user ? '' : ' required') + '></div>' +
        '</div>',
      confirmLabel: 'SALVAR',
      onSubmit: async (data, { close }) => {
        if (user) {
          if (!data.password) delete data.password;
          await Api.put('/users/' + user.id, data);
        } else {
          await Api.post('/users', data);
        }
        toast('Usuario salvo.');
        close();
        render();
      },
    });
  }

  // ======================= RELATORIOS =======================
  views.reports = async () => {
    const [vehicles, drivers, guards] = await Promise.all([
      Api.get('/vehicles'),
      Api.get('/drivers'),
      Api.get('/users'),
    ]);

    el.view.innerHTML =
      '<h2 class="page-title">Relatorios</h2>' +
      '<div class="filters"><form id="report-filters"><div class="grid-2">' +
        '<div class="field"><label>Periodo inicial</label><input type="date" name="start"></div>' +
        '<div class="field"><label>Periodo final</label><input type="date" name="end"></div>' +
        '<div class="field"><label>Veiculo</label><select name="vehicle_id">' +
          options(vehicles, { label: vehicleLabel, placeholder: 'Todos' }) + '</select></div>' +
        '<div class="field"><label>Condutor</label><select name="driver_id">' +
          options(drivers, { placeholder: 'Todos' }) + '</select></div>' +
        '<div class="field"><label>Vigilante</label><select name="guard_id">' +
          options(guards, { placeholder: 'Todos' }) + '</select></div>' +
      '</div><div class="buttons">' +
        '<button class="btn" type="submit">GERAR RELATORIO</button>' +
        '<button class="btn green" type="button" id="btn-csv">EXPORTAR CSV</button>' +
        '<button class="btn ghost" type="button" id="btn-pdf">EXPORTAR PDF</button>' +
        '<button class="btn ghost" type="reset">LIMPAR</button>' +
      '</div></form></div>' +
      '<div id="report-result"><p class="muted">Carregando...</p></div>';

    const form = document.getElementById('report-filters');
    const target = document.getElementById('report-result');
    const params = () => Object.fromEntries(new FormData(form).entries());

    async function load() {
      const data = await Api.get('/reports' + Api.qs(params()));
      const s = data.summary;

      target.innerHTML =
        '<div class="cards">' +
          card('Saidas', s.exits) +
          card('Retornos', s.returns, 'green') +
          card('Em aberto', s.open, 'amber') +
          card('KM total', fmt.km(s.total_km), 'blue') +
          card('Media KM / saida', fmt.km(s.avg_km)) +
        '</div>' +
        '<h3>Veiculos mais utilizados</h3>' +
        table({
          columns: ['Veiculo', 'Saidas', 'KM total'],
          rows: data.top_vehicles,
          renderRow: (r) => '<tr>' + td(r.vehicle) + td(r.trips) + td(fmt.km(r.km) + ' km') + '</tr>',
        }) +
        '<h3>Condutores mais frequentes</h3>' +
        table({
          columns: ['Condutor', 'Saidas', 'KM total'],
          rows: data.top_drivers,
          renderRow: (r) => '<tr>' + td(r.driver) + td(r.trips) + td(fmt.km(r.km) + ' km') + '</tr>',
        }) +
        '<h3>Movimentacoes do periodo</h3>' +
        table({
          columns: ['Data', 'Veiculo', 'Placa', 'Condutor', 'KM saida', 'KM retorno', 'KM perc.', 'Destino', 'Status'],
          rows: data.rows,
          renderRow: (m) =>
            '<tr>' + td(fmt.date(m.exit_datetime)) + td(m.vehicle_code) + td(m.plate) + td(m.driver_name) +
            td(fmt.km(m.exit_km)) + td(fmt.km(m.return_km)) +
            td(m.km_driven == null ? '-' : fmt.km(m.km_driven) + ' km') + td(m.destination) +
            '<td>' + fmt.badge(m.status) + '</td></tr>',
        });
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
    form.addEventListener('reset', () => setTimeout(load, 0));

    document.getElementById('btn-csv').addEventListener('click', async () => {
      try {
        await Api.downloadCsv(params());
        toast('CSV exportado.');
      } catch (err) { toast(err.message, 'error'); }
    });

    // PDF simples: usa a impressao do proprio navegador (salvar como PDF).
    document.getElementById('btn-pdf').addEventListener('click', () => window.print());

    load();
  };

  // ======================= AUDITORIA =======================
  views.audit = async () => {
    const rows = await Api.get('/audit');
    el.view.innerHTML =
      '<h2 class="page-title">Auditoria</h2>' +
      '<p class="muted" style="margin-top:-8px">Registros nao sao apagados. Toda acao relevante guarda quem fez, quando e o motivo.</p>' +
      table({
        columns: ['Data/Hora', 'Usuario', 'Acao', 'Entidade', 'Registro', 'Descricao'],
        rows,
        renderRow: (l) =>
          '<tr>' + td(fmt.dateTime(l.created_at)) + td(l.user_name) +
          '<td>' + fmt.badge(l.action) + '</td>' + td(l.entity) + td(l.entity_id) +
          '<td style="white-space:normal">' + esc(l.description) + '</td></tr>',
      });
  };

  // ======================= BOOT =======================
  (async function boot() {
    if (!Api.getToken()) return;
    try {
      state.user = await Api.me();
      start();
    } catch (err) {
      Api.clearSession();
    }
  })();
})();
