# ADR-0002: Composition root manual (sem container de DI)

Date: 2026-07-07
Status: Accepted

## Context

Services viraram classes com constructor injection. Precisava de um lugar que instanciasse o grafo de dependências. No Noto (Spring) isso é automático (`@Service` + `@Autowired`). Em TS/Fastify não há container de DI por padrão.

## Decision

Usar **composition root manual**: uma função `buildServices(logger)` em `core/composition/composition-root.ts` instancia tudo explicitamente. Um plugin Fastify (`servicesPlugin`) chama `buildServices` e decora `app.services` (type-safe via `declare module "fastify"`).

## Consequences

- **+** O grafo de dependências é **visível num arquivo** — sem mágica, sem reflexão.
- **+** Type-safe: se faltar instanciar um serviço listado em `Services`, TS reclama.
- **+** Adicionar dep a um serviço = mexer só no composition root.
- **−** Verboso pra muitos serviços (cada um é uma linha `new X(...)`).
- **−** Sem escopo/lifecycle automático (todos singletons; não há request-scoped). Aceitável pra single-user.
