# ADR-0003: Sem Repository pattern (Prisma singleton)

Date: 2026-07-07
Status: Accepted

## Context

O dogma DDD clássico pede repository port (interface) + impl por agregado, pra desacoplar o domínio do ORM. O Prisma já gera um client tipado com queries ricas (`where`, `include`, `_count`).

## Decision

**Não** fazer port+impl de repository. `PrismaClient` vira singleton em `infrastructure/persistence/prisma.ts`, injetado nos services via composition root. Os services chamam `this.prisma.x.findMany(...)` diretamente.

## Consequences

- **+** Menos ceremony (sem interface + impl por agregado que só delega).
- **+** Prisma tipado já cumpre o papel de repository.
- **+** Menos arquivos, menos indireção.
- **−** Domínio acopla a tipos do Prisma (`PrismaClient`, `Tarefa`).
- **−** Mockar pra teste exige mockar Prisma (ou DB real). Trade-off aceitável enquanto não há testes.
- **⇄** Reversível: se um dia precisar trocar de ORM ou mockar além do Prisma, criar a interface de repository por agregado sem mexer nos services callers (só no composition root).
