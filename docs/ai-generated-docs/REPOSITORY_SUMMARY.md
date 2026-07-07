# Repository Analysis: Fatia Rápida v2

## Overview

**Fatia Rápida v2** is a scheduled task automation platform built for Raspberry Pi deployment. It provides a web-based dashboard to create, manage, and schedule tasks that execute shell scripts, Node.js scripts, Python scripts, or send Discord webhooks—all with zero infrastructure dependencies. The entire system runs locally on a single machine with SQLite as its database.

The project was born from a need to automate repetitive tasks on limited hardware while maintaining a clean, accessible UI for configuration and monitoring.

## Architecture

### High-Level Structure

```
fatia-rapida-v2/
├── prisma/               # Database schema and migrations
│   └── schema.prisma     # 4 models: Session, Tarefa, Script, Execucao
├── src/
│   ├── server.ts         # Entry point with graceful shutdown
│   ├── app.ts            # Fastify bootstrap, plugin registration, CSP
│   ├── config.ts         # Environment variable management
│   ├── plugins/          # Fastify plugins (prisma, auth, scheduler)
│   ├── routes/           # HTTP route handlers (auth, tarefas, scripts, execucoes)
│   ├── services/         # Business logic (tarefa, script, execucao, cron, webhook)
│   ├── validators/       # Zod schemas for input validation
│   └── views/            # EJS templates (layouts, pages, partials)
├── scripts/user/         # User-created scripts (Shell/Node/Python)
├── public/css/           # Stylesheets
└── deploy.sh            # Raspberry Pi deployment script
```

### Request Flow

```
HTTP Request
    └─ Fastify Server
        ├─ Plugin: prisma (singleton PrismaClient)
        ├─ Plugin: auth (session verification on every request)
        ├─ Plugin: helmet (CSP headers)
        ├─ Route Handler
        │   ├─ preHandler: requireAuth (redirects to /login if unauthenticated)
        │   ├─ Zod validation (src/validators/)
        │   ├─ Service layer (src/services/)
        │   └─ reply.view() → EJS renders page
        └─ EJS Template: header + page + footer
```

### Key Design Decisions

1. **No frontend framework**: HTMX handles all interactivity via partial HTML swaps
2. **Server-side rendering**: EJS templates rendered on each request
3. **Zero external services**: SQLite local file, sessions in database, no Redis/JWT
4. **Single-user auth**: Username/password with HMAC-signed session cookies
5. **Cross-platform execution**: Scripts run via spawn/exec with platform detection (Win vs Unix)

## Key Components

### 1. Authentication System (`src/plugins/auth.ts`, `src/routes/auth.ts`)

- Single-user authentication via cookie sessions
- `bcrypt` password hashing with configurable hash via `ADMIN_PASSWORD_HASH`
- HMAC-signed cookies using `SESSION_SECRET`
- Sessions stored in SQLite with TTL
- HTMX-aware redirects (`HX-Redirect` header)

### 2. Task Scheduler (`src/plugins/scheduler.ts`, `src/services/cron.service.ts`)

- Uses `node-cron` for cron-based scheduling
- Generates cron expressions from day/time JSON arrays
- One cron job per (day × time) combination per task
- Jobs identified by composite key: `tarefaId:horarioIndex`
- Lifecycle hooks: loadAll on startup, cleanup on shutdown
- Reschedule on edit, unschedule on delete/toggle off

### 3. Script Executor (`src/services/execucao.service.ts`, `src/services/script.service.ts`)

- Supports three script types: SHELL (.sh), NODEJS (.js), PYTHON (.py)
- Scripts stored on disk in `scripts/user/` with UUID filenames
- Content mirrored in SQLite for display in Monaco Editor
- Execution via `child_process.spawn` with timeout (60s default)
- Shared `node_modules/` for Node.js scripts

### 4. Task Management (`src/services/tarefa.service.ts`, `src/routes/tarefas.ts`)

- CRUD operations for scheduled tasks
- Each task defines: name, description, schedule (days + times), action (script OR shell command), optional Discord webhook
- Toggle active/paused state
- Clone task functionality

### 5. Execution Logger (`src/services/execucao.service.ts`, `src/routes/execucoes.ts`)

- Records every execution: scheduled or manual
- Tracks status: SUCESSO, FALHA, EM_ANDAMENTO
- Stores output JSON: stdout, stderr, exit code, execution time
- Paginated listing with detail modal

### 6. Discord Webhook Notifications (`src/services/webhook.service.ts`)

- Optional per-task webhook notifications
- Formatted embed with task name, description, output
- Uses Axios for HTTP requests

## Technologies Used

### Backend Stack

| Component | Technology | Version |
|-----------|------------|---------|
| HTTP Server | Fastify | v5.1 |
| Database ORM | Prisma | v5.22 |
| Database | SQLite | native |
| Validation | Zod | v3.24 |
| Scheduling | node-cron | v3.0 |
| Password Hashing | bcrypt | v5.1 |
| HTTP Client | Axios | v1.7 |
| Dev Runtime | tsx | v4.19 |
| Language | TypeScript | v5.7 |

### Frontend Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Templates | EJS | v3.1 |
| Interactivity | HTMX | v2 |
| CSS Framework | Tailwind CSS (CDN) | v4 |
| UI Components | DaisyUI | v4 |
| Icons | Lucide (CDN) | - |
| Code Editor | Monaco Editor (CDN) | v0.52 |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Process Manager | PM2 |
| Target Platform | Raspberry Pi (ARM) |
| OS Support | Linux + Windows |

## Data Flow

### Task Execution Flow

```
1. Cron triggers at scheduled time
      ↓
2. scheduler.ts calls executeTask(prisma, tarefa)
      ↓
3. Create Execucao record (status: EM_ANDAMENTO)
      ↓
4. Check tarefa.scriptId
   ├─ YES → Load Script, spawn bash/node/python3
   └─ NO → Check tarefa.comandoOuPayload
      ├─ YES → exec() shell command
      └─ NO → no-op (noop type)
      ↓
5. Capture stdout/stderr, exit code
      ↓
6. If webhookUrl → sendDiscordWebhook()
      ↓
7. Update Execucao record (status: SUCESSO/FALHA)
      ↓
8. Discord receives formatted notification (if configured)
```

### Script Execution Flow

```
1. User clicks "Executar" button (HTMX POST /scripts/:id/executar)
      ↓
2. script.service.ts → executeScriptManually()
      ↓
3. Create Execucao record (scriptId, tarefaId: null)
      ↓
4. Determine command by script.tipo:
   - SHELL  → bash -c "scripts/user/<uuid>.sh 2>&1"
   - NODEJS → node scripts/user/<uuid>.js
   - PYTHON → python3 scripts/user/<uuid>.py
      ↓
5. spawn() with cwd: scripts/user/, timeout: 60s
      ↓
6. Capture stdout/stderr via data events
      ↓
7. Update Execucao with result
      ↓
8. Return HTML partial → HTMX swaps #output-{id}
```

## Database Schema

### Session
```
sid: String (PK)      -- 32 bytes hex, HMAC-signed
data: String          -- JSON { username, authenticatedAt }
expiresAt: DateTime   -- TTL (default 7 days)
```

### Script
```
id: String (PK, UUID)
nome: String
descricao: String?
tipo: String          -- "SHELL" | "NODEJS" | "PYTHON"
arquivo: String       -- UUID filename, unique
conteudo: String      -- mirror of file content
ativo: Boolean
createdAt/updatedAt: DateTime
→ tarefas: Tarefa[]
→ execucoes: Execucao[]
```

### Tarefa
```
id: String (PK, UUID)
nome: String
descricao: String?
comandoOuPayload: String?  -- shell command OR Discord payload
webhookUrl: String?
ativo: Boolean
diasSemana: String          -- JSON number[] (0=Sun, 6=Sat)
horarios: String            -- JSON string[] ("HH:MM")
scriptId: String? (FK)
createdAt/updatedAt: DateTime
→ script: Script?
→ execucoes: Execucao[]
```

### Execucao
```
id: String (PK, UUID)
status: String              -- "SUCESSO" | "FALHA" | "EM_ANDAMENTO"
saida: String?              -- JSON output structure
duracao: Int?                -- milliseconds
executadoEm: DateTime
tarefaId: String? (FK)
scriptId: String? (FK)
```

## Team and Ownership

### Primary Author

**Gabriel Coutinho** (GitHub: @bielsolosos)
- Email: bielrochasantoscoutinho@gmail.com
- Primary contributor with 32 commits across all features
- Maintained repository under `bielsolosos` organization

### Contributor

**vps raspberry**
- Single commit: `infra: add scripts` (March 4, 2026)

### Repository Structure Ownership

| Area | Owner | Notes |
|------|-------|-------|
| Core Architecture | Gabriel Coutinho | Initial design and all major features |
| CI/Deploy | Gabriel Coutinho | deploy.sh, ecosystem.config.cjs |
| Documentation | Gabriel Coutinho | README.md with comprehensive guides |
| Code Quality | Gabriel Coutinho | ESLint configuration added June 2026 |

## Security Model

### Content Security Policy (CSP)

Critical CSP directives enforce strict script loading:

| Directive | Value | Purpose |
|-----------|-------|---------|
| `script-src-attr` | `'none'` | Blocks all inline event handlers |
| `script-src` | `'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net` | Monaco requires eval |
| `worker-src` | `blob:` | Monaco web workers |

This means:
- **Forbidden**: `<button onclick="...">`, `onchange="..."` in HTML
- **Required**: CSS class + event delegation in `footer.ejs`

### Session Security

- Cookies signed with HMAC-SHA256 using `SESSION_SECRET`
- Sessions stored server-side in SQLite (no JWT/ stateless tokens)
- `httpOnly` and `sameSite: lax` cookie flags
- 7-day default TTL

## Deployment Model

### Raspberry Pi Target

The project is specifically designed for Raspberry Pi deployment:
- ARM-compatible scripts
- PM2 process manager for resilience
- `deploy.sh` automates: npm ci, prisma migrate, build, pm2 restart
- Timezone configured for `America/Sao_Paulo`

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `SESSION_SECRET`
- [ ] Hash password with `npm run hash-password`
- [ ] Configure `DATABASE_URL` with absolute path
- [ ] Set `TZ=America/Sao_Paulo`
- [ ] Run `pm2 start ecosystem.config.cjs`

## Build and Development

### Commands

```bash
npm install           # Install dependencies
npm run dev          # Development (tsx watch, no compile)
npm run build        # Production build (tsc + copy assets)
npm start            # Run production build
pm2 start ecosystem.config.cjs  # Production with PM2
npx prisma migrate dev  # Database migrations
npx prisma studio    # Visual database editor
npm run lint         # ESLint check
```

### Environment Variables

```env
DATABASE_URL="file:./data/fatia.db"
ADMIN_EMAIL="admin"
ADMIN_PASSWORD_HASH="$2b$10$..."  # bcrypt hash
SESSION_SECRET="long-random-string"
ENABLE_SCHEDULER=true
TZ="America/Sao_Paulo"
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```
