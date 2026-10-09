# Controle de Portaria — Saída, Retorno e Quilometragem de Veículos

Sistema web para a portaria registrar a saída e o retorno dos veículos da empresa:
quem retirou, qual vigilante entregou a chave, a quilometragem de saída e, no retorno,
a quilometragem de chegada, o vigilante que recebeu e os KM percorridos (calculados
automaticamente).

> **MVP:** esta versão guarda os dados **em memória**, sem banco de dados.
> Tudo funciona de ponta a ponta, mas **os dados são reiniciados a cada restart do servidor**.
> Veja [Migrar para SQLite](#migrar-para-sqlite) no fim deste documento.

---

## Instalação

Requer **Node.js 18 ou superior** (testado no Node 24).

```bash
npm install
npm start
```

Depois abra: **http://localhost:3000**

Para desenvolvimento com reload automático:

```bash
npm run dev
```

### Variáveis de ambiente

Copie o arquivo de exemplo e ajuste se necessário:

```bash
cp .env.example .env
```

| Variável         | Padrão                 | Descrição                                    |
|------------------|------------------------|----------------------------------------------|
| `PORT`           | `3000`                 | Porta do servidor                            |
| `JWT_SECRET`     | gerado no `.env`       | Segredo para assinar os tokens (troque!)     |
| `JWT_EXPIRES_IN` | `12h`                  | Validade do token                            |
| `TZ`             | `America/Sao_Paulo`    | Fuso horário                                 |

O sistema roda sem `.env` usando os padrões, mas **em produção o `JWT_SECRET` deve ser trocado**.

---

## Acessos de teste

O sistema já vem com dados fictícios: 4 usuários, 6 veículos e 5 condutores.

| Usuário  | Senha      | Perfil     |
|----------|------------|------------|
| `admin`  | `admin123` | ADMIN      |
| `joao`   | `123456`   | VIGILANTE  |
| `pedro`  | `123456`   | VIGILANTE  |
| `marcos` | `123456`   | VIGILANTE  |

### O que cada perfil pode fazer

| Ação                                 | ADMIN | VIGILANTE |
|--------------------------------------|:-----:|:---------:|
| Registrar saída e retorno            |  sim  |    sim    |
| Consultar veículos e movimentações   |  sim  |    sim    |
| Cadastrar condutor                   |  sim  |    sim    |
| Cadastrar/editar veículos            |  sim  |    não    |
| Cadastrar/editar usuários            |  sim  |    não    |
| Cancelar movimentações               |  sim  |    não    |
| Ver auditoria                        |  sim  |    não    |
| Ver relatórios e exportar CSV        |  sim  |    sim    |

---

## Como usar

### Registrar uma saída

1. Na tela inicial, clique no botão verde **REGISTRAR SAÍDA**.
2. Escolha o veículo — a **placa e o KM atual são preenchidos automaticamente**.
3. Informe o KM de saída, o condutor, o motivo/destino e uma observação opcional.
   - Se o condutor ainda não estiver cadastrado, use **+ Cadastrar novo condutor**
     sem precisar sair do formulário.
4. Clique em **REGISTRAR SAÍDA** e confirme no modal.

A data, a hora e o vigilante responsável (o usuário logado) são gravados automaticamente
pelo servidor. O veículo passa para o status **FORA**.

### Registrar um retorno

1. Clique no botão azul **REGISTRAR RETORNO** (ou no botão **RETORNO** da linha do
   veículo na tabela "Veículos atualmente fora").
2. Só aparecem veículos que estão **FORA**.
3. O sistema mostra veículo, placa, data/hora da saída, KM de saída, condutor,
   vigilante da saída e destino.
4. Informe o KM de retorno — os **KM percorridos aparecem na hora**, enquanto você digita.
5. Confirme.

O veículo volta para **DISPONÍVEL** e o KM atual dele é atualizado.

### Exemplo real

```
Saída:   VTR-01 Fiat Strada  |  KM 45.821  |  Carlos Silva  |  Vigilante: João
Retorno: KM 45.879           |  Vigilante: Pedro
Resultado: 58 km percorridos  →  veículo volta para DISPONÍVEL
```

---

## Telas

| Tela              | O que faz                                                                   |
|-------------------|-----------------------------------------------------------------------------|
| **Início**        | Botões grandes de saída/retorno, cards com totais do dia e tabela dos veículos fora (com tempo fora) |
| **Movimentações** | Histórico completo com filtros de período, veículo, placa, condutor, vigilante, status e busca livre |
| **Veículos**      | Cadastro, edição, ativar/inativar e histórico por veículo                   |
| **Condutores**    | Cadastro das pessoas que podem retirar veículos                            |
| **Vigilantes**    | Usuários do sistema e seus perfis (apenas ADMIN)                           |
| **Relatórios**    | Totais, média de KM, veículos e condutores mais usados, exportação CSV/PDF  |
| **Auditoria**     | Quem fez o quê, quando e por quê (apenas ADMIN)                            |

---

## Regras de negócio implementadas

**Quilometragem**
- KM de saída não pode ser menor que o KM atual do veículo.
- KM de retorno não pode ser menor que o KM de saída.
- Valores negativos são rejeitados.
- KM percorridos = KM retorno − KM saída (calculado pelo servidor).

**Veículos**
- Veículo com status **FORA** não pode registrar nova saída.
- Veículo **INATIVO** não pode ser utilizado.
- No retorno, o KM atual do veículo é atualizado automaticamente.
- Placa duplicada é bloqueada.

**Retorno**
- Só veículos com saída em aberto recebem retorno.
- Não é possível registrar dois retornos para a mesma saída.

**Data e hora**
- Geradas **sempre pelo servidor**, nunca pelo navegador — não dá para manipular pelo cliente.

**Auditoria**
- Movimentações **nunca são apagadas**. Em vez de excluir, elas são **canceladas**,
  com motivo obrigatório, e ficam registradas com o status CANCELADA.
- Toda ação relevante (login, saída, retorno, cancelamento, cadastros) grava
  usuário, data, hora, entidade afetada e descrição.

---

## API REST

Todas as rotas abaixo de `/api`, exceto o login, exigem o header:

```
Authorization: Bearer <token>
```

### Autenticação
| Método | Rota               | Perfil | Descrição                      |
|--------|--------------------|--------|--------------------------------|
| POST   | `/api/auth/login`  | —      | Login, devolve token JWT       |
| GET    | `/api/auth/me`     | todos  | Dados do usuário logado        |

### Veículos
| Método | Rota                           | Perfil    | Descrição                                      |
|--------|--------------------------------|-----------|------------------------------------------------|
| GET    | `/api/vehicles`                | todos     | Lista (`?status=`, `?available=true`)          |
| GET    | `/api/vehicles/:id/history`    | todos     | Movimentações do veículo                       |
| POST   | `/api/vehicles`                | ADMIN     | Cadastrar                                      |
| PUT    | `/api/vehicles/:id`            | ADMIN     | Editar                                         |
| PATCH  | `/api/vehicles/:id/toggle`     | ADMIN     | Ativar / inativar                              |

### Condutores
| Método | Rota                          | Perfil    | Descrição                                  |
|--------|-------------------------------|-----------|--------------------------------------------|
| GET    | `/api/drivers`                | todos     | Lista (`?active=true`)                     |
| POST   | `/api/drivers`                | todos     | Cadastrar (permite o cadastro rápido)      |
| PUT    | `/api/drivers/:id`            | ADMIN     | Editar                                     |
| PATCH  | `/api/drivers/:id/toggle`     | ADMIN     | Ativar / inativar                          |

### Usuários / vigilantes
| Método | Rota                        | Perfil    | Descrição                        |
|--------|-----------------------------|-----------|----------------------------------|
| GET    | `/api/users`                | todos     | Lista (sem expor o hash da senha)|
| POST   | `/api/users`                | ADMIN     | Cadastrar                        |
| PUT    | `/api/users/:id`            | ADMIN     | Editar (senha opcional)          |
| PATCH  | `/api/users/:id/toggle`     | ADMIN     | Ativar / inativar                |

### Movimentações
| Método | Rota                             | Perfil    | Descrição                                     |
|--------|----------------------------------|-----------|-----------------------------------------------|
| GET    | `/api/movements`                 | todos     | Histórico com filtros                         |
| GET    | `/api/movements/open`            | todos     | Saídas em aberto (veículos fora)              |
| GET    | `/api/movements/:id`             | todos     | Uma movimentação                              |
| POST   | `/api/movements/exit`            | todos     | Registrar saída                               |
| POST   | `/api/movements/:id/return`      | todos     | Registrar retorno                             |
| POST   | `/api/movements/:id/cancel`      | ADMIN     | Cancelar (exige motivo; não apaga o registro) |

Filtros aceitos em `GET /api/movements`:
`start`, `end`, `vehicle_id`, `plate`, `driver_id`, `guard_id`, `status`, `search`.

### Dashboard, relatórios e auditoria
| Método | Rota                          | Perfil    | Descrição                           |
|--------|-------------------------------|-----------|-------------------------------------|
| GET    | `/api/dashboard`              | todos     | Cards + veículos fora               |
| GET    | `/api/reports`                | todos     | Totais, médias e rankings           |
| GET    | `/api/reports/export.csv`     | todos     | Exportação CSV (mesmos filtros)     |
| GET    | `/api/audit`                  | ADMIN     | Trilha de auditoria                 |

### Exemplo de uso

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"joao","password":"123456"}' | jq -r .token)

# Registrar saída
curl -X POST http://localhost:3000/api/movements/exit \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"vehicle_id":1,"driver_id":1,"exit_km":45821,"destination":"Almoxarifado"}'

# Registrar retorno (movimentação 1)
curl -X POST http://localhost:3000/api/movements/1/return \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"return_km":45879}'
```

---

## Estrutura do projeto

```
.
├── server.js                  # Entrada: carrega .env e sobe o servidor
├── package.json
├── .env.example
├── src/
│   ├── app.js                 # Monta o Express, rotas e arquivos estáticos
│   ├── data/
│   │   └── store.js           # Armazenamento em memória + seed de dados fictícios
│   ├── middleware/
│   │   ├── auth.js            # JWT: assinatura, autenticação e checagem de ADMIN
│   │   └── errorHandler.js    # Tratamento central de erros
│   ├── routes/                # Camada HTTP (uma rota por entidade)
│   │   ├── auth.js      vehicles.js   drivers.js   users.js
│   │   └── movements.js dashboard.js  reports.js   audit.js
│   └── services/              # Regras de negócio
│       ├── movementService.js   # Saída, retorno, cancelamento, filtros, validações de KM
│       ├── dashboardService.js  # Cards e veículos fora
│       ├── reportService.js     # Totais, rankings e geração do CSV
│       ├── auditService.js      # Trilha de auditoria
│       └── errors.js            # AppError (erro com status HTTP)
├── public/                    # Frontend (HTML/CSS/JS puro, sem framework)
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js             # Cliente REST + sessão
│       ├── ui.js              # Modais, toasts, tabelas, formatação
│       └── app.js             # Telas e fluxos
└── tests/
    └── flow.test.js           # Teste do fluxo completo (47 verificações)
```

---

## Testes

```bash
npm test
```

Sobe o servidor numa porta aleatória e executa **47 verificações** cobrindo o
fluxo obrigatório de ponta a ponta:

```
LOGIN → CADASTRAR VEÍCULO → CADASTRAR VIGILANTE → CADASTRAR CONDUTOR
→ REGISTRAR SAÍDA → VEÍCULO FICA "FORA" → OUTRO VIGILANTE REGISTRA RETORNO
→ CALCULAR KM PERCORRIDO → VEÍCULO VOLTA PARA "DISPONÍVEL"
→ APARECE NO HISTÓRICO → APARECE NOS RELATÓRIOS
```

Além do caminho feliz, os testes cobrem: senha errada, rota sem token, vigilante
tentando ação de admin, KM inválido (menor ou negativo), saída sem destino, veículo
já fora, veículo inativo, retorno duplicado, placa duplicada, cancelamento sem motivo
e registro cancelado que continua existindo.

---

## Segurança

- Senhas guardadas com **hash bcrypt** (nunca em texto puro) e nunca devolvidas pela API.
- Autenticação por **JWT**, com validade configurável.
- Todas as rotas da API são protegidas; as administrativas exigem perfil ADMIN
  **no servidor** — esconder o botão no frontend não é a proteção.
- Validação de todos os dados recebidos, com erros claros em português.
- Sem SQL nesta versão (dados em memória); ao migrar, o ORM/`prepared statements`
  mantém a proteção contra SQL injection.
- Escape de HTML em todo conteúdo exibido no frontend (proteção contra XSS).
- Data e hora sempre do servidor.

---

## Exportação

- **CSV** — botão `EXPORTAR CSV` na tela de Relatórios. Respeita os filtros aplicados
  e sai com separador `;` e BOM UTF-8, abrindo direto no Excel com acentos corretos.
- **PDF** — botão `EXPORTAR PDF` usa a impressão do navegador ("Salvar como PDF"),
  que é a opção mais simples e sem dependências extras.

---

## Migrar para SQLite

A estrutura já está preparada. Os registros em [`src/data/store.js`](src/data/store.js)
usam exatamente os campos do schema final:

| Tabela       | Campos                                                                                                                              |
|--------------|-------------------------------------------------------------------------------------------------------------------------------------|
| `users`      | id, name, username, password_hash, role, registration, active, created_at, updated_at                                               |
| `vehicles`   | id, code, brand, model, plate, year, current_km, status, active, created_at, updated_at                                             |
| `drivers`    | id, name, registration, department, position, phone, active, created_at, updated_at                                                 |
| `movements`  | id, vehicle_id, driver_id, exit_km, return_km, km_driven, exit_datetime, return_datetime, exit_guard_id, return_guard_id, destination, exit_notes, return_notes, status, canceled_reason, created_at, updated_at |
| `audit_logs` | id, user_id, action, entity, entity_id, description, created_at                                                                     |

Para migrar:

1. Instale `sequelize` e `sqlite3`.
2. Defina os models com os campos acima e as foreign keys
   (`movements.vehicle_id → vehicles.id`, `movements.driver_id → drivers.id`,
   `movements.exit_guard_id` e `return_guard_id → users.id`,
   `audit_logs.user_id → users.id`).
3. Reescreva `src/data/store.js` mantendo a mesma interface
   (`insert`, `update`, `find`, `all`, `seed`), agora assíncrona.
4. Ajuste os services para `await` nas chamadas do store.

As rotas, as validações e todo o frontend continuam iguais.
