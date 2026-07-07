# ADR-0004: Const object tipado (sem `enum` do TS)

Date: 2026-07-07
Status: Accepted

## Context

O projeto tinha magic strings espalhadas (`"SUCESSO"`, `"SHELL"`, `"NODEJS"`...). Precisava de enums. O `enum` do TypeScript tem problemas: reverse mapping ambíguo, custo de runtime (vira objeto), e incompatibilidade com `as const` do Zod (não dá pra derivar `z.enum(Object.values(Enum))`).

## Decision

Usar **const object + derived union type**, nunca `enum`:

```ts
export const ScriptTipo = { SHELL: "SHELL", NODEJS: "NODEJS", PYTHON: "PYTHON" } as const;
export type ScriptTipo = (typeof ScriptTipo)[keyof typeof ScriptTipo];
```

## Consequences

- **+** Única fonte de verdade — o Zod deriva direto: `z.enum(Object.values(ScriptTipo) as [ScriptTipo, ...ScriptTipo[]])`.
- **+** Sem reverse mapping, sem objeto runtime extra (é só um objeto literal congelado).
- **+** Comparação legível e type-safe: `script.tipo === ScriptTipo.NODEJS`.
- **−** Um pouco mais verboso que `enum X { A, B }`.
- **−** Sem auto-iteração de membros como `enum` (mas `Object.values(X)` resolve).
