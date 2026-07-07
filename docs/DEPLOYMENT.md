# Deployment

> Como subir o Fatia Rápida em produção (Raspberry Pi + PM2).

O deploy é **PM2-based** (sem container Docker ainda). O `deploy3.sh` automatiza o ciclo no Pi.

## Fluxo do `deploy3.sh`

```bash
pm2 delete fatia-rapida 2>/dev/null || true   # remove processo antigo
npm ci                                        # deps determinísticas
npm run db:generate                           # regenera Prisma client
npm run db:migrate                            # aplica migrations (deploy mode)
npm run build                                 # tsc + copy assets → dist/
npm prune --omit=dev                          # remove devDeps (imagem leve)
pm2 start ecosystem.config.cjs                # sobe o processo
pm2 save                                      # persiste a lista do PM2
```

## `ecosystem.config.cjs`

```js
{
  name: "fatia-rapida",
  script: "./dist/server.js",
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: "400M",   // reinicia se passar de 400MB
  env: { NODE_ENV: "production" },
}
```

PM2 garante resiliência: restart automático em crash, restart por memory leak (400M), logs em `~/.pm2/logs/`. No Pi (single core), `instances: 1` (não há ganho em cluster).

## Variáveis de ambiente

| Var | Obrigatória | Descrição |
|-----|-------------|-----------|
| `DATABASE_URL` | sim | caminho do SQLite (`file:./data/fatia.db`) |
| `ADMIN_EMAIL` | sim | username do admin |
| `ADMIN_PASSWORD_HASH` | sim | bcrypt hash (gere com `npm run hash-password`) |
| `SESSION_SECRET` | sim | chave do HMAC-SHA256 do cookie |
| `ENABLE_SCHEDULER` | não | `true` (default) — liga o cron no boot |
| `TZ` | não | `America/Sao_Paulo` (recomendado no Pi) |
| `PORT` | não | `3000` |
| `HOST` | não | `0.0.0.0` |
| `NODE_ENV` | não | `production` no deploy |
| `LOG_LEVEL` | não | `info` (ou `debug` pra ver queries do Prisma) |
| `SCRIPTS_DIR` | não | path dos scripts (default `scripts/user/`) |
| `SESSION_MAX_AGE` | não | TTL da session em ms (default 7 dias) |

## Checklist de produção

- [ ] `.env` preenchido (use `.env.example` de template)
- [ ] `SESSION_SECRET` forte e aleatório
- [ ] `ADMIN_PASSWORD_HASH` gerado (`npm run hash-password`)
- [ ] `DATABASE_URL` com path absoluto no Pi
- [ ] `TZ=America/Sao_Paulo` (timezone do cron)
- [ ] `NODE_ENV=production`
- [ ] `pm2 start ecosystem.config.cjs` + `pm2 save`
- [ ] `pm2 startup` (pra reiniciar no boot do Pi)

## Statelessness — o que persiste e o que é cache

| Estado | Tipo | Persiste? |
|--------|------|-----------|
| SQLite (`data/fatia.db`) | source of truth | **sim** — precisa sobreviver reboot (path estável) |
| `scripts/user/` | cache | **não** — re-criado do banco via `ensure` |
| `node_modules/` | deps | na imagem/install |
| Sessões | no SQLite | junto com o banco |

Se o `scripts/user/` for apagado (reboot, volume faltando), o `ScriptStorage.ensure` re-materializa os arquivos a partir de `Script.conteudo` na próxima execução. O app **não quebra** — só o SQLite precisa de persistência real.

→ [Execution flow: ensure](EXECUTION-FLOW.md#o-ensure--cache-self-healing) · [ADR-0007](adr/0007-ensure-cache-over-temp-file.md)

## Docker (futuro)

Ainda não há `Dockerfile` no Fatia (deploy é PM2). Quando containerizar:
- Multi-stage build (deps → build → runner) como no [Noto front-end](https://github.com/bielsolosos/Noto-Front-end).
- Volume só em `data/` (SQLite).
- `scripts/user/` efêmero (re-criado do banco via `ensure`).
- O `ensure` já deixa o app pronto pra isso — disco é cache reconstrutível.
