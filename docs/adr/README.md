# Architecture Decision Records (ADRs)

Decisões arquiteturais do Fatia Rápida v2. Formato [Nygard](https://github.com/joelparkerhenderson/architecture-decision-record): **Contexto → Decisão → Consequências**.

| # | Título | Status |
|---|--------|--------|
| [0001](0001-ddd-layering.md) | Layering DDD (api/core/domain/infrastructure) | Accepted |
| [0002](0002-composition-root-over-spring-di.md) | Composition root manual (sem container de DI) | Accepted |
| [0003](0003-no-repository-pattern.md) | Sem Repository pattern (Prisma singleton) | Accepted |
| [0004](0004-const-enums-over-enum.md) | Const object tipado (sem `enum` do TS) | Accepted |
| [0005](0005-output-dto-only-with-transformation.md) | Output DTO só com transformação real | Accepted |
| [0006](0006-ssr-over-spa.md) | SSR (EJS + HTMX) em vez de SPA | Accepted |
| [0007](0007-ensure-cache-over-temp-file.md) | Cache self-healing (`ensure`) em vez de temp-file | Accepted |
| [0008](0008-kebab-case-naming.md) | kebab-case nos arquivos do backend | Accepted |

## Como adicionar um novo ADR

1. Numere o próximo (`0009-...`).
2. Copie o formato: `Date`, `Status` (Proposed/Accepted/Superseded), `Context`, `Decision`, `Consequences`.
3. Adicione na tabela acima.
4. Cadastre o ADR quando uma decisão for **não-óbvia** e tiver trade-offs que valem registrar (recrutadores e futuros contribuidores agradecem).
