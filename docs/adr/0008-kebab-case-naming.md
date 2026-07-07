# ADR-0008: kebab-case nos arquivos do backend

Date: 2026-07-07
Status: Accepted

## Context

O backend usava ponto como separador (`execucao.service.ts`, `auth.schema.ts`), enquanto o frontend (EJS partials) já usava kebab-case (`script-card.ejs`, `execution-detail.ejs`). Inconsistência interna e divergência da convenção Node/JS.

## Decision

Padronizar backend em **kebab-case**: `execucao-service.ts`, `auth-form.ts`, `script-action-executor.ts`. Sufixo `-service` / `-route` / `-plugin` / `-executor` / `-channel` pra papéis (singular: `tarefaService`, `tarefaRoute` — alinhado com `tarefaService`).

## Consequences

- **+** Consistência com o frontend EJS e com a convenção Node/JS.
- **+** Sufixo de papel (-service, -route) deixa clara a responsabilidade no nome.
- **+** Busca/glob mais natural (`*-service.ts` pega todos os services).
- **−** Migration mecânica (renomear + atualizar imports) — feito na refatoração.
- **−** Exceção: `next-env.d.ts`, `tsconfig.json` (convenção da tooling, não tocar).
