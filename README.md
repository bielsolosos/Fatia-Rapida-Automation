# 🍕 Fatia Rápida v2

Automação de tarefas com agendamento — otimizado para Raspberry Pi.

## Stack

- **Fastify** — Framework HTTP leve e rápido
- **EJS** — Templates server-side
- **HTMX** — Interatividade sem SPA (~50KB)
- **Pico CSS** — Framework CSS classless com dark mode
- **Prisma** — ORM com SQLite
- **node-cron** — Agendamento de tarefas
- **Zod** — Validação de dados

## Requisitos

- Node.js 20+
- npm

## Setup

```bash
# Instalar dependências
npm install

# Gerar hash da senha admin
npm run hash-password

# Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com seu ADMIN_PASSWORD_HASH gerado acima

# Criar banco de dados
npx prisma db push

# (Opcional) Popular com dados de exemplo
npm run seed

# Iniciar em dev
npm run dev
```

## Credenciais padrão (dev)

- **Email:** admin@fatia.local
- **Senha:** admin123

## Scripts

| Comando                 | Descrição                        |
| ----------------------- | -------------------------------- |
| `npm run dev`           | Dev server com hot reload        |
| `npm run build`         | Compilar TypeScript              |
| `npm start`             | Iniciar produção                 |
| `npm run db:push`       | Sincronizar schema com banco     |
| `npm run db:migrate`    | Rodar migrations                 |
| `npm run hash-password` | Gerar hash bcrypt                |
| `npm run seed`          | Popular banco com dados de teste |

## Deploy (Raspberry Pi)

```bash
# Build
npm run build

# Com PM2
pm2 start ecosystem.config.cjs

# Monitorar
pm2 monit
```

## Arquitetura

```
src/
├── app.ts              # Bootstrap Fastify + plugins
├── server.ts           # Entry point
├── config.ts           # Variáveis de ambiente
├── plugins/
│   ├── prisma.ts       # PrismaClient como decorator
│   ├── auth.ts         # Sessions + cookies httpOnly
│   └── scheduler.ts    # node-cron lifecycle
├── routes/
│   ├── auth.ts         # Login/logout
│   ├── dashboard.ts    # Home com stats
│   ├── tarefas.ts      # CRUD tarefas + agendamentos
│   └── execucoes.ts    # Listagem de execuções
├── services/
│   ├── tarefa.service.ts
│   ├── execucao.service.ts
│   ├── cron.service.ts
│   └── webhook.service.ts
├── validators/
│   ├── auth.schema.ts
│   └── tarefa.schema.ts
└── views/
    ├── layouts/        # Header/footer EJS
    ├── partials/       # Componentes HTMX
    └── pages/          # Páginas completas
```

## vs. Projeto Antigo

|              | v1 (oldProject)          | v2                            |
| ------------ | ------------------------ | ----------------------------- |
| Framework    | Express + React SPA      | Fastify + EJS + HTMX          |
| Processos    | 2 (API + Vite)           | 1 (fullstack)                 |
| Auth         | JWT + refresh em memória | Sessions + cookies no SQLite  |
| Multi-user   | Sim (com roles)          | Single-user (admin via .env)  |
| RAM estimada | ~400-600MB               | ~150-250MB                    |
| Deps (prod)  | ~30 pacotes              | ~12 pacotes                   |
| Playwright   | Declarado, nunca usado   | Removido                      |
| Swagger      | Sim                      | Removido (não há API externa) |
