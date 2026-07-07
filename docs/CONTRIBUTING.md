# Contribuindo

> Como adicionar features e as convenções do projeto.

## O contrato de 4 passos pra um serviço novo

1. **Cria a service class** em `src/domain/<contexto>/service/<contexto>-service.ts` — classe com constructor injection (deps no construtor, nunca em parâmetro de método).
2. **Cria o route** em `src/api/routes/<contexto>-route.ts` — `FastifyPluginAsync` fino que consome `app.services.x`, sem `try/catch` de regra de negócio (o global handler cuida).
3. **Registra no composition root** — adiciona em `Services` (interface) + instancia em `buildServices()` em `src/core/composition/composition-root.ts`. Se o serviço tem deps (logger, factory, outro service), wired ali.
4. **Registra o route no `app.ts`** — `app.register(xRoute, { prefix: "/x" })`, depois do `servicesPlugin`.

> Adicionar deps a um serviço existente = mexer só no composition root. O route nunca sabe das dependências internas do serviço.

## Convenões

| Item | Regra |
|------|-------|
| Naming | **kebab-case** em todo backend (`execucao-service.ts`, não `execucao.service.ts`). Arquivos EJS já usam kebab. |
| Enums | **sem `enum`** do TS — const object tipado: `export const X = { A: "A" } as const; export type X = typeof X[keyof typeof X];` |
| Imports | **`import type`** quando só tipo. Caminhos relativos com `.js` (ESM). |
| Services | classes com `private readonly` no construtor. **Sem `console.*`** — use `Logger` injetado. |
| Routes | consomem `app.services.x` (composition root wired, type-safe). Sem importar free functions. |
| Output DTO | só quando há **transformação real** (formatar data, computar badge, agregar). Caso contrário, entidade direto no EJS. Input sempre tipado (Zod em `api/models/<ctx>/form.ts`). |
| Erros | lançar `BusinessException` (vira 400 + toast HTMX). Sem `throw new Error("...")` em regra de negócio. |
| Logs | `this.logger.info("msg", { ctx })` — nunca `console.log`. |

## Padrões de projeto — quando aplicar

- **Strategy + Factory** — quando há um `if/else` de variantes que tende a crescer (ex: tipos de ação, canais de notificação). Uma interface + impls + factory que seleciona.
- **Discriminated union** — quando um campo JSON tem shapes diferentes por variante. Tipo por `type`, TS estreita.
- **Singleton** — quando uma instância cara representa um recurso único (ex: PrismaClient). Não abuse (a maioria das classes é instanciada no composition root).
- **Logger abstraído** — sempre que um serviço precisar logar. Interface `Logger`, injetada.

→ Mais em [Patterns](PATTERNS.md).

## Comandos

```bash
npm run dev          # dev (tsx watch)
npm run lint         # ESLint (0 warnings atualmente)
npm run lint:fix     # ESLint --fix
npx tsc --noEmit     # typecheck
npm run build        # produção (tsc + copy assets)
npx prisma migrate dev --name <nome>   # nova migration
npx prisma generate                   # regenera o client (após mudar schema)
```

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em PR/push pra `main`/`develop`: lint + `tsc --noEmit` + `npm run build`. Todos bloqueantes. Antes de abrir PR, rode localmente:

```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Estrutura esperada pra um contexto novo

```
src/domain/<contexto>/
├── model/          # entidades/tipos do domínio (se precisar)
├── service/        # <contexto>-service.ts (classe)
└── <subpadrao>/    # ex: action/, notification/ — só se houver Strategy/Factory
src/api/
├── routes/<contexto>-route.ts
└── models/<contexto>/form.ts   # Zod schemas + parseForm
```
