# Plano de Refatoração — Fatia Rápida v2

> Companion do `DECISOES_DE_ARQUITETURA.md`. Cada item explica **como funciona
> hoje**, **o que vamos mudar**, **passos concretos** e **arquivos afetados**.
> A ordem respeita dependências: fundações primeiro, wiring por último.
>
> Convenção de naming: **todo arquivo novo/renomeado usa kebab-case**
> (`execucao-service.ts`, não `execucao.service.ts`). Ites abaixo já adotam isso.

---

## Sumário das fases

| Fase | Foco | Itens |
|------|------|-------|
| 0 | Fundações isoladas (sem deps) | 1, 2, 3, 4 |
| 1 | Extrações e reorganização de domínio | 5, 6, 7, 8, 9 |
| 2 | Padrões de projeto no núcleo de execução | 10, 11, 12 |
| 3 | Composition e wiring | 13, 14, 15, 16, 17 |
| 4 | Limpeza e correções pontuais | 18, 19, 20, 21, 22 |

---

# Fase 0 — Fundações

## Item 1: Enums const tipados em `core/enums`

### Como funciona hoje
Magic strings espalhadas: `"SUCESSO"`, `"FALHA"`, `"EM_ANDAMENTO"` em
`execucao.service.ts` e rotas; `"SHELL"`, `"NODEJS"`, `"PYTHON"` em
`script.service.ts` e `execucao.service.ts`. Sem fonte única de verdade.

### O que muda
Criar módulos de enum const tipados (NÃO `enum` do TS). Cada enum é a única
fonte dos valores string; tipos derivados alimentam Zod e condicionais.

### Passos
1. Criar `src/core/enums/script-tipo.ts`:
   ```ts
   export const ScriptTipo = { SHELL: "SHELL", NODEJS: "NODEJS", PYTHON: "PYTHON" } as const;
   export type ScriptTipo = (typeof ScriptTipo)[keyof typeof ScriptTipo];
   ```
2. Criar `src/core/enums/execucao-status.ts` (`EM_ANDAMENTO`, `SUCESSO`, `FALHA`).
3. Criar `src/core/enums/action-tipo.ts` (`SCRIPT`, `SHELL`, `NOOP`) — usado pelo
   Strategy (item 10).
4. Criar `src/core/enums/mime-type.ts` se necessário (futuro).
5. Substituir todas as magic strings por `Enum.CHAVE`.
6. Atualizar Zod schemas (`script.schema.ts`, etc.) pra derivar de
   `z.enum(Object.values(ScriptTipo))`.

### Arquivos afetados
- Novos: `src/core/enums/script-tipo.ts`, `execucao-status.ts`, `action-tipo.ts`
- Editados: `execucao.service.ts`, `script.service.ts`, `execucoes.ts` (rota),
  `script.schema.ts`, `tarefa.schema.ts`

---

## Item 2: Logger abstração em `core/logger`

### Como funciona hoje
`execucao.service.ts` usa `console.log("[Scheduler] ▶...")` e `console.error`.
O resto do app usa `app.log` (Pino). Inconsistência + services não têm acesso
ao logger (são funções soltas que recebem só `prisma`).

### O que muda
Interface `Logger` + impl `FastifyLogger` (wrap de `app.log`). Services recebem
`Logger` no construtor (item 13). Mata `console.*` em services.

### Passos
1. Criar `src/core/logger/logger.ts` — interface com `info/warn/error(msg, ctx?)`.
2. Criar `src/core/logger/fastify-logger.ts` — impl que delega pra `FastifyBaseLogger`.
3. (Opcional) Criar `src/core/logger/console-logger.ts` pra testes/scripts standalone.
4. No composition root (item 14), instanciar `FastifyLogger(app.log)` e injetar.

### Arquivos afetados
- Novos: `src/core/logger/logger.ts`, `fastify-logger.ts`, (opcional `console-logger.ts`)
- Editados: todos os services (passam a receber `Logger` no construtor)

---

## Item 3: BusinessException + global error handler

### Como funciona hoje
`execucao.service.ts` lança `Error` genérico. Rotas fazem try/catch ad-hoc
(ex: `scripts.ts` linha 131-152 trata execução manual inline). `app.ts` tem
`setErrorHandler` que só diferencia HTMX vs página de erro.

### O que muda
Portar o padrão do Noto: `BusinessException` em `core/exceptions`, lançada pelo
domínio. Global error handler traduz `BusinessException` → HTTP 400 + toast HTMX
ou página. Controllers param de try/catch regra de negócio.

### Passos
1. Criar `src/core/exceptions/business-exception.ts`:
   ```ts
   export class BusinessException extends Error {
     constructor(message: string, public readonly code?: string) { super(message); this.name = "BusinessException"; }
   }
   ```
2. Criar `src/core/exceptions/global-error-handler.ts` — função que recebe
   `(error, request, reply)` e mapeia:
   - `BusinessException` → 400 + toast (HTMX) ou `pages/error.ejs`
   - `ZodError` → 400 + mensagem do primeiro issue
   - `Error` genérico → 500 + log via `request.log`
3. Substituir o `setErrorHandler` inline do `app.ts` por essa função.
4. Lançar `BusinessException` nos pontos onde hoje se lança `Error` ou se faz
   try/catch (ex: "Script não encontrado" em `executeScriptManually`).

### Arquivos afetados
- Novos: `src/core/exceptions/business-exception.ts`, `global-error-handler.ts`
- Editados: `src/app.ts` (setErrorHandler), services que lançam erro, controllers
  que têm try/catch desnecessário

---

## Item 4: Prisma singleton em `infrastructure/persistence`

### Como funciona hoje
`src/plugins/prisma.ts` é um plugin Fastify que instancia `PrismaClient` e
decora `app.prisma`. Services recebem `prisma: PrismaClient` como 1º argumento
de toda função.

### O que muda
Prisma vira **singleton global** num módulo de infraestrutura, consumido
diretamente pelos services. O plugin Fastify fica só pra connect/disconnect
lifecycle (não precisa mais decorar `app.prisma`, mas pode manter por
compatibilidade transitória). **Sem repository port+impl** (decisão 3.2 do
disclaimer).

### Passos
1. Criar `src/infrastructure/persistence/prisma.ts`:
   ```ts
   export const prisma = new PrismaClient({ log: ... });
   export async function connectPrisma() { await prisma.$connect(); }
   export async function disconnectPrisma() { await prisma.$disconnect(); }
   ```
2. Mover a lógica de connect/disconnect do `plugins/prisma.ts` pra cá.
3. Manter `plugins/prisma.ts` como wrapper fino que chama `connectPrisma` no
   startup e `disconnectPrisma` no `onClose` (ou remover se o `server.ts`
   passar a chamar direto).
4. Services passam a importar `prisma` do módulo (ou recebê-lo no construtor
   via composition root — item 14). **Decisão:** injetar no construtor é
   preferível (testável), mas o singleton é a fonte.

### Arquivos afetados
- Novos: `src/infrastructure/persistence/prisma.ts`
- Editados: `src/plugins/prisma.ts` (vira wrapper fino ou é removido)

---

# Fase 1 — Extrações e reorganização de domínio

## Item 5: Mover cron helpers → `domain/tarefas/scheduling`

### Como funciona hoje
`src/services/cron.service.ts` tem 3 funções puras (`generateCronExpressions`,
`formatDiasSemana`, `formatHorarios`) sem estado/dependências. É um utilitário,
não um service. O nome mente sobre o papel.

### O que muda
Mover pra dentro do contexto de tarefas, separando utilitários puros do
gerenciador de schedule. Helpers viram `cron-expression-builder.ts` e
`schedule-formatter.ts` (kebab).

### Passos
1. Criar `src/domain/tarefas/scheduling/cron-expression-builder.ts` com
   `generateCronExpressions` (pura, sem mudança de lógica).
2. Criar `src/domain/tarefas/scheduling/schedule-formatter.ts` com
   `formatDiasSemana` e `formatHorarios`.
3. Atualizar imports: `scheduler.ts` (plugin) e views que usam os formatters.
4. Deletar `src/services/cron.service.ts`.

### Arquivos afetados
- Novos: `src/domain/tarefas/scheduling/cron-expression-builder.ts`,
  `schedule-formatter.ts`
- Removidos: `src/services/cron.service.ts`
- Editados: `src/plugins/scheduler.ts`, rotas/views que importavam os formatters

---

## Item 6: Mover `getDashboardStats` → `domain/dashboard`

### Como funciona hoje
`getDashboardStats` mora em `src/services/tarefa.service.ts` mas não opera sobre
Tarefa enquanto aggregate — agrega contagens de Tarefa + Execucao. Coesão fraca.

### O que muda
Extrair pra um `DashboardService` próprio em `domain/dashboard/service/`.

### Passos
1. Criar `src/domain/dashboard/service/dashboard-service.ts` (classe, item 13).
2. Mover o corpo de `getDashboardStats` pra `DashboardService.getStats()`.
3. Remover do `tarefa.service.ts`.
4. Atualizar `dashboard.ts` (rota → controller) pra consumir
   `app.services.dashboard.getStats()`.

### Arquivos afetados
- Novos: `src/domain/dashboard/service/dashboard-service.ts`
- Editados: `src/services/tarefa.service.ts`, `src/routes/dashboard.ts`

---

## Item 7: Extrair `ScriptStorage` de `script.service`

### Como funciona hoje
`src/services/script.service.ts` mistura CRUD de DB com I/O de filesystem
(`escreverArquivo`, `removerArquivo`, `garantirDiretorio`, `chmod`). Duas
preocupações numa classe.

### O que muda
Extrair o I/O de arquivo pra `domain/scripts/storage/script-storage.ts`. O
`ScriptService` foca em regra de negócio + DB, delegando persistência de
arquivo pro storage.

### Passos
1. Criar `src/domain/scripts/storage/script-storage.ts` com:
   `write(arquivo, conteudo)`, `remove(arquivo)`, `ensureDir()`.
2. Mover `escreverArquivo`/`removerArquivo`/`garantirDiretorio`/`chmod` pra lá.
3. `ScriptService` recebe `ScriptStorage` no construtor e chama `storage.write(...)`.
4. Manter a normalização LF e o `chmod 0o755` no storage.

### Arquivos afetados
- Novos: `src/domain/scripts/storage/script-storage.ts`
- Editados: `src/services/script.service.ts` (vira `script-service.ts` no destino)

---

## Item 8: Extrair `ProcessRunner` (dedup do spawn)

### Como funciona hoje
Lógica de spawn existe em 2 lugares com shapes praticamente idênticos:
- `execucao.service.ts:runCommand` (lines 170-215)
- `script.service.ts:executeScriptManually` (lines 165-197)

Ambos montam `cmd`/`args` por `tipo` + plataforma, fazem `spawn`, coletam
stdout/stderr em buffers, resolvem com `{ stdout, stderr, exitCode }`.

### O que muda
Um único `ProcessRunner` injetável, com timeout configurável. Mata a
duplicação e vira dep do `ScriptActionExecutor` (item 10) e do `ScriptService`.

### Passos
1. Criar `src/domain/execucoes/runner/process-runner.ts`:
   ```ts
   export interface RunOptions { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv; }
   export interface RunResult { stdout: string; stderr: string; exitCode: number; }
   export class ProcessRunner {
     constructor(private readonly defaults: { defaultTimeoutMs: number }) {}
     run(cmd: string, args: string[], opts?: RunOptions): Promise<RunResult> { ... }
   }
   ```
2. Mover a lógica de spawn (com buffers e eventos `close`/`error`) pra cá.
3. Eliminar `runCommand` do `execucao.service.ts` e o bloco de spawn do
   `script.service.ts:executeScriptManually`.
4. `ExecucaoResult` (script.service) e `CommandResult` (execucao.service) viram
   um único `RunResult` compartilhado.

### Arquivos afetados
- Novos: `src/domain/execucoes/runner/process-runner.ts`
- Editados: `execucao.service.ts`, `script.service.ts`

---

## Item 9: View models com transformação real (ex: `ExecucaoRowView`)

### Como funciona hoje
`src/routes/execucoes.ts` (lines 43-77) monta `<tr>` HTML inline com template
strings e `(exec as any)` casts — ignorando o partial `partials/execution-row.ejs`
que já existe.

### O que muda
Extrair a transformação pra uma função view-model (não classe, não DTO espelho)
que vive ao lado do partial. View model só existe porque há transformação real:
status → badge class, data → pt-BR, fallback de nome, truncar id.

### Passos
1. Criar `src/api/models/execucao/execucao-view.ts` com `ExecucaoRowView`
   interface e `toExecucaoRowView(exec)`.
2. Refatorar a rota `execucoes.ts` pra `execucoes.map(toExecucaoRowView)` e
   `reply.view("partials/execution-row.ejs", { rows })`.
3. Garantir que `partials/execution-row.ejs` receba o view model (não a entity).
4. **Regra geral a partir daqui:** entidade Prisma direto no EJS pra casos
   simples; view model só com transformação (decisão 3.6 do disclaimer).

### Arquivos afetados
- Novos: `src/api/models/execucao/execucao-view.ts`
- Editados: `src/routes/execucoes.ts`, `src/views/partials/execution-row.ejs`

---

# Fase 2 — Padrões de projeto no núcleo de execução

## Item 10: Strategy + Factory — `ActionExecutor`

### Como funciona hoje
`execucao.service.ts:executeTask` (lines 33-102) tem if/else de 3 ramos:
- se `tarefa.scriptId` → carrega Script, monta cmd/args por plataforma+tipo, spawn
- senão se `tarefa.comandoOuPayload` → `exec()` shell
- senão → noop (log)

Decisão `tipo → cmd/args` existe em 3 lugares (aqui, `script.service.executorPorTipo`,
e o `2>&1` trick).

### O que muda
Portar o padrão `ExportPageFactory` + `PageExporterService` do Noto. `ActionExecutor`
(interface) com 3 impls, selecionadas por `ActionExecutorFactory` keyed por
`ActionTipo` enum. Mata o if/else e centraliza a decisão de cmd/args.

### Passos
1. Criar `src/domain/execucoes/action/action-executor.ts` (interface):
   ```ts
   export interface ActionContext { tarefa: Tarefa; script?: Script | null; }
   export interface ActionResult { stdout: string; stderr: string; exitCode: number; tipo: ActionTipo; }
   export interface ActionExecutor { execute(ctx: ActionContext): Promise<ActionResult>; }
   ```
2. Criar `src/domain/execucoes/action/script-action-executor.ts` — recebe
   `ProcessRunner` (item 8) no construtor; monta cmd/args (a lógica que hoje
   está em `executorPorTipo` do `script.service`).
3. Criar `src/domain/execucoes/action/shell-action-executor.ts` — usa `exec()`
   pra `tarefa.comandoOuPayload` (mantém `cmd.exe`/`/bin/sh` por plataforma).
4. Criar `src/domain/execucoes/action/noop-action-executor.ts` — retorna vazio.
5. Criar `src/domain/execucoes/action/action-executor-factory.ts`:
   ```ts
   export class ActionExecutorFactory {
     constructor(private readonly executors: Record<ActionTipo, ActionExecutor>) {}
     for(tarefa: Tarefa): ActionExecutor {
       if (tarefa.scriptId) return this.executors[ActionTipo.SCRIPT];
       if (tarefa.comandoOuPayload) return this.executors[ActionTipo.SHELL];
       return this.executors[ActionTipo.NOOP];
     }
   }
   ```
6. Centralizar `executorPorTipo` (cmd/args por tipo+plataforma) dentro do
   `ScriptActionExecutor` — fonte única.

### Arquivos afetados
- Novos: `action-executor.ts`, `script-action-executor.ts`,
  `shell-action-executor.ts`, `noop-action-executor.ts`,
  `action-executor-factory.ts`
- Editados: `execucao.service.ts` (deixa de ter os 3 ramos), `script.service.ts`
  (delega cmd/args ao executor)

---

## Item 11: Strategy — `NotificationChannel`

### Como funciona hoje
`execucao.service.ts` (lines 104-124) embute a formatação do payload Discord e a
chamada `sendDiscordWebhook` diretamente no fluxo de execução. Discord é a
única opção e está colada na lógica.

### O que muda
`NotificationChannel` (interface) com `DiscordChannel` (impl atual).
`NotificationService` orquestra a lista de canais. Discord deixa de ser
hardcoded. Abre espaço pra Slack/Email sem mexer no `ExecucaoService`.

### Passos
1. Criar `src/domain/execucoes/notification/notification-channel.ts` (interface):
   ```ts
   export interface NotificationPayload { tarefa: Tarefa; stdout: string; stderr: string; }
   export interface NotificationChannel { send(url: string, payload: NotificationPayload): Promise<void>; }
   ```
2. Criar `src/domain/execucoes/notification/discord-channel.ts` — move a
   formatação do embed pra cá; chama `axios.post` (a lógica do `webhook.service.ts`).
3. Criar `src/domain/execucoes/notification/notification-service.ts` — recebe
   lista de canais, iterpa e envia (try/catch por canal pra não derrubar).
4. Deletar `src/services/webhook.service.ts` (absorvido pelo `discord-channel.ts`).
5. `ExecucaoService` recebe `NotificationService` no construtor; chama
   `notify(webhookUrl, payload)` se `tarefa.webhookUrl`.

### Arquivos afetados
- Novos: `notification-channel.ts`, `discord-channel.ts`, `notification-service.ts`
- Removidos: `src/services/webhook.service.ts`
- Editados: `execucao.service.ts`

---

## Item 12: Reescrever `ExecucaoService` como orquestrador

### Como funciona hoje
`executeTask` é god-function de ~140 linhas (lines 19-162) misturando: criação
de registro EM_ANDAMENTO, carregamento de Script, spawn, formatação Discord,
serialização, error handling, update final. Tudo num try/catch gigante.

### O que muda
Vira classe orquestradora fina (template method implícito): cria registro →
delega ação ao `ActionExecutor` (item 10) → delega notificação ao
`NotificationService` (item 11) → persiste resultado. Usa `ProcessRunner`
(item 8), `Logger` (item 2), `ExecucaoStatus` enum (item 1), `ExecucaoSaida`
discriminated union.

### Passos
1. Criar `src/domain/execucoes/model/execucao-saida.ts` — discriminated union:
   ```ts
   export type ExecucaoSaida =
     | { type: "script"; stdout: string; stderr: string; scriptNome: string; exitCode: number }
     | { type: "shell"; stdout: string; stderr: string; comando: string }
     | { type: "noop" }
     | { type: "error"; error: string; stdout: string; stderr: string };
   ```
2. Criar `src/domain/execucoes/service/execucao-service.ts` (classe):
   ```ts
   export class ExecucaoService {
     constructor(
       private readonly prisma: PrismaClient,
       private readonly logger: Logger,
       private readonly actionFactory: ActionExecutorFactory,
       private readonly notification: NotificationService,
     ) {}
     async runTask(tarefa: Tarefa): Promise<void> { ... }
     async runScriptManually(scriptId: string): Promise<RunResult> { ... }
   }
   ```
3. `runTask` fica ~30 linhas: cria EM_ANDAMENTO → `actionFactory.for(tarefa).execute(ctx)` →
   se `webhookUrl` `notification.send(...)` → update SUCESSO/FALHA com
   `ExecucaoSaida` tipada.
4. `runScriptManually` substitui `executeScriptManually` do `script.service`
   (unifica o caminho manual — mesma infraestrutura).
5. Deletar `src/services/execucao.service.ts`.

### Arquivos afetados
- Novos: `execucao-saida.ts`, `execucao-service.ts`
- Removidos: `src/services/execucao.service.ts`
- Editados: `src/plugins/scheduler.ts` (chama `app.services.execucao.runTask`),
  `src/routes/scripts.ts` (chama `app.services.execucao.runScriptManually`)

---

# Fase 3 — Composition e wiring

## Item 13: Service classes com constructor injection

### Como funciona hoje
Todos os services são **funções soltas** exportadas, recebendo `prisma` no 1º
argumento de cada chamada: `createTarefa(prisma, input)`, `listScripts(prisma)`,
etc. Sem lugar pra injetar logger/factory/notifier.

### O que muda
Cada service vira **classe** com deps no construtor. As chamadas viram
`service.method(input)` sem passar `prisma` cada vez.

### Passos
1. Converter `tarefa.service.ts` → `TarefaService` em
   `src/domain/tarefas/service/tarefa-service.ts`.
2. Converter `script.service.ts` → `ScriptService` em
   `src/domain/scripts/service/script-service.ts` (recebe `ProcessRunner` +
   `ScriptStorage`).
3. `ExecucaoService` já sai classe do item 12.
4. `DashboardService` já sai classe do item 6.
5. Manter métodos públicos com a mesma semântica (create/update/list/get/toggle/delete).
6. Remover o parâmetro `prisma` de cada método — vira `private readonly` no construtor.

### Arquivos afetados
- Novos: `tarefa-service.ts`, `script-service.ts` (+ os já criados em 6 e 12)
- Removidos: `src/services/tarefa.service.ts`, `script.service.ts`

---

## Item 14: Composition root em `core/composition`

### Como funciona hoje
Não existe. O wiring é implícito: `app.prisma` decorado pelo plugin, services
importados direto nos routes, `executeTask` chama `sendDiscordWebhook` direto.

### O que muda
Criar o **ponto único** que monta o grafo de dependências. Fora daqui, ninguém
sabe quem depende de quem.

### Passos
1. Criar `src/core/composition/composition-root.ts` com:
   - `Services` interface (contrato do grafo)
   - `buildServices(logger): Services` que instancia:
     - `ProcessRunner` (primitivo)
     - `NotificationService` + `DiscordChannel` (item 11)
     - `ActionExecutorFactory` + os 3 executors (item 10)
     - `TarefaService`, `ScriptService`, `ExecucaoService`, `DashboardService`
     - `SchedulerManager` (item 19)
2. Ordem de instanciação respeita deps: primitivos → notificação → action →
   services → scheduler.
3. Tipagem: o retorno **deve** satisfazer `Services` (TS reclama se faltar algo).

### Arquivos afetados
- Novos: `src/core/composition/composition-root.ts`

---

## Item 15: `servicesPlugin` Fastify

### Como funciona hoje
Não existe. Cada route importa services direto (`import { listScripts } from "../services/script.service.js"`).

### O que muda
Plugin que instancia o grafo (via `buildServices`) e decora `app.services`.
Type-safe via `declare module "fastify"`.

### Passos
1. Criar `src/infrastructure/fastify/services-plugin.ts`:
   ```ts
   declare module "fastify" { interface FastifyInstance { services: Services } }
   export const servicesPlugin = fp(async (app) => {
     const logger = new FastifyLogger(app.log);
     app.decorate("services", buildServices(logger));
     app.addHook("onClose", async () => { await app.services.scheduler.stopAll(); });
   });
   ```
2. Registrar no `app.ts` **depois** do prisma/auth, **antes** das rotas.
3. Garantir que `app.services` está disponível em todos os controllers.

### Arquivos afetados
- Novos: `src/infrastructure/fastify/services-plugin.ts`
- Editados: `src/app.ts` (registro do plugin), `src/plugins/auth.ts` (pode mover
  pra `infrastructure/fastify/auth-plugin.ts`)

---

## Item 16: Controllers — renomear routes e consumir `app.services`

### Como funciona hoje
`src/routes/*.ts` importam services direto e chamam `createTarefa(app.prisma, input)`.
HTML inline em `execucoes.ts`. try/catch ad-hoc em `scripts.ts`.

### O que muda
Renomear pra `api/controllers/` (kebab), consumir `app.services.x.method(input)`,
sem try/catch de regra (item 3), HTML inline vira partial + view model (item 9).

### Passos
1. Mover cada route:
   - `routes/auth.ts` → `api/controllers/auth-controller.ts`
   - `routes/dashboard.ts` → `api/controllers/dashboard-controller.ts`
   - `routes/tarefas.ts` → `api/controllers/tarefa-controller.ts`
   - `routes/scripts.ts` → `api/controllers/script-controller.ts`
   - `routes/execucoes.ts` → `api/controllers/execucao-controller.ts`
   - `routes/about.ts` → `api/controllers/about-controller.ts`
2. Trocar `import { createTarefa } from "../services/..."` por
   `app.services.tarefa.create(input)`.
3. Remover try/catch de regra de negócio (deixa o global handler tratar).
4. Manter `preHandler: app.requireAuth` em cada controller protegido.
5. Registrar no `app.ts` com prefixos (`/tarefas`, `/scripts`, `/execucoes`).
6. Deletar `src/routes/`.

### Arquivos afetados
- Novos: 6 controllers em `src/api/controllers/`
- Removidos: `src/routes/` inteiro
- Editados: `src/app.ts`

---

## Item 17: Global error handler wiring

### Como funciona hoje
`app.ts` `setErrorHandler` inline (lines 105-124) só diferencia HTMX vs página,
sem distinguir `BusinessException` de `Error` genérico.

### O que muda
Wire da função criada no item 3 no lugar do handler inline.

### Passos
1. Importar `globalErrorHandler` de `core/exceptions/global-error-handler.ts`.
2. Substituir `app.setErrorHandler(...)` por `app.setErrorHandler(globalErrorHandler)`.
3. Validar: `BusinessException` → 400, `ZodError` → 400, outros → 500 com log.

### Arquivos afetados
- Editados: `src/app.ts`

---

# Fase 4 — Limpeza e correções pontuais

## Item 18: Corrigir `signCookie` → HMAC-SHA256 real

### Como funciona hoje
`src/plugins/auth.ts:signCookie` (lines 26-36) é DJB2 — hash 32-bit não
criptográfico, loop simples sobre chars. `REPOSITORY_SUMMARY.md` alega
"HMAC-SHA256" mas o código não cumpre. Vulnerabilidade latente: cookie pode ser
forjado com pouco esforço.

### O que muda
Usar `crypto.createHmac("sha256", secret)` de verdade.

### Passos
1. Reescrever `signCookie` e `verifySignedCookie` com `node:crypto`:
   ```ts
   import { createHmac, timingSafeEqual } from "node:crypto";
   function signCookie(sid: string, secret: string): string {
     const mac = createHmac("sha256", secret).update(sid).digest("hex");
     return `${sid}.${mac}`;
   }
   function verifySignedCookie(value: string, secret: string): string | null {
     const idx = value.lastIndexOf(".");
     if (idx === -1) return null;
     const sid = value.slice(0, idx); const mac = value.slice(idx + 1);
     const expected = createHmac("sha256", secret).update(sid).digest("hex");
     const ok = Buffer.byteLength(mac) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
     return ok ? sid : null;
   }
   ```
2. Usar `timingSafeEqual` pra evitar timing attack.
3. Atualizar o `REPOSITORY_SUMMARY.md` pra refletir a realidade (já bate).

### Arquivos afetados
- Editados: `src/plugins/auth.ts` (ou `src/infrastructure/fastify/auth-plugin.ts`)
- Documentação: `REPOSITORY_SUMMARY.md` (já correto, só confirmar)

---

## Item 19: Scheduler — corrigir closure stale + integrar composition root

### Como funciona hoje
`src/plugins/scheduler.ts` captura o objeto `tarefa` em closure na hora do
`scheduleTask`. Se a tarefa é editada e `rescheduleTask` é chamado, refaz — mas
se algo editar a tarefa no DB sem chamar reschedule (ex: script editado), o job
roda com snapshot obsoleto. Também: o plugin instancia jobs direto, sem passar
pelo composition root.

### O que muda
`SchedulerManager` vira classe em `domain/tarefas/scheduling/`, recebe
`ExecucaoService` no construtor (não chama `executeTask` importado direto).
Jobs passam a carregar só `tarefaId` e **re-buscam** a tarefa no momento da
execução (snapshot sempre fresco).

### Passos
1. Criar `src/domain/tarefas/scheduling/scheduler-manager.ts` (classe):
   ```ts
   export class SchedulerManager {
     constructor(private readonly prisma: PrismaClient, private readonly logger: Logger, private readonly execucao: ExecucaoService) {}
     async loadAll(): Promise<void> { ... }
     async schedule(tarefaId: string): Promise<void> { ... }
     unschedule(tarefaId: string): void { ... }
     async reschedule(tarefaId: string): Promise<void> { ... }
     getActiveJobCount(): number { ... }
     async stopAll(): Promise<void> { ... }
   }
   ```
2. Jobs passam a carregar `tarefaId` (string) e re-buscam no DB via callback
   async: `async () => { const t = await prisma.tarefa.findUnique(...); await execucao.runTask(t); }`.
3. Manter a chave composta `tarefaId:horarioIndex` e o `Map<string, ScheduledTask>`.
4. O plugin Fastify vira wrapper fino em `infrastructure/fastify/scheduler-plugin.ts`
   que decora `app.scheduler` (ou consome `app.services.scheduler`).
5. Lifecycle `onClose` chama `scheduler.stopAll()`.

### Arquivos afetados
- Novos: `src/domain/tarefas/scheduling/scheduler-manager.ts`
- Removidos/Editados: `src/plugins/scheduler.ts` → `src/infrastructure/fastify/scheduler-plugin.ts`

---

## Item 20: Limpar pastas `css/` e `js/` órfãs na raiz

### Como funciona hoje
Existem `./css/style.css` e `./js/htmx.min.js` na raiz do repo, **além** do
`public/` que o `app.ts` serve (lines 65-73). Conflito/confusão de onde o
estático vive.

### O que muda
Remover as pastas órfãs (ou consolidar em `public/` se algum conteúdo for
diferente). Decidir: `public/css/` e `public/js/` como única fonte.

### Passos
1. Comparar `./css/style.css` com `./public/css/style.css` — se idêntico,
   remover `./css/`.
2. Comparar `./js/htmx.min.js` com `./public/js/` — mesma lógica.
3. Garantir que nenhum template EJS referencia `/css/...` ou `/js/...` sem o
   prefixo `/public/`.
4. Atualizar `.gitignore` se necessário.

### Arquivos afetados
- Removidos: `./css/`, `./js/` (se confirmado órfãos)
- Editados: templates EJS que referenciam caminhos errados, `.gitignore`

---

## Item 21: Adotar alias `@/*` (DX)

### Como funciona hoje
`tsconfig.json` define `paths: { "@/*": ["./src/*"] }` mas **ninguém usa**.
Imports são relativos (`../../services/execucao.service.js`) com extensão `.js`
(que `moduleResolution: bundler` não exige).

### O que muda
Adotar `@/` nos imports entre camadas. Resolve `../../../` feios.

### Passos
1. Adicionar `tsc-alias` (devDep) pro build resolver paths em `dist/`.
2. `tsx` já resolve paths em dev (confirmar).
3. Migrar imports gradualmente (cada arquivo tocado nos itens anteriores já
   adota `@/`).
4. Decidir sobre `.js` nos imports: com `bundler` + `tsc-alias`, pode-se omitir
   a extensão. Padronizar.

### Arquivos afetados
- Editados: `package.json` (add `tsc-alias`), `tsconfig.json` (confirmar),
  todos os arquivos tocados (migração incremental)
- Build: `npm run build` ganha passo `tsc-alias`

---

## Item 22: Matar double-parse nos validators

### Como funciona hoje
`src/validators/script.schema.ts:parseFormScript` (lines 16-24) chama
`scriptCreateSchema.parse(...)` **dentro** da função. A rota `scripts.ts` chama
`parseFormScript` (que já parseou) e **depois** `scriptCreateSchema.safeParse`
de novo (lines 72, 108). Parse duplo.

### O que muda
`parseFormScript` só normaliza o form (sem validar); a rota chama `safeParse`
uma vez. Ou: `parseFormScript` retorna o input normalizado e a rota faz
`safeParse` uma única vez.

### Passos
1. Refatorar `parseFormScript` e `parseFormTarefa` pra **não** chamar
   `schema.parse` internamente — só normalizam tipos (String, Number, arrays).
2. Rotas chamam `parseFormX` → `schema.safeParse(input)` uma vez.
3. Mover pra `src/api/models/<contexto>/form.ts` (kebab, no destino certo).

### Arquivos afetados
- Editados: `src/validators/script.schema.ts`, `tarefa.schema.ts`, rotas que
  consomem (viram `api/models/*/form.ts`)

---

# Ordem de execução recomendada

```
Fase 0 (1,2,3,4)  →  pode rodar isolada, sem quebrar nada
Fase 1 (5,6,7,8,9)  →  extrações, manter imports antigos funcionando
Fase 2 (10,11,12)  →  coração da refatoração da execução
Fase 3 (13,14,15,16,17)  →  wiring grande; rodar tudo junto
Fase 4 (18,19,20,21,22)  →  limpeza, pode ser incremental
```

**Estratégia:** cada fase deve deixar o app funcionando (lint + typecheck +
`npm run dev` sobe e fluxos principais funcionam). Não pular pra Fase 3 sem
ter Fase 0-2 estável — o composition root depende dos services já serem classes.

**Naming:** o sweep `.service.ts` → `-service.ts` é incremental — cada item
já cria o arquivo novo com nome kebab. Um grep final por `*.service.ts` confirma
que não sobrou dot-naming.

---

*Plano gerado a partir do `DECISOES_DE_ARQUITETURA.md`. Cada item deve ser
executado com verificação de lint/typecheck ao final. Atualizar este documento
conforme itens são completados (marcar `[x]`).*
