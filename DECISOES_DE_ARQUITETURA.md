# Decisões de Arquitetura — Fatia Rápida v2

> Documento de contexto e escopo. Registra o que decidimos na conversa de
> planejamento de refatoração, **antes** de qualquer mudança de código.
> Serve como referência viva: toda decisão aqui foi acordada e deve ser
> respeitada pelas etapas do `PLANO_DE_REFACTORIZACAO.md`.

---

## 1. Contexto da conversa

Analisamos dois repositórios para embasar a refatoração:

### 1.1 Fatia Rápida v2 (alvo da refatoração)
Plataforma de automação de tarefas agendadas para Raspberry Pi. Stack:
Fastify v5 (ESM) · Prisma + SQLite · EJS SSR + HTMX + Tailwind/DaisyUI (CDN) ·
node-cron · bcrypt + cookie HMAC + sessões em SQLite. Single-user.

**Problemas identificados pelo autor (Gabriel):**
- `cron.service.ts` é um helper disfarçado de service (só funções utilitárias puras).
- Naming com ponto (`execucao.service.ts`) em vez de kebab-case (`execucao-service.ts`), quebrando a convenção JS e divergindo do próprio frontend EJS que já usa kebab.
- `execucao.service.ts` é um god-function que mistura DB + spawn + Discord + serialização + erro, sem nenhum padrão de projeto.

**Problemas adicionais encontrados na análise:**
- Lógica de spawn duplicada entre `execucao.service.ts` e `script.service.ts`.
- `runCommand` em `execucao.service` e `executeScriptManually` em `script.service` fazem o mesmo.
- Decisão `tipo → cmd/args` (plataforma + tipo de script) existe em 3 lugares.
- Magic strings espalhadas: `"SUCESSO"`, `"FALHA"`, `"EM_ANDAMENTO"`, `"SHELL"`, `"NODEJS"`, `"PYTHON"`.
- Logging inconsistente: `console.log("[Scheduler]...")` no `execucao.service` vs `app.log` no resto.
- `saida` é `JSON.stringify` de shapes ad-hoc (sem tipo compartilhado).
- Rota `execucoes.ts` monta HTML inline com `(exec as any)` — ignora o partial `execution-row.ejs` que já existe.
- `getDashboardStats` mora em `tarefa.service` (falta de coesão).
- `ExecucaoResult` (script.service) vs `CommandResult` (execucao.service) — mesmo shape, duas definições.
- Pastas `css/` e `js/` na raiz conflitam com `public/` (que o `app.ts` serve).
- `signCookie` em `auth.ts` é DJB2 (hash 32-bit não cripto), não HMAC-SHA256 como o `REPOSITORY_SUMMARY.md` alega.
- `tsconfig` define alias `@/*` que ninguém usa; `moduleResolution: bundler` não exige `.js` mas importam `.js` em todo lugar.
- Scheduler captura `tarefa` em closure — edição sem reschedule roda snapshot obsoleto.
- `tarefaUpdateSchema = tarefaCreateSchema` — placeholder sem diferença real.

### 1.2 Noto-Back-end (referência de arquitetura)
Projeto Java/Spring Boot do mesmo autor. Arquitetura DDD-inspirada em MVC,
dividida em 4 camadas: `api/` (apresentação), `domain/` (bounded contexts),
`core/` (shared kernel), `infrastructure/` (detalhes técnicos).

Padrões confirmados no código do Noto que serviram de inspiração:
- Bounded contexts por subpasta (`domain/users`, `domain/pages`, `domain/media`).
- **Strategy**: `PageExporterService` (interface) com `PageExporterServiceMd` e `PageExporterServiceNotoPdf`.
- **Factory**: `ExportPageFactory.generatePageService(ExportTypeEnum)` retorna a impl certa.
- **Mapper** (anti-corruption layer): `PageMapper.toPageResponse(entity)`.
- **Repository** como port (Spring Data JPA interface).
- **Specification** (`PageSpecification`) para queries dinâmicas.
- **BusinessException + GlobalExceptionHandler** (`@RestControllerAdvice`).
- **Constructor injection** via `@RequiredArgsConstructor` do Lombok.
- **Enums** centralizados em `core/enums`.
- DTOs separados: API (`api/model/`) vs domínio (`domain/*/model/dto/`).

---

## 2. Escopo do que fizemos nesta fase

**Apenas análise e planejamento.** Nenhuma linha de código foi alterada.
Esta fase produziu:
1. Diagnóstico completo do estado atual do Fatia (retido no histórico do chat).
2. Mapeamento da arquitetura do Noto e reflexão sobre como portá-la.
3. Decisões arquiteturas acordadas (este documento).
4. Exemplos de código para cada padrão (enums, composition root, view models).
5. Plano de refatoração por etapas (`PLANO_DE_REFACTORIZACAO.md`).

A fase de implementação começa após este documento ser aceito como contrato.

---

## 3. Decisões arquiteturais acordadas

### 3.1 Estrutura de camadas (DDD-inspirada, 4 camadas)

Adotamos a mesma separação do Noto, adaptada para TS/Fastify/Prisma:

```
src/
├── server.ts                      # entry point
├── app.ts                         # bootstrap Fastify (plugins + error handler)
├── config/                        # carregamento de env (properties)
│
├── api/                           # APRESENTAÇÃO (transporte HTMX)
│   ├── controllers/               #   route modules finos (era src/routes/)
│   ├── models/                    #   inputs tipados (Zod) + view models de saída
│   └── mappers/                   #   entity → view model (só quando há transformação)
│
├── core/                          # SHARED KERNEL
│   ├── enums/                     #   ScriptTipo, ExecucaoStatus, ActionTipo (const tipados)
│   ├── exceptions/                #   BusinessException + global-error-handler
│   ├── logger/                    #   Logger interface (services não usam console)
│   ├── composition/               #   composition root (wiring único)
│   └── utils/                     #   helpers puros compartilhados
│
├── domain/                        # BOUNDED CONTEXTS (núcleo de negócio)
│   ├── tarefas/                   #   model + service + scheduling/
│   ├── scripts/                   #   model + service + storage/
│   ├── execucoes/                 #   model + service + action/ + runner/ + notification/
│   └── dashboard/                 #   service (estatísticas saem de tarefa-service)
│
├── infrastructure/                # DETALHES TÉCNICOS
│   ├── persistence/               #   Prisma singleton + (futuro: impls de repository)
│   └── fastify/                   #   plugins que conectam infra → app
│
└── views/                         # EJS (o "V" — manter, só padronizar partials)
```

### 3.2 Sem Repository Pattern — Prisma como singleton global

**Decisão:** não fazer port+impl de repository. Prisma já é um client tipado e
faz o papel de repository. Vira singleton em `infrastructure/persistence/prisma.ts`,
consumido diretamente pelos services.

**Justificativa:** o dogma de repository port+impl só paga o custo quando há
múltiplas implementações ou necessidade de mockar além do que Prisma permite.
Para um app single-user em SQLite, é ceremony. O composition root dá o seam de
troca se um dia for preciso.

### 3.3 Composition Pattern (o coração do design)

**Decisão:** services são **classes** com **constructor injection**, instanciadas
**uma única vez** no *composition root* (`core/composition/composition-root.ts`).
Um plugin Fastify decora `app.services` com o grafo pronto.

Estrutura do padrão:
1. Prisma singleton global (`infrastructure/persistence/prisma.ts`).
2. Logger abstrato (`core/logger/logger.ts` interface + `FastifyLogger` impl).
3. Service classes com `constructor(private readonly prisma, private readonly logger, ...)`.
4. Composition root `buildServices(logger)` retorna `Services` (interface).
5. Plugin `servicesPlugin` decora `app.services: Services` via `declare module "fastify"`.
6. Controllers consomem `app.services.tarefa.create(input)` — sem saber das deps.

**Por que não funções soltas (como hoje):** hoje `createTarefa(app.prisma, input)`
passa `prisma` em toda chamada e não tem onde injetar logger/factory/notifier.
Com classe + construtor, as deps vivem uma vez; adicionar dep é mexer só no
composition root. É o mesmo padrão do `@Service` + `@RequiredArgsConstructor`
do Spring, mas manual e explícito — o grafo fica visível num arquivo.

**Adicionar serviço novo = 4 passos:**
1. Criar service em `domain/<contexto>/service/<contexto>-service.ts`.
2. Criar controller em `api/controllers/<contexto>-controller.ts`.
3. Adicionar no `Services` interface + `buildServices()` (composition root).
4. Registrar controller no `app.ts` com prefixo.

### 3.4 `app.services` é type-safe

Sim, 100%. Mecanismo: `declare module "fastify" { interface FastifyInstance { services: Services } }`.
Mesmo padrão já usado hoje com `app.prisma`, `app.login`, `app.scheduler`.
Typos e métodos inexistentes viram erro de compilação. Se o composition root
esquecer de instanciar um service listado no `Services` interface, TS reclama.

### 3.5 Enums como `const` tipados (não `enum`)

**Decisão:** usar const object + derived union type, nunca `enum`.

```ts
export const ScriptTipo = {
  SHELL: "SHELL",
  NODEJS: "NODEJS",
  PYTHON: "PYTHON",
} as const;

export type ScriptTipo = (typeof ScriptTipo)[keyof typeof ScriptTipo];
```

**Justificativa:** `enum` do TS tem reverse mapping ambíguo, custo de runtime e
incompatibilidade com `as const` do Zod. Const object é a forma idiomática,
integra com `z.enum(Object.values(ScriptTipo))` sem duplicar strings, e é a
única fonte de verdade.

### 3.6 Regra de Output DTO / Mapper — só quando há transformação

**Decisão:** não criar DTO de saída por padrão. Passar entidade Prisma direto
pro EJS. Criar view model (função, não classe) **só quando** houver:
1. Transformação real (formatar data, computar badge, truncar id).
2. Agregação de múltiplas entidades.
3. Ocultação de campos sensíveis.

**Justificativa:** em SSR single-user sem API externa, mapear `Script` →
`ScriptView` com os mesmos campos é boilerplate (igual ao `PageMapper` do Noto
que copia campo a campo). A view é parte do app, não consumidor externo — o
benefício anti-corruption é fraco. Mapper de output paga o custo **só quando
a transformação é real**, como no caso da rota `execucoes` que hoje monta
`<tr>` inline com `(exec as any)`.

**Input é tipado sempre** (Zod na borda, em `api/models/<contexto>/form.ts`).

### 3.7 Strategy + Factory para Action Executors

**Decisão:** portar o padrão `ExportPageFactory` + `PageExporterService` do Noto
para os tipos de ação da tarefa. `ActionExecutor` (interface) com impls
`ScriptActionExecutor`, `ShellActionExecutor`, `NoopActionExecutor`, selecionados
por `ActionExecutorFactory` keyed por `ActionTipo` enum.

Isso substitui o if/else de 3 ramos no `executeTask` e **deduplica** a lógica de
spawn (vira um `ProcessRunner` injetado no `ScriptActionExecutor` e no `ScriptService`).

### 3.8 Strategy para Notification Channels

**Decisão:** `NotificationChannel` (interface) com `DiscordChannel` (impl atual).
`NotificationService` orquestra a lista de canais. Discord deixa de ser
hardcoded no fluxo de execução. Abre espaço pra Slack/Email futuramente sem
mexer no `ExecucaoService`.

### 3.9 BusinessException + Global Error Handler

**Decisão:** portar o padrão do Noto. `BusinessException` em `core/exceptions/`,
lançada pelo domínio. Global error handler (Fastify `setErrorHandler`) traduz
para HTMX partial ou página de erro. Controllers deixam de ter try/catch pra
regra de negócio.

### 3.10 Logger abstrato (sem `console` nos services)

**Decisão:** interface `Logger` em `core/logger/`. Impl `FastifyLogger` wrapa
`app.log`. Services recebem `Logger` no construtor. Mata o `console.log("[Scheduler]...")`
que diverge do `app.log` usado no resto. Mantém o princípio do README
("services não acessam Fastify app direto") — recebem a abstração, não o app.

### 3.11 Naming kebab-case em todo backend

**Decisão:** padronizar backend em kebab-case (`execucao-service.ts` em vez de
`execucao.service.ts`), alinhando com o frontend EJS que já usa kebab
(`script-card.ejs`, `execution-detail.ejs`) e com a convenção Node/JS.

### 3.12 Módulos de domínio coesos

- `getDashboardStats` sai de `tarefa.service` → vai pra `domain/dashboard/service/`.
- Helpers de cron (`generateCronExpressions`, `formatDiasSemana`, `formatHorarios`)
  saem de `cron.service` → vão pra `domain/tarefas/scheduling/` (são puros, mas
  pertencem ao contexto de tarefas, não a "services" genéricos).
- File storage (`escreverArquivo`, `removerArquivo`) sai de `script.service`
  → vai pra `domain/scripts/storage/script-storage.ts`.

### 3.13 Discriminated Union para `ExecucaoSaida`

**Decisão:** tipar o campo `saida` (hoje `JSON.stringify` ad-hoc) como
discriminated union: `{ type: "script"; ... } | { type: "shell"; ... } | { type: "noop" } | { type: "error"; ... }`.
Mata os shapes inconsistentes e os casts `as any`.

### 3.14 Alias `@/*` adotado de fato

**Decisão:** usar o path alias `@/*` já definido no `tsconfig.json` (hoje
ninguém usa). Evita imports `../../../` entre camadas. Requer resolver runtime
em produção (`tsc-alias` ou `tsx` que já suporta paths).

### 3.15 Correção de segurança: cookie HMAC-SHA256

**Decisão:** trocar `signCookie` (DJB2 32-bit não cripto) por
`crypto.createHmac("sha256", secret)`. O `REPOSITORY_SUMMARY.md` já alega
HMAC-SHA256; o código não cumpre. Bug latente de segurança.

---

## 4. Decisões que NÃO tomamos (explicitamente)

| Decisão | Por que não |
|---------|-------------|
| Repository port+impl por agregado | Prisma tipado já é o repository; dogma sem ganho pra single-user SQLite. |
| Output DTO por padrão | Em SSR single-user é ceremony; só vale quando há transformação real. |
| Migrar pra SPA agora | Escopo não justifica; refactor DDD é pré-requisito, não alternativa. |
| `service/impl/` quando só há 1 impl | Em TS não há `@Autowired` por interface; `impl/` só com ≥2 estratégias. |
| Specification pattern | Prisma já tem `where` tipado rico; `Specification` é redundância. |
| Separar `model/dto/` de `model/` dentro do contexto | DTO separado só quando cruza contexto (vai pro controller). |

---

## 5. Decisão de transporte: SSR agora, SPA depois

**Decisão:** manter SSR (EJS + HTMX) por enquanto. Não migrar para SPA.

**Justificativa:**
- Nenhum dos problemas identificados é de frontend — todos são de arquitetura
  de backend. SPA não resolve nenhum; adiciona camada nova sobre backend em refluxo.
- HTMX + EJS cobre 90% do caso de uso com virtude (simples, leve pro Pi).
- Monaco Editor já é uma "ilha" client-side funcionando — islands architecture
  na prática. Não precisa virar SPA inteiro pra ter ilhas.
- O refactor DDD **comporta** uma migração SPA futura sem dor, porque isola o
  transporte nos controllers. Hoje `reply.view(ejs, data)`; amanhã `reply.send(dto)`.
  O service layer não muda.

**Gatilhos para reconsiderar SPA (registrar para revisitar):**
1. Adicionar multi-usuário com roles/permissions.
2. Streaming de execução ao vivo virar central no produto (WebSocket > HTMX-SSE).
3. Dashboard analítico com charts virar a tela principal.
4. Cliente mobile/externo (força API-first de qualquer forma).
5. Querer desacoplar ciclos de deploy (frontend iterar mais rápido que Pi redeploy).

**Conexão com a regra de DTO:** a decisão de output DTO é consequência da
decisão de transporte. Hoje (SSR) = sem DTO por padrão. Se amanhã for SPA
(JSON API externa), o mapper de output volta a pagar seu custo — o JSON vira
contrato externo. A regra de "só quando há transformação" inverte porque o
contrato externo justifica o boilerplate.

---

## 6. Mapeamento Noto → Fatia (resumo de padrões)

| Padrão Noto | Aplicação no Fatia | Resolve qual dor |
|-------------|--------------------|------------------|
| Bounded contexts (`domain/users`, etc.) | `domain/tarefas`, `domain/scripts`, `domain/execucoes`, `domain/dashboard` | Coesão; `getDashboardStats` fora do `tarefa-service` |
| Strategy (`PageExporterService`) | `ActionExecutor` com `Script/Shell/Noop` impls | Mata if/else de 3 ramos no `executeTask` |
| Factory (`ExportPageFactory`) | `ActionExecutorFactory` por `ActionTipo` | Seleção de estratégia sem if/else |
| Repository port | **NÃO adotado** — Prisma singleton | (decisão 3.2) |
| Mapper (`PageMapper`) | View model **só com transformação real** | Mata `(exec as any)` + HTML inline na rota |
| BusinessException + GlobalExceptionHandler | `BusinessException` + `setErrorHandler` | Controller sem try/catch |
| Constructor injection (`@RequiredArgsConstructor`) | Classes + composition root manual | Services deixam de ser funções soltas |
| Enum centralizado (`core/enums`) | `core/enums/*` const tipados | Mata magic strings |
| Notification strategy (extensão) | `NotificationChannel` + `DiscordChannel` | Discord deixa de ser hardcoded |

---

## 7. Princípios norteadores (contrato moral)

1. **Simplicidade sobre dogma:** não importar padrão se não paga o custo no
   contexto (single-user, SQLite, Pi). Repository e Specification ficam de fora
   por isso.
2. **Transporte isolado nos controllers:** o domínio não sabe se fala com EJS
   ou JSON. Hoje SSR; amanhã SPA, só controllers mudam.
3. **Única fonte de verdade:** enums const tipados; schemas Zod derivam dos
   enums; services são a única fonte de regra de negócio.
4. **Composition root visível:** o grafo de dependências é explícito num
   arquivo. Nada de container mágico, nada de `prisma` espalhado.
5. **Input rígido, output enxuto:** Zod na borda sempre; entidade direto pro
   EJS por padrão; view model só com transformação real.
6. **Logger abstraído, nunca `console` em service.**
7. **kebab-case em todo backend** (alinhado com o frontend já existente).

---

*Documento gerado a partir da conversa de planejamento. Qualquer mudança de
decisão deve atualizar este arquivo antes de tocar código — ele é o contrato
entre a fase de análise e a fase de implementação.*
