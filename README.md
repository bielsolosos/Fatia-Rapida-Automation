[![Fastify](https://img.shields.io/badge/Fastify-v5-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev)
[![EJS](https://img.shields.io/badge/EJS-Server%20Templates-8e44ad?style=for-the-badge&logo=ejs&logoColor=white)](https://ejs.co)
[![HTMX](https://img.shields.io/badge/HTMX-v2-337ab7?style=for-the-badge&logo=htmx&logoColor=white)](https://htmx.org)
[![DaisyUI](https://img.shields.io/badge/DaisyUI-v4-ff69b4?style=for-the-badge&logo=daisyui&logoColor=white)](https://daisyui.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-CDN-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-v6-2d3748?style=for-the-badge&logo=prisma&logoColor=white)](https://prisma.io)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Zod](https://img.shields.io/badge/Zod-v3-0e8a16?style=for-the-badge)](https://zod.dev)
[![Axios](https://img.shields.io/badge/Axios-HTTP%20Client-5a29e4?style=for-the-badge&logo=axios&logoColor=white)](https://axios-http.com)
[![SQLite](https://img.shields.io/badge/SQLite-DB-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

# Fatia Rápida v2

Plataforma de automação de tarefas agendadas com suporte a webhooks, scripts Shell/Node.js/Python e editor de código integrado. Construída para rodar em **Raspberry Pi** com recursos limitados.

---

## Índice

- [Stack](#stack)
- [Arquitetura do Projeto](#arquitetura-do-projeto)
- [Banco de dados — Modelos](#banco-de-dados--modelos)
- [Features](#features)
  - [Autenticação](#feature-autenticação)
  - [Tarefas](#feature-tarefas)
  - [Scripts](#feature-scripts)
  - [Execuções](#feature-execuções)
  - [Agendamento (Scheduler)](#feature-agendamento-scheduler)
- [Fluxos detalhados](#fluxos-detalhados)
  - [Fluxo 1 — Cadastro de Tarefa](#fluxo-1--cadastro-de-tarefa)
  - [Fluxo 2 — Como o cron é criado](#fluxo-2--como-o-cron-é-criado)
  - [Fluxo 3 — Execução de Tarefa (Trigger do cron)](#fluxo-3--execução-de-uma-tarefa-trigger-do-cron)
  - [Fluxo 4 — Execução de Script](#fluxo-4--execução-de-script)
  - [Fluxo 5 — Autenticação](#fluxo-5--autenticação)
- [Variáveis de ambiente](#variáveis-de-ambiente-env)
- [Como rodar](#como-rodar)
- [Camadas e responsabilidades](#camadas-e-responsabilidades)
- [CSP — Regras importantes](#csp--regras-importantes)
- [Guia: Como criar uma nova tela/feature](#guia-como-criar-uma-nova-telafeature)
- [Deploy (Raspberry Pi)](#deploy-raspberry-pi)

---

## Stack

| Camada               | Tecnologia                                                                        | Por quê                                                 |
| -------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **HTTP Server**      | [Fastify v5](https://fastify.dev)                                                 | Leve, rápido, plugin-first — menos RAM que Express      |
| **Templates**        | [EJS](https://ejs.co) + `@fastify/view`                                           | Renderização server-side, sem bundle JS                 |
| **Interatividade**   | [HTMX v2](https://htmx.org)                                                       | Swap parcial de HTML via `hx-*`, sem framework frontend |
| **Estilos**          | [DaisyUI v4](https://daisyui.com) + [Tailwind CSS](https://tailwindcss.com) (CDN) | Componentes prontos, sem build step                     |
| **Ícones**           | [Lucide](https://lucide.dev) (CDN)                                                | SVG leve e consistente                                  |
| **Banco de dados**   | SQLite via [Prisma v6](https://prisma.io)                                         | Arquivo local, zero infra extra                         |
| **Agendamento**      | [node-cron v3](https://github.com/node-cron/node-cron)                            | Expressões cron nativas do Node                         |
| **Execução**         | `child_process.spawn` / `exec` (Node built-in)                                    | Sem dependências externas                               |
| **Editor de código** | [Monaco Editor 0.52](https://microsoft.github.io/monaco-editor/) (CDN jsDelivr)   | VS Code no browser                                      |
| **Validação**        | [Zod v3](https://zod.dev)                                                         | Schema type-safe no server                              |
| **Auth**             | Sessões em SQLite + cookie HMAC                                                   | Sem JWT, sem Redis — tudo local                         |
| **Notificações**     | Discord Webhook via [Axios](https://axios-http.com)                               | Opcional por tarefa                                     |
| **Linguagem**        | TypeScript 5 + `tsx`                                                              | Sem compile em dev (`tsx watch`)                        |

---

## Arquitetura do Projeto

```
v2/
├── prisma/
│   ├── schema.prisma          # Modelos: Session, Tarefa, Script, Execucao
│   └── migrations/            # Histórico de migrations (nunca editar manualmente)
│
├── scripts/
│   └── user/                  # Scripts criados pelo usuário (Shell/JS/Python)
│       ├── uuid.sh            # Arquivos nomeados com UUID do banco
│       ├── uuid.js
│       ├── uuid.py
│       ├── package.json       # Dependências npm dos scripts Node.js
│       └── node_modules/      # Instalado manualmente: cd scripts/user && npm install lib
│
├── src/
│   ├── server.ts              # Ponto de entrada: listen + graceful shutdown
│   ├── app.ts                 # Bootstrap Fastify: registra plugins, rotas, CSP
│   ├── config.ts              # Lê variáveis .env com required()/optional()
│   │
│   ├── plugins/
│   │   ├── prisma.ts          # Decora app.prisma (PrismaClient singleton)
│   │   ├── auth.ts            # Sessões, login/logout, requireAuth, limpeza expiradas
│   │   └── scheduler.ts       # SchedulerManager: loadAll/schedule/unschedule/reschedule
│   │
│   ├── routes/
│   │   ├── auth.ts            # GET /login, POST /login, POST /logout
│   │   ├── dashboard.ts       # GET / — stats agregadas
│   │   ├── tarefas.ts         # CRUD completo + toggle + clonar
│   │   ├── scripts.ts         # CRUD + POST /scripts/:id/executar
│   │   └── execucoes.ts       # Listagem paginada + detalhes
│   │
│   ├── services/
│   │   ├── tarefa.service.ts  # createTarefa, updateTarefa, listTarefas, toggle, delete, getDashboardStats
│   │   ├── script.service.ts  # createScript, updateScript, deleteScript, executeScriptManually
│   │   ├── cron.service.ts    # generateCronExpressions, formatDiasSemana, formatHorarios
│   │   ├── execucao.service.ts# executeTask: decide script vs webhook, captura saída, salva
│   │   └── webhook.service.ts # sendDiscordWebhook: embed formatado
│   │
│   ├── validators/
│   │   ├── auth.schema.ts     # loginSchema (zod)
│   │   ├── tarefa.schema.ts   # tarefaCreateSchema, parseFormTarefa
│   │   └── script.schema.ts   # scriptCreateSchema, parseFormScript
│   │
│   └── views/
│       ├── layouts/
│       │   ├── header.ejs     # DOCTYPE, CDNs, HTMX, Lucide, abertura do <main>
│       │   └── footer.ejs     # fecha <main>, <footer>, scripts JS globais + event delegation
│       ├── partials/
│       │   ├── navbar.ejs            # Navbar desktop + dropdown mobile
│       │   ├── toast.ejs             # Fragmento de alerta (injetado via HTMX)
│       │   ├── task-card.ejs         # Card individual de tarefa
│       │   ├── script-card.ejs       # Card de script com botão Executar (HTMX)
│       │   ├── agendamento-fields.ejs# Campos de dia/horário do agendamento
│       │   ├── execution-row.ejs     # <tr> de execução
│       │   ├── execution-detail.ejs  # Conteúdo do modal de detalhes
│       │   └── execution-output.ejs  # Output de execução manual de script
│       └── pages/
│           ├── login.ejs
│           ├── dashboard.ejs
│           ├── tarefas.ejs
│           ├── tarefa-form.ejs
│           ├── scripts.ejs
│           ├── script-form.ejs
│           ├── execucoes.ejs
│           └── error.ejs
│
├── public/
│   └── css/
│       └── style.css          # TailwindCSS v4 + tema DaisyUI "fatia" (rosa)
│
├── deploy.sh                  # Script de deploy para Raspberry Pi
├── ecosystem.config.cjs       # PM2: processo único, restart on crash
└── .env                       # Variáveis de ambiente (não versionar)
```

### Fluxo de uma requisição

```
Request HTTP
  └─ Fastify
      ├─ Plugin: auth (verifica sessão em cada request)
      ├─ Plugin: prisma (app.prisma disponível em toda a app)
      ├─ Route Handler (src/routes/)
      │   ├─ preHandler: app.requireAuth (redireciona /login se não autenticado)
      │   ├─ Valida input com Zod (src/validators/)
      │   ├─ Chama Service (src/services/)
      │   │   └─ Acessa banco via app.prisma (Prisma ORM)
      │   └─ reply.view('pages/nome', { dados })
      └─ EJS renderiza: header + página + footer
```

---

## Banco de dados — Modelos

### `Session`

```
sid       String  @id       -- ID aleatório (32 bytes hex)
data      String            -- JSON: { username, authenticatedAt }
expiresAt DateTime          -- TTL do cookie (padrão: 7 dias)
```

### `Tarefa`

```
id               String   @id  uuid()
nome             String
descricao        String?
comandoOuPayload String?       -- Comando shell ou payload Discord
webhookUrl       String?       -- URL do webhook Discord (opcional)
ativo            Boolean       -- false = cron jobs pausados
scriptId         String?  FK → Script (executa script em vez de comando)
diasSemana       String        -- JSON: number[]  ex: "[1,2,3,4,5]"
horarios         String        -- JSON: string[]  ex: '["08:00","18:00"]'
createdAt        DateTime
updatedAt        DateTime
→ script         Script?
→ execucoes      Execucao[]    -- cascade delete
```

### `Script`

```
id        String  @id  uuid()
nome      String
descricao String?
tipo      String        -- "SHELL" | "NODEJS" | "PYTHON"
arquivo   String  @unique -- nome do arquivo em disco (uuid.sh / uuid.js / uuid.py)
conteudo  String        -- espelho do arquivo salvo no banco para exibir no editor
ativo     Boolean
createdAt DateTime
updatedAt DateTime
→ tarefas   Tarefa[]
→ execucoes Execucao[]
```

### `Execucao`

```
id          String   @id  uuid()
status      String        -- "SUCESSO" | "FALHA" | "EM_ANDAMENTO"
saida       String?       -- JSON estruturado (ver abaixo)
duracao     Int?          -- milissegundos
executadoEm DateTime      -- timestamp de início
tarefaId    String? FK → Tarefa  (nullable — execuções manuais de script têm tarefaId=null)
scriptId    String? FK → Script  (preenchido em execuções manuais)
```

**Estrutura do campo `saida` (JSON):**

```jsonc
// Script executado
{ "type": "script", "scriptNome": "meu-script", "stdout": "...", "stderr": "", "exitCode": 0 }

// Comando shell executado
{ "type": "shell", "comando": "echo ok", "stdout": "ok", "stderr": "" }

// Apenas webhook (sem comando)
{ "type": "noop", "message": "Tarefa sem ação configurada" }

// Falha
{ "error": "bash: comando: command not found" }
```

---

## Features

---

### Feature: Autenticação

Autenticação single-user via sessão HTTP (cookie assinado com `SESSION_SECRET`).

- Login em `POST /login` com `username` + `password`
- Username/password configurados em `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`)
- Todas as rotas exceto `/login` exigem sessão válida
- Para requests HTMX responde com `HX-Redirect: /login` em vez de 302

**Arquivos:** `src/plugins/auth.ts` · `src/routes/auth.ts` · `src/validators/auth.schema.ts` · `src/views/pages/login.ejs`

---

### Feature: Tarefas

Unidade central do sistema. Define **o que executar** (script vinculado ou comando direto + webhook) e **quando executar** (dias + horários).

#### Agendamento

Cada tarefa tem agendamento flat na própria tabela:

- **`diasSemana`**: JSON array de números (`0`=Dom, `1`=Seg … `6`=Sáb)
- **`horarios`**: JSON array de strings no formato `"HH:MM"`

O scheduler combina todos horários × dias para criar jobs cron independentes.

#### Clonar tarefa

Botão **Clonar** na listagem abre o formulário pré-preenchido. Cria uma nova tarefa independente.

**Rota:** `GET /tarefas/clonar/:id`

**Arquivos:** `src/routes/tarefas.ts` · `src/services/tarefa.service.ts` · `src/validators/tarefa.schema.ts` · `src/views/pages/tarefa-form.ejs` · `src/views/partials/agendamento-fields.ejs` · `src/views/partials/task-card.ejs`

---

### Feature: Scripts

Módulo para criar, editar e executar scripts diretamente na máquina onde o servidor roda.

#### Como funciona

1. Usuário cria um script pela UI com nome, tipo e conteúdo no **Monaco Editor**
2. Sistema salva o conteúdo em disco em `scripts/user/<uuid>.<ext>` e no banco
3. O UUID do arquivo é exibido na listagem e no formulário para ser referenciado em outros scripts
4. Script pode ser executado **manualmente** (botão Executar no card) ou **agendado** via Tarefa vinculada

#### Tipos suportados

| Tipo     | Extensão | Linux                    | Windows                             |
| -------- | -------- | ------------------------ | ----------------------------------- |
| `SHELL`  | `.sh`    | `bash -c "arquivo 2>&1"` | `bash -c "arquivo 2>&1"` (Git Bash) |
| `NODEJS` | `.js`    | `node arquivo`           | `node arquivo`                      |
| `PYTHON` | `.py`    | `python3 arquivo`        | `python arquivo`                    |

> Para SHELL, stdout e stderr são **mesclados em ordem real** via `2>&1`. Tudo que o script
> imprimir chega como `stdout` — exatamente como você veria no terminal.

#### Referenciando scripts entre si

O filename (UUID) aparece na UI. Use-o para orquestrar:

```bash
#!/bin/bash
# Script SHELL que ativa venv e chama Python
cd "$(dirname "$0")"
source /home/pi/venv/bin/activate
python3 ./uuid-do-script-python.py
```

```bash
#!/bin/bash
# Script que instala deps e executa Node.js
cd "$(dirname "$0")"
npm install --silent
node ./uuid-do-script-node.js
```

#### Dependências npm para scripts Node.js

```bash
# Instalar uma vez no servidor
cd /caminho/do/projeto/scripts/user
npm install nodemailer axios
```

O `node_modules/` criado é compartilhado por **todos** os `.js` do diretório. O sistema executa os scripts com `cwd: scripts/user/`, então `require('nodemailer')` funciona automaticamente.

#### Rotas

| Método   | Rota                           | Descrição                                  |
| -------- | ------------------------------ | ------------------------------------------ |
| `GET`    | `/scripts`                     | Listagem                                   |
| `GET`    | `/scripts/novo`                | Formulário de criação                      |
| `GET`    | `/scripts/:id/editar`          | Formulário de edição                       |
| `POST`   | `/scripts`                     | Cria script + arquivo em disco             |
| `POST`   | `/scripts/:id` (`_method=PUT`) | Atualiza script + arquivo                  |
| `DELETE` | `/scripts/:id`                 | Remove script + arquivo (HTMX)             |
| `POST`   | `/scripts/:id/executar`        | Executa manualmente, retorna HTML via HTMX |

**Arquivos:** `src/routes/scripts.ts` · `src/services/script.service.ts` · `src/validators/script.schema.ts` · `src/views/pages/scripts.ejs` · `src/views/pages/script-form.ejs` · `src/views/partials/script-card.ejs` · `src/views/partials/execution-output.ejs`

---

### Feature: Execuções

Registro histórico de todas as execuções (agendadas ou manuais).

- Execuções agendadas têm `tarefaId` preenchido
- Execuções manuais de script têm `tarefaId = null` e `scriptId` preenchido
- A coluna "Tarefa" na listagem exibe o nome da tarefa, ou `Script: nome` para execuções manuais

**Arquivos:** `src/routes/execucoes.ts` · `src/services/execucao.service.ts` · `src/views/pages/execucoes.ejs` · `src/views/partials/execution-row.ejs`

---

### Feature: Agendamento (Scheduler)

Plugin `src/plugins/scheduler.ts` iniciado junto com o servidor:

1. `loadAll()` — busca tarefas ativas e cria jobs cron para cada combinação horário × dia
2. A cada minuto que bate, dispara `executeTask(prisma, tarefa)`
3. Jobs identificados por chave `"tarefaId:agendamentoIndex:horarioIndex"` — permite remoção cirúrgica

| Evento         | Ação no scheduler                            |
| -------------- | -------------------------------------------- |
| Startup        | `loadAll()` — carrega todos os ativos        |
| Criar tarefa   | `scheduleTask(id)`                           |
| Editar tarefa  | `rescheduleTask(id)` → unschedule + schedule |
| Toggle ativar  | `scheduleTask(id)`                           |
| Toggle pausar  | `unscheduleTask(id)`                         |
| Deletar tarefa | `unscheduleTask(id)` antes do delete         |
| Shutdown       | `task.stop()` em todos os jobs               |

**Arquivos:** `src/plugins/scheduler.ts` · `src/services/cron.service.ts` · `src/services/execucao.service.ts`

---

## Fluxos detalhados

### Fluxo 1 — Cadastro de Tarefa

```
POST /tarefas
    │
    ├─ 1. parseFormTarefa(body)              src/validators/tarefa.schema.ts
    │        extrai diasSemana → number[]
    │        extrai horarios → string[]
    │        extrai scriptId (opcional)
    │
    ├─ 2. tarefaCreateSchema.safeParse(input)
    │        nome: min 1, max 100
    │        horarios: regex /^\d{2}:\d{2}$/
    │        diasSemana: pelo menos 1 dia
    │        webhookUrl: url válida ou vazia
    │
    ├─ 3. createTarefa(prisma, data)          src/services/tarefa.service.ts
    │        prisma.tarefa.create({
    │          diasSemana: JSON.stringify([1,2]),
    │          horarios:   JSON.stringify(["08:00","18:00"]),
    │          scriptId:   "uuid-do-script" | null
    │        })
    │
    ├─ 4. app.scheduler.scheduleTask(tarefa.id)
    │
    └─ 302 → /tarefas
```

---

### Fluxo 2 — Como o cron é criado

```
scheduleTask(tarefaId)                       src/plugins/scheduler.ts
    │
    ├─ busca tarefa com diasSemana e horarios
    │
    └─ generateCronExpressions(diasSemana, horarios)   src/services/cron.service.ts
         │
         │  diasSemana = "[1,2,3,4,5]"   → diasStr = "1,2,3,4,5"
         │  horarios = '["08:00","18:00"]'
         │
         └─ Uma expressão por horário:
              "0 8 * * 1,2,3,4,5"
              "0 18 * * 1,2,3,4,5"
              │
              └─ cron.schedule(expr, callback)
                 key = "tarefaId:horarioIndex"
                 jobs.set(key, task)
```

---

### Fluxo 3 — Execução de uma Tarefa (Trigger do cron)

```
node-cron dispara
    │
    └─ executeTask(prisma, tarefa)           src/services/execucao.service.ts
        │
        ├─ prisma.execucao.create({ status: "EM_ANDAMENTO" })
        │
        ├─ tarefa.scriptId preenchido?
        │   ├─ SIM → busca Script no banco
        │   │        spawn bash/node/python3 com o arquivo UUID
        │   │        cwd: config.scriptsDir
        │   │        captura stdout (stderr mergeado via 2>&1 para SHELL)
        │   │
        │   └─ NÃO → tarefa.comandoOuPayload preenchido?
        │             ├─ SIM → child_process.exec(comando, { timeout: 60s })
        │             │        captura stdout e stderr separados
        │             │
        │             └─ NÃO → type: "noop"
        │
        ├─ tarefa.webhookUrl preenchido?
        │   └─ SIM → sendDiscordWebhook(url, { nome, descricao, payload })
        │
        └─ prisma.execucao.update({ status, saida, duracao })
             SUCESSO se exitCode === 0
             FALHA se qualquer erro / timeout / exitCode !== 0
```

---

### Fluxo 4 — Execução de Script

```
POST /scripts/:id/executar             (botão Executar no card — HTMX)
    │
    └─ executeScriptManually(prisma, scriptId)   src/services/script.service.ts
        │
        ├─ prisma.execucao.create({ scriptId, tarefaId: null, status: "EM_ANDAMENTO" })
        │
        ├─ executorPorTipo(tipo, filePath)
        │   SHELL  → bash  ["-c", '"arquivo" 2>&1']
        │   NODEJS → node  [filePath]
        │   PYTHON → python3 [filePath]          (python no Windows)
        │
        ├─ spawn(cmd, args, { cwd: config.scriptsDir, timeout: 60s })
        │
        └─ prisma.execucao.update({ status, saida, duracao })
           reply.view("partials/execution-output.ejs", { result })
           → HTMX injeta o HTML no #output-{id} do card
```

---

### Fluxo 5 — Autenticação

```
POST /login
    │
    ├─ loginSchema.safeParse({ username, password })
    │
    └─ app.login(reply, username, password)      src/plugins/auth.ts
        │
        ├─ bcrypt.compare(password, ADMIN_PASSWORD_HASH)
        ├─ generateSessionId() → 32 bytes hex
        ├─ signCookie(sid, SESSION_SECRET) → "sid.hashHMAC"
        ├─ prisma.session.create({ sid, data, expiresAt })
        └─ reply.setCookie("fatia.sid", signedValue, { httpOnly, sameSite: "lax" })
```

**Verificação a cada request (`onRequest` hook):**

```
1. lê cookie "fatia.sid"
2. verifySignedCookie() — recomputa HMAC e compara
3. prisma.session.findUnique({ sid })
4. verifica session.expiresAt > now
5. request.isAuthenticated = true
```

---

## Variáveis de ambiente (`.env`)

```env
DATABASE_URL="file:./data/fatia.db"

# Credenciais do único usuário admin
ADMIN_EMAIL=admin                      # username (não precisa ser email)
ADMIN_PASSWORD_HASH=$2b$10$...         # gerar com: npx tsx scripts/hash-password.ts

# Assina os cookies de sessão
SESSION_SECRET=troque-isso-por-algo-aleatorio-e-longo

# Scheduler
ENABLE_SCHEDULER=true
TZ=America/Sao_Paulo

# Diretório dos scripts (padrão: <projeto>/scripts/user)
# SCRIPTS_DIR=/caminho/customizado/scripts

LOG_LEVEL=info
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

---

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Gerar hash da senha
npx tsx scripts/hash-password.ts
# Cole o hash em ADMIN_PASSWORD_HASH no .env

# 3. Criar/migrar o banco
npx prisma migrate dev

# 4. Desenvolvimento (tsx watch, sem compile)
npm run dev

# 5. Produção
npm run build
npm start

# 6. Produção com PM2
pm2 start ecosystem.config.cjs
```

---

## Camadas e responsabilidades

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  DaisyUI + Tailwind (CDN) · HTMX · Lucide · Monaco (CDN)│
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP
           form POST · hx-patch · hx-delete · hx-get
                       │
┌──────────────────────▼───────────────────────────────────┐
│  Rotas  (src/routes/)                                    │
│  • Entrada validada com Zod (src/validators/)            │
│  • Guard: preHandler app.requireAuth                     │
│  • Orquestra serviços e renderiza view                   │
│  auth · dashboard · tarefas · scripts · execucoes        │
└─────────┬────────────────────────────────────────────────┘
          │
     ┌────┴─────┐
     │          │
┌────▼───┐  ┌───▼─────────────────────────────────────────┐
│Services│  │ Plugins                                      │
│        │  │                                             │
│tarefa  │  │ prisma.ts  → app.prisma (PrismaClient)      │
│script  │  │ auth.ts    → app.login/logout/requireAuth    │
│execucao│  │ scheduler.ts → app.scheduler (cron jobs)    │
│cron    │  └─────────────────────────────────────────────┘
│webhook │
└────┬───┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Prisma ORM → SQLite (data/fatia.db)                      │
│  sessions · tarefas · scripts · execucoes                 │
└────┬──────────────────────────────────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Sistema Operacional                                      │
│  spawn bash/node/python3 → stdout/stderr capturados       │
│  axios → Discord Webhook (opcional, por tarefa)           │
└───────────────────────────────────────────────────────────┘
```

---

## CSP — Regras importantes

O app usa Content Security Policy restritivo. Regras críticas para desenvolvedores:

| Diretiva          | Valor                                            | Impacto                                                               |
| ----------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| `script-src-attr` | `'none'`                                         | **Proibido** qualquer `onclick=`, `onchange=` em atributo HTML        |
| `script-src`      | `'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net` | Scripts externos só do jsDelivr; `unsafe-eval` necessário para Monaco |
| `worker-src`      | `blob:`                                          | Necessário para Monaco Editor funcionar                               |

**Padrão obrigatório para interações JS:**

```html
<!-- ERRADO — bloqueado pelo CSP -->
<button onclick="minhaFuncao()">Click</button>

<!-- CORRETO — classe CSS + event delegation no footer.ejs -->
<button class="minha-acao" data-id="<%= item.id %>">Click</button>
```

```javascript
// src/views/layouts/footer.ejs — adicionar ao event delegation existente
document.body.addEventListener("click", function (e) {
  var btn = e.target.closest(".minha-acao");
  if (!btn) return;
  var id = btn.dataset.id;
  // lógica aqui
});
```

---

## Guia: Como criar uma nova tela/feature

Exemplo completo adicionando um módulo `Notificacoes`.

### Passo 1 — Schema Prisma

Adicione o model em `prisma/schema.prisma`:

```prisma
model Notificacao {
  id        String   @id @default(uuid())
  mensagem  String
  lida      Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt     @map("updated_at")

  @@map("notificacoes")
}
```

Rode a migration:

```bash
npx prisma migrate dev --name add-notificacoes
```

### Passo 2 — Validator (Zod)

Crie `src/validators/notificacao.schema.ts`:

```typescript
import { z } from "zod";

export const notificacaoSchema = z.object({
  mensagem: z.string().min(1, "Mensagem obrigatória").max(500),
});

export type NotificacaoInput = z.infer<typeof notificacaoSchema>;

export function parseFormNotificacao(body: Record<string, unknown>) {
  return notificacaoSchema.safeParse({ mensagem: body.mensagem });
}
```

### Passo 3 — Service

Crie `src/services/notificacao.service.ts`:

```typescript
import type { PrismaClient } from "@prisma/client";
import type { NotificacaoInput } from "../validators/notificacao.schema.js";

export function listNotificacoes(prisma: PrismaClient) {
  return prisma.notificacao.findMany({ orderBy: { createdAt: "desc" } });
}

export function createNotificacao(
  prisma: PrismaClient,
  data: NotificacaoInput,
) {
  return prisma.notificacao.create({ data });
}

export function deleteNotificacao(prisma: PrismaClient, id: string) {
  return prisma.notificacao.delete({ where: { id } });
}
```

### Passo 4 — Rota

Crie `src/routes/notificacoes.ts`:

```typescript
import type { FastifyPluginAsync } from "fastify";
import {
  listNotificacoes,
  createNotificacao,
  deleteNotificacao,
} from "../services/notificacao.service.js";
import { parseFormNotificacao } from "../validators/notificacao.schema.js";

export const notificacaoRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (_req, reply) => {
    const notificacoes = await listNotificacoes(app.prisma);
    return reply.view("pages/notificacoes.ejs", {
      notificacoes,
      isAuthenticated: true,
      currentPage: "notificacoes",
    });
  });

  app.post("/", async (req, reply) => {
    const parsed = parseFormNotificacao(req.body as Record<string, unknown>);
    if (!parsed.success) {
      const notificacoes = await listNotificacoes(app.prisma);
      return reply.view("pages/notificacoes.ejs", {
        notificacoes,
        errors: parsed.error.issues,
        isAuthenticated: true,
        currentPage: "notificacoes",
      });
    }
    await createNotificacao(app.prisma, parsed.data);
    return reply.redirect("/notificacoes");
  });

  // HTMX delete — retorna string vazia para remover o elemento
  app.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteNotificacao(app.prisma, id);
    return reply.send("");
  });
};
```

### Passo 5 — Registrar em `app.ts`

```typescript
// src/app.ts
import { notificacaoRoutes } from "./routes/notificacoes.js";

// dentro de buildApp():
await app.register(notificacaoRoutes, { prefix: "/notificacoes" });
```

### Passo 6 — Views

`src/views/pages/notificacoes.ejs`:

```html
<%- include('../layouts/header', { title: 'Notificações', isAuthenticated: true,
currentPage: 'notificacoes' }) %>

<div class="max-w-3xl mx-auto space-y-4">
  <h2 class="text-2xl font-bold">Notificações</h2>

  <div id="notificacoes-list">
    <% notificacoes.forEach(function(n) { %> <%-
    include('../partials/notificacao-card', { n }) %> <% }) %>
  </div>
</div>

<%- include('../layouts/footer') %>
```

`src/views/partials/notificacao-card.ejs`:

```html
<div class="card bg-base-200" id="notificacao-<%= n.id %>">
  <div class="card-body flex-row items-center justify-between">
    <p><%= n.mensagem %></p>
    <button
      class="btn btn-sm btn-error btn-outline"
      hx-delete="/notificacoes/<%= n.id %>"
      hx-target="#notificacao-<%= n.id %>"
      hx-swap="outerHTML"
      hx-confirm="Remover notificação?"
    >
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  </div>
</div>
```

### Passo 7 — Navbar

Em `src/views/partials/navbar.ejs`, adicione o link seguindo o padrão:

```html
<li>
  <a
    href="/notificacoes"
    class="<% if (typeof currentPage !== 'undefined' && currentPage === 'notificacoes') { %>active<% } %>"
  >
    <i data-lucide="bell" class="w-4 h-4"></i> Notificações
  </a>
</li>
```

Adicione também no dropdown mobile (mesmo arquivo, seção `lg:hidden`).

### Passo 8 — Checklist antes de commitar

- [ ] `npx tsc --noEmit` sem erros
- [ ] Migration criada e aplicada (`npx prisma migrate dev`)
- [ ] Rota registrada em `src/app.ts`
- [ ] Nenhum `onclick=` ou handler inline nas views (CSP bloqueia — use classes + `footer.ejs`)
- [ ] HTMX para ações destrutivas (delete) com `hx-confirm`
- [ ] Link na navbar com `currentPage` ativo em desktop e mobile
- [ ] `isAuthenticated: true` e `currentPage` passados para todas as views da feature

---

## Deploy (Raspberry Pi)

### Script automático

```bash
chmod +x deploy.sh
./deploy.sh
```

O `deploy.sh`:

1. `pm2 delete app` — remove processo antigo
2. `npm ci` — instala dependências limpas
3. `npx prisma generate && npx prisma migrate deploy` — aplica migrations
4. `npm run build` — compila TypeScript
5. `pm2 start ecosystem.config.cjs` + `pm2 save`

### Variáveis de ambiente em produção

```env
DATABASE_URL="file:/home/pi/fatia-rapida/prisma/prod.db"
SESSION_SECRET="string-longa-diferente-do-dev"
ADMIN_EMAIL="seu-username"
ADMIN_PASSWORD_HASH="$2b$10$..."
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
ENABLE_SCHEDULER=true
TZ=America/Sao_Paulo
```
