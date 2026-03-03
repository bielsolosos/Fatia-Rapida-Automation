# Fatia Rápida v2

Automação de tarefas agendadas via cron — pensado para rodar em **Raspberry Pi com 1 GB de RAM**.

---

## Stack

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| **HTTP Server** | [Fastify v5](https://fastify.dev) | Leve, rápido, plugin-first — menos RAM que Express |
| **Templates** | [EJS](https://ejs.co) + `@fastify/view` | Renderização server-side, sem bundle JS |
| **Interatividade** | [HTMX v2](https://htmx.org) | Swap parcial de HTML via `hx-*`, sem framework frontend |
| **Estilos** | [DaisyUI v4](https://daisyui.com) + [Tailwind CSS](https://tailwindcss.com) (CDN) | Componentes prontos, sem build step |
| **Ícones** | [Lucide](https://lucide.dev) (CDN) | SVG, leve, consistente |
| **Banco de dados** | SQLite via [Prisma v5](https://prisma.io) | Arquivo local, zero infra extra |
| **Agendamento** | [node-cron v3](https://github.com/node-cron/node-cron) | Expressões cron nativas do Node |
| **Execução de comandos** | `child_process.exec` (Node built-in) | Sem dependências externas |
| **Validação** | [Zod v3](https://zod.dev) | Schema type-safe no server |
| **Auth** | Sessões em SQLite + cookie HMAC | Sem JWT, sem Redis — tudo local |
| **Notificações** | Discord Webhook via [Axios](https://axios-http.com) | Opcional por tarefa |
| **Language** | TypeScript 5 + `tsx` | Sem compile em dev (`tsx watch`) |

---

## Estrutura de arquivos

```
v2/
├── prisma/
│   └── schema.prisma          # Modelos: Session, Tarefa, Agendamento, Execucao
├── public/
│   ├── css/style.css          # Overrides mínimos (HTMX transitions, .dia-check)
│   └── js/htmx.min.js         # HTMX vendorizado (sem CDN externo)
├── src/
│   ├── server.ts              # Ponto de entrada: listen + graceful shutdown
│   ├── app.ts                 # Bootstrap Fastify: registra plugins e rotas
│   ├── config.ts              # Lê variáveis .env com required()/optional()
│   ├── plugins/
│   │   ├── prisma.ts          # Decora app.prisma (PrismaClient singleton)
│   │   ├── auth.ts            # Sessões, login/logout, requireAuth, limpeza expiradas
│   │   └── scheduler.ts       # SchedulerManager: loadAll/schedule/unschedule/reschedule
│   ├── routes/
│   │   ├── auth.ts            # GET /login, POST /login, POST /logout
│   │   ├── dashboard.ts       # GET / — stats agregadas
│   │   ├── tarefas.ts         # CRUD completo + toggle + partial agendamento
│   │   └── execucoes.ts       # Listagem paginada + detalhes + delete
│   ├── services/
│   │   ├── tarefa.service.ts  # createTarefa, updateTarefa, listTarefas, toggle, delete, getDashboardStats
│   │   ├── cron.service.ts    # generateCronExpressions, formatDiasSemana, formatHorarios
│   │   ├── execucao.service.ts# executeTask: roda shell, captura stdout/stderr, salva, notifica Discord
│   │   └── webhook.service.ts # sendDiscordWebhook: embed formatado
│   ├── validators/
│   │   ├── auth.schema.ts     # loginSchema (zod)
│   │   └── tarefa.schema.ts   # agendamentoSchema, tarefaCreateSchema, parseFormTarefa
│   └── views/
│       ├── layouts/
│       │   ├── header.ejs     # DOCTYPE, CDNs, HTMX, Lucide, abertura do <main>
│       │   └── footer.ejs     # fecha <main>, <footer>, scripts JS globais (initIcons, addHorario, addAgendamento)
│       ├── partials/
│       │   ├── navbar.ejs                # Navbar com menu desktop + dropdown mobile
│       │   ├── toast.ejs                 # Fragmento de alerta (injetado via HTMX)
│       │   ├── task-card.ejs             # Card individual de tarefa (swap target do toggle/delete)
│       │   ├── agendamento-fields.ejs    # Bloco de campos de um agendamento (retornado via fetch)
│       │   ├── execution-row.ejs         # <tr> de execução (swap target do filtro)
│       │   └── execution-detail.ejs      # Conteúdo do <dialog> modal de detalhes
│       └── pages/
│           ├── login.ejs
│           ├── dashboard.ejs
│           ├── tarefas.ejs
│           ├── tarefa-form.ejs
│           ├── execucoes.ejs
│           └── error.ejs
├── scripts/
│   ├── hash-password.ts       # npm run hash-password — gera bcrypt hash para o .env
│   └── seed.ts                # npm run seed — cria tarefa de exemplo
├── .env                       # Variáveis de ambiente (não versionar)
├── ecosystem.config.cjs       # PM2: processo único, restart on crash
└── package.json
```

---

## Banco de dados — Modelos

### `Session`
```
sid       String  @id       -- ID aleatório (32 bytes hex)
data      String            -- JSON: { email, authenticatedAt }
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
createdAt        DateTime
updatedAt        DateTime
→ agendamentos   Agendamento[] -- 1:N, cascade delete
→ execucoes      Execucao[]    -- 1:N, cascade delete
```

### `Agendamento`
```
id         String  @id  uuid()
diasSemana String       -- JSON: number[]  ex: "[1,2,3,4,5]"  (0=Dom, 6=Sáb)
horarios   String       -- JSON: string[]  ex: "[\"08:00\",\"18:00\"]"
ativo      Boolean
tarefaId   String  FK → Tarefa  (cascade delete)
```
> **Por que JSON?** SQLite não tem tipo `ARRAY`. Os valores são serializados ao criar/atualizar e desserializados ao gerar as expressões cron.

### `Execucao`
```
id          String   @id  uuid()
status      String        -- "SUCESSO" | "FALHA" | "EM_ANDAMENTO"
saida       String?       -- JSON: { type, comando, stdout, stderr } ou { error }
duracao     Int?          -- milissegundos
executadoEm DateTime      -- timestamp de início
tarefaId    String  FK → Tarefa  (cascade delete)
```

**Estrutura do campo `saida` (JSON salvo no banco):**

```jsonc
// Execução de shell com sucesso
{
  "type": "shell",
  "comando": "echo 'ola mundo'",
  "stdout": "ola mundo",
  "stderr": ""
}

// Falha (exit code != 0 ou timeout)
{
  "error": "Command failed: blah\nblah: command not found"
}

// Tarefa sem ação configurada
{
  "type": "noop",
  "message": "Tarefa sem ação configurada"
}
```

---

## Fluxo 1 — Cadastro de Tarefa

```
BROWSER                          SERVER
   │                                │
   │  GET /tarefas/nova             │
   │──────────────────────────────► │  src/routes/tarefas.ts
   │                                │    preHandler: app.requireAuth
   │                                │    → reply.view("pages/tarefa-form.ejs")
   │◄────────────────────────────── │  (HTML com 1 agendamento vazio)
   │                                │
   │  [usuário clica "+ Horário"]   │
   │  JS chama addHorario(index)    │
   │  (src/views/layouts/footer.ejs)│
   │  → insere <input type="time"> no DOM
   │                                │
   │  [usuário clica "+ Agendamento"]
   │  JS chama addAgendamento()     │
   │  GET /tarefas/partial/         │
   │      agendamento-fields?index=1│
   │──────────────────────────────► │  src/routes/tarefas.ts
   │                                │    → reply.view("partials/agendamento-fields.ejs",
   │                                │        { index: 1, agendamento: null })
   │◄────────────────────────────── │  (fragmento HTML inserido no DOM via JS)
   │                                │
   │  POST /tarefas                 │
   │  Content-Type: application/x-www-form-urlencoded
   │  body:                         │
   │    nome=Ponto+matutino         │
   │    descricao=Bater+ponto       │
   │    comandoOuPayload=echo+ok    │
   │    webhookUrl=https://disc...  │
   │    agendamentos[0][diasSemana]=1
   │    agendamentos[0][diasSemana]=2
   │    agendamentos[0][horarios]=08:00
   │    agendamentos[0][horarios]=18:00
   │    agendamentos[0][ativo]=on   │
   │──────────────────────────────► │
   │                                │  1. src/routes/tarefas.ts
   │                                │       parseFormTarefa(body)
   │                                │         └► src/validators/tarefa.schema.ts
   │                                │              - extrai índices [0, 1, ...]
   │                                │              - diasSemana → number[]
   │                                │              - horarios → string[]
   │                                │              - "on" → true (checkbox)
   │                                │
   │                                │  2. tarefaCreateSchema.safeParse(input)
   │                                │       src/validators/tarefa.schema.ts
   │                                │       - nome: min 1, max 100
   │                                │       - horarios: regex /^\d{2}:\d{2}$/
   │                                │       - diasSemana: min 1 dia
   │                                │       - webhookUrl: válida ou vazia
   │                                │
   │                                │  3. createTarefa(prisma, data)
   │                                │       src/services/tarefa.service.ts
   │                                │       - prisma.tarefa.create(...)
   │                                │         com agendamentos.create:
   │                                │           diasSemana: JSON.stringify([1,2])
   │                                │           horarios:   JSON.stringify(["08:00","18:00"])
   │                                │
   │                                │  4. app.scheduler.scheduleTask(tarefa.id)
   │                                │       src/plugins/scheduler.ts
   │                                │       (ver Fluxo 2)
   │                                │
   │  302 → /tarefas                │
   │◄────────────────────────────── │
```

**Campos do formulário:**

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `nome` | ✅ | Identificador da tarefa (max 100 chars) |
| `descricao` | — | Texto livre para referência |
| `comandoOuPayload` | — | Comando shell a executar (`echo`, `curl`, script bash, etc.) |
| `webhookUrl` | — | Se preenchido, envia resultado para Discord após execução |
| `agendamentos[N][diasSemana]` | ✅ | Multi-value: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb |
| `agendamentos[N][horarios]` | ✅ | Multi-value: formato `HH:MM`, ex: `08:00` |
| `agendamentos[N][ativo]` | — | `"on"` = ativo, ausente = inativo |

---

## Fluxo 2 — Como o cron é criado

```
scheduleTask(tarefaId)
    │
    │  src/plugins/scheduler.ts — scheduleTask()
    │
    ├─ prisma.agendamento.findMany({
    │    where: { tarefaId, ativo: true, tarefa: { ativo: true } }
    │    include: { tarefa: true }
    │  })
    │
    └─ Para cada Agendamento encontrado:
         │
         │  src/services/cron.service.ts — generateCronExpressions()
         │
         │  Entrada:
         │    diasSemana = "[1,2,3,4,5]"     → diasStr = "1,2,3,4,5"
         │    horarios   = '["08:00","18:00"]'
         │
         │  Saída — uma expressão por horário:
         │    "0 8 * * 1,2,3,4,5"
         │    "0 18 * * 1,2,3,4,5"
         │
         └─ Para cada expressão cron:
              key = "tarefaId:agendamentoId:horarioIndex"
              cron.schedule(expr, callback, { timezone: TZ })
              jobs.set(key, task)
```

> Cada horário cadastrado gera um job independente no `Map<string, ScheduledTask>`.
> A chave `"tarefaId:agendamentoId:0"` permite remover jobs cirurgicamente por tarefa.

**Ciclo de vida dos jobs:**

| Evento | Arquivo | Ação no scheduler |
|--------|---------|------------------|
| Startup | `src/plugins/scheduler.ts` | `loadAll()` — carrega todos ativos |
| Criar tarefa | `src/routes/tarefas.ts` | `scheduleTask(id)` |
| Editar tarefa | `src/routes/tarefas.ts` | `rescheduleTask(id)` → unschedule + schedule |
| Toggle → ativar | `src/routes/tarefas.ts` | `scheduleTask(id)` |
| Toggle → pausar | `src/routes/tarefas.ts` | `unscheduleTask(id)` — para todos os jobs com prefixo `id:` |
| Deletar tarefa | `src/routes/tarefas.ts` | `unscheduleTask(id)` antes do delete |
| Shutdown (SIGINT/SIGTERM) | `src/plugins/scheduler.ts` hook `onClose` | `task.stop()` em todos |

---

## Fluxo 3 — Execução de uma tarefa (Trigger do cron)

```
node-cron dispara conforme expressão agendada
    │
    │  src/plugins/scheduler.ts — callback do cron.schedule()
    │  app.log.info("⏰ Executando tarefa...")
    │
    └─ executeTask(app.prisma, tarefa)
           │
           │  src/services/execucao.service.ts
           │
           ├─ 1. prisma.execucao.create({ status: "EM_ANDAMENTO" })
           │       Cria o registro antes de executar (garante rastreio mesmo em crash)
           │
           ├─ 2. SE tarefa.comandoOuPayload preenchido:
           │
           │       child_process.exec(comando, {
           │         timeout: 60_000,                     -- mata o processo após 60s
           │         shell: "cmd.exe" | "/bin/sh"         -- detecta Windows vs Linux
           │       })
           │
           │       stdout e stderr são capturados e logados no terminal:
           │         [Scheduler] ▶ Tarefa "Nome da tarefa"
           │         [Scheduler] $ echo 'teste'
           │         [Scheduler] stdout:
           │         teste
           │         [Scheduler] ✓ "Nome da tarefa" concluída em 23ms
           │
           ├─ 3. SE tarefa.webhookUrl preenchido:
           │
           │       src/services/webhook.service.ts — sendDiscordWebhook()
           │
           │       Envia embed Discord com:
           │         title:       tarefa.nome
           │         description: tarefa.descricao
           │         fields[0]:   "Resultado" → conteúdo do stdout formatado em bloco de código
           │         fields[1]:   "Erros" → stderr (se houver)
           │         timestamp:   now
           │
           │       Payload Discord montado em execucao.service.ts:
           │         "**stdout:**\n```\n<saída>\n```"
           │         + "\n**stderr:**\n```\n<erros>\n```"  (somente se stderr !== "")
           │
           ├─ 4. prisma.execucao.update({
           │       status: "SUCESSO",
           │       saida: JSON.stringify({
           │         type: "shell",
           │         comando: "echo 'teste'",
           │         stdout: "teste",
           │         stderr: ""
           │       }),
           │       duracao: <ms>
           │     })
           │
           └─ CATCH — qualquer erro (timeout, exit code != 0, etc.):
                console.error([Scheduler] ✗ ...)
                prisma.execucao.update({
                  status: "FALHA",
                  saida: JSON.stringify({ error: "mensagem do erro" }),
                  duracao: <ms>
                })
```

---

## Fluxo 4 — Autenticação

```
POST /login
    │
    │  src/routes/auth.ts
    │
    ├─ loginSchema.safeParse({ email, password })
    │    └► src/validators/auth.schema.ts
    │         email: z.string().email()
    │         password: z.string().min(1)
    │
    └─ app.login(reply, email, password)
           │
           │  src/plugins/auth.ts — decorator login()
           │
           ├─ bcrypt.compare(password, ADMIN_PASSWORD_HASH)
           ├─ generateSessionId() — 32 bytes via crypto.getRandomValues()
           ├─ signCookie(sid, SESSION_SECRET) → "sid.hashHMAC"
           ├─ prisma.session.create({
           │    sid,
           │    data: JSON.stringify({ email, authenticatedAt }),
           │    expiresAt: now + SESSION_MAX_AGE
           │  })
           └─ reply.setCookie("fatia.sid", signedValue, {
                httpOnly: true,
                sameSite: "lax",
                path: "/"
              })
```

**Verificação a cada request (`onRequest` hook em `src/plugins/auth.ts`):**
```
1. lê cookie "fatia.sid"
2. verifySignedCookie() — separa sid do hash, recomputa e compara
3. prisma.session.findUnique({ sid })
4. verifica session.expiresAt > now
5. request.isAuthenticated = true
6. request.session = { email, authenticatedAt }
```

**`requireAuth` (decorator em `src/plugins/auth.ts`):**

Todas as rotas protegidas passam por `preHandler: app.requireAuth`.
Para requests HTMX (`hx-request` header), responde com `HX-Redirect: /login` em vez de 302.

---

## Variáveis de ambiente (`.env`)

```env
DATABASE_URL="file:./data/fatia.db"

# Credenciais do único usuário admin
ADMIN_EMAIL=admin@fatia.local
ADMIN_PASSWORD_HASH=$2b$10$...    # gerar com: npm run hash-password

# Assina os cookies de sessão (segredo longo e aleatório)
SESSION_SECRET=troque-isso-por-algo-aleatorio

# Habilita/desabilita o scheduler de cron jobs
ENABLE_SCHEDULER=true

# Timezone dos cron jobs (list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
TZ=America/Sao_Paulo

LOG_LEVEL=info   # debug | info | warn | error
PORT=3000
HOST=0.0.0.0
```

---

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Gerar hash da senha do admin
npm run hash-password
# Cole o hash gerado em ADMIN_PASSWORD_HASH no .env

# 3. Criar o banco SQLite
npm run db:push

# 4. Desenvolvimento (tsx watch, sem compile)
npm run dev

# 5. Produção com PM2
npm run build
pm2 start ecosystem.config.cjs
```

---

## Camadas e responsabilidades

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  DaisyUI + Tailwind (CDN) · HTMX · Lucide (CDN)         │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP
           form POST · hx-patch · hx-delete · hx-get
                       │
┌──────────────────────▼───────────────────────────────────┐
│  Rotas  (src/routes/)                                    │
│  Entrada validada · Auth guard · View render             │
│  tarefas.ts · execucoes.ts · dashboard.ts · auth.ts      │
└───────────────┬──────────────────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
┌───────▼────────┐  ┌────▼────────────────────────────────┐
│  Services      │  │  Plugins                            │
│                │  │                                     │
│  tarefa.srv    │  │  src/plugins/prisma.ts              │
│  cron.srv      │  │    → app.prisma (PrismaClient)      │
│  execucao.srv  │  │                                     │
│  webhook.srv   │  │  src/plugins/auth.ts                │
└───────┬────────┘  │    → app.login / app.logout         │
        │           │    → app.requireAuth                │
        │           │    → request.isAuthenticated        │
        │           │                                     │
        │           │  src/plugins/scheduler.ts           │
        │           │    → app.scheduler.loadAll()        │
        │           │    → app.scheduler.scheduleTask()   │
        │           │    → app.scheduler.unscheduleTask() │
        │           └─────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────┐
│  Prisma ORM → SQLite (data/fatia.db)                      │
│  sessions · tarefas · agendamentos · execucoes            │
└───────┬───────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────┐
│  Sistema Operacional                                      │
│  child_process.exec  → stdout/stderr capturados           │
│  axios → Discord Webhook (notificações opcionais)         │
└───────────────────────────────────────────────────────────┘
```
