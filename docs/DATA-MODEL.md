# Modelo de Dados

> O schema Prisma, os relacionamentos e o `saida` tipado.

## Entidades

4 modelos em `prisma/schema.prisma`:

### Session
```
sid        String   @id          -- 32 bytes hex, HMAC-signed
data       String                -- JSON { username, authenticatedAt }
expiresAt  DateTime              -- TTL (default 7 dias)
```

### Script
```
id         String   @id @default(uuid())
nome       String
descricao  String?
tipo       String                -- "SHELL" | "NODEJS" | "PYTHON"  (ScriptTipo enum)
arquivo    String   @unique      -- nome do arquivo em scripts/user/ (legado pós-ensure)
conteudo   String   @default("") -- espelho do conteúdo do arquivo (source of truth)
ativo      Boolean  @default(true)
createdAt/updatedAt  DateTime
→ tarefas: Tarefa[]
→ execucoes: Execucao[]
```

### Tarefa
```
id                String   @id @default(uuid())
nome              String
descricao         String?
comandoOuPayload  String?   -- comando shell OU payload Discord
webhookUrl        String?
ativo             Boolean   @default(true)
diasSemana        String    @default("[]")  -- JSON: number[] (0=Dom, 6=Sáb)
horarios          String    @default("[]")  -- JSON: string[] ("HH:MM")
scriptId          String?   @map("script_id")
→ script: Script?   (onDelete: SetNull)
→ execucoes: Execucao[]
createdAt/updatedAt  DateTime
```

### Execucao
```
id           String   @id @default(uuid())
status       String   -- "SUCESSO" | "FALHA" | "EM_ANDAMENTO"  (ExecucaoStatus enum)
saida        String?  -- JSON: ExecucaoSaida (union tipado)
duracao      Int?     -- ms
executadoEm  DateTime @default(now())
tarefaId     String?  (onDelete: Cascade)
scriptId     String?  (onDelete: SetNull)
→ tarefa: Tarefa?
→ script: Script?
```

## ERD

```mermaid
erDiagram
    Session ||--o{ } : ""
    Script ||--o{ Tarefa : "vinculado a"
    Script ||--o{ Execucao : "rodado por"
    Tarefa ||--o{ Execucao : "dispara"
    Tarefa }o--|| Script : "scriptId?"

    Script {
        string id PK
        string nome
        string tipo
        string arquivo UK
        string conteudo
        bool ativo
    }
    Tarefa {
        string id PK
        string nome
        string comandoOuPayload
        string webhookUrl
        bool ativo
        string diasSemana
        string horarios
        string scriptId FK
    }
    Execucao {
        string id PK
        string status
        string saida
        int duracao
        datetime executadoEm
        string tarefaId FK
        string scriptId FK
    }
    Session {
        string sid PK
        string data
        datetime expiresAt
    }
```

## `conteudo` vs `arquivo` — a fonte da verdade

- **`conteudo`** (banco) — **source of truth.** O conteúdo real do script, espelhado pra alimentar o Monaco Editor na UI.
- **`arquivo`** (banco) — nome do arquivo em `scripts/user/`. **Legado pós-`ensure`**: não há mais arquivo persistente obrigatório; o disco é cache reconstrutível.
- **`scripts/user/<arquivo>`** (disco) — cache. Se faltar, `ScriptStorage.ensure` re-cria a partir de `conteudo` antes de todo spawn.

→ Detalhe do fluxo em [Execution flow](EXECUTION-FLOW.md#o-ensure--cache-self-healing).

## `saida` — o union tipado

O campo `saida` é `JSON.stringify` de um `ExecucaoSaida` (discriminated union em `domain/execucoes/model/execucao-saida.ts`):

```ts
export type ExecucaoSaida =
  | { type: "SCRIPT"; stdout: string; stderr: string; scriptNome: string; exitCode: number }
  | { type: "SHELL"; stdout: string; stderr: string; comando: string }
  | { type: "NOOP" }
  | { type: "ERROR"; error: string; stdout: string; stderr: string };
```

O modal de detalhes (`partials/execution-detail.ejs`) faz `JSON.parse(exec.saida)` e lê `parsed.error` / `parsed.stdout` / `parsed.stderr` — campos que existem em cada variante relevante. Sem `as any` no route (ver `ExecucaoRowView` em `api/models/execucao/`).

## Migrations

- `npx prisma migrate dev` — cria/aplica migrations em dev.
- `npx prisma migrate deploy` — aplica em produção (sem prompt).
- `npx prisma studio` — editor visual do banco.
