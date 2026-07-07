# ADR-0001: Layering DDD (api/core/domain/infrastructure)

Date: 2026-07-07
Status: Accepted

## Context

O projeto cresceu com uma estrutura flat (`src/plugins`, `src/routes`, `src/services`, `src/validators`) onde services eram funções soltas recebendo `prisma` em toda chamada. Isso dificultava injetar logger/factory/notifier, misturava transporte com domínio, e não deixava claro quem depende de quem. O autor já usa DDD-inspirado em MVC no [Noto](https://github.com/bielsolosos) (Java/Spring) e queria consistência entre projetos.

## Decision

Adotar 4 camadas DDD: `api/` (apresentação/transporte), `domain/` (bounded contexts), `core/` (shared kernel), `infrastructure/` (detalhes técnicos). Cada bounded context (`tarefas`, `scripts`, `execucoes`, `dashboard`) com `model/`, `service/`, e sub-pastas pra padrões (`action/`, `notification/`, `runner/`).

## Consequences

- **+** Transporte isolado nos routes — amanhã SPA só muda `api/`, domínio fica.
- **+** Services com estado (deps no construtor) — logger/factory/notifier injetados.
- **+** Padrões de projeto têm home clara (`domain/execucoes/action/` agrupa o Strategy).
- **−** Mais pastas/arquivos que uma estrutura flat (cerca de 43 arquivos .ts).
- **−** Import paths relativos longos (`../../../`) — mitigável com alias `@/*` (ainda não adotado).
