# ADR-0006: SSR (EJS + HTMX) em vez de SPA

Date: 2026-07-07
Status: Accepted

## Context

Decisão se mantém SSA (single-page app) ou SSR com HTMX. O app é single-user, escopo pequeno, roda em Raspberry Pi (recursos limitados). Os problemas identificados (services desorganizados, god-functions) eram todos de backend — SPA não resolveria nenhum, adicionaria complexidade.

## Decision

Manter **SSR (EJS + HTMX)**. Não migrar pra SPA agora. O backend é refatorado pra ser **transport-agnóstico**: hoje `reply.view(ejs, data)`; amanhã `reply.send(dto)` — o domínio não muda.

## Consequences

- **+** Stack simples (sem Vite, sem router client, sem TanStack Query, sem JWT/refresh/CORS).
- **+** Virtude do HTMX: partials sem framework JS, carrega rápido no Pi.
- **+** Monaco Editor já funciona como "ilha" client-side (islands architecture) — não precisa de SPA inteiro.
- **−** Interatividade rica (streaming ao vivo, dashboard com charts) seria melhor em SPA.
- **⇄** Gatilhos pra reconsiderar: multi-usuário com roles, streaming de execução ao vivo virar central, dashboard analítico, cliente mobile. O refactor DDD deixa a migração futura barata (só trocar os routes).
