# ADR-0005: Output DTO só com transformação real

Date: 2026-07-07
Status: Accepted

## Context

O Noto usa mappers de output (`PageMapper.toPageResponse`) pra anti-corruption entre entidade e DTO de API. No Fatia (SSR + EJS, single-user, sem API externa), mapear `Script` → `ScriptView` com os mesmos campos seria boilerplate puro. Mas o route de execuções montava `<tr>` HTML inline com `(exec as any)` — aí sim havia transformação real (status → badge class, data → pt-BR, fallback de nome).

## Decision

**Não** criar DTO de saída por padrão. Passar entidade Prisma direto pro EJS. Criar view model (função, não classe) **só quando** houver:
1. Transformação real (formatar, computar, truncar).
2. Agregação de múltiplas entidades.
3. Ocultação de campos sensíveis.

Input sempre tipado (Zod em `api/models/<ctx>/form.ts`).

## Consequences

- **+** Sem boilerplate de mapper espelho (`Script` → `ScriptView` idêntico).
- **+** View models só onde pagam o custo (`ExecucaoRowView` resolveu o `(exec as any)`).
- **+** Decisão reversível se virar SPA (aí output DTO volta a valer — JSON = contrato externo).
- **−** Entidade Prisma vaza no EJS — aceitável em SSR same-deployable.
- **⇄** A regra depende do transporte: se migrar pra SPA (JSON API), output DTO passa a valer sempre.
