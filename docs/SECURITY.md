# Segurança

> Auth, sessões, cookies e CSP.

## Single-user auth

O app é single-user (admin). Credenciais vêm de env vars, não de tabela de usuários:

- `ADMIN_EMAIL` — username.
- `ADMIN_PASSWORD_HASH` — bcrypt hash (gere com `npm run hash-password`).

Login: `app.login(reply, username, password)` compara o username e faz `bcrypt.compare(password, hash)`. Não há tabela de usuários pra manter.

## Cookies HMAC-SHA256

A sessão vive num cookie `fatia.sid`, assinado com HMAC-SHA256 (`SESSION_SECRET`):

```ts
function signCookie(sid: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(sid).digest("hex");
  return `${sid}.${mac}`;
}
function verifySignedCookie(value: string, secret: string): string | null {
  // separa sid.mac, recompute o mac, timingSafeEqual
}
```

- **`httpOnly: true`** — JS do browser não lê o cookie.
- **`sameSite: lax`** — protege contra CSRF em requests top-level.
- **`secure: !isDev`** — HTTPS-only em produção.
- **`timingSafeEqual`** na verificação — evita timing attack na comparação do MAC.

> Histórico: antes usava DJB2 (hash 32-bit não-cripto) — vulnerável a forjação. Corrigido pra HMAC-SHA256 real (ver [ADR](adr/)).

## Sessões no SQLite

- O `sid` (32 bytes random) é PK na tabela `Session`.
- `data` guarda JSON `{ username, authenticatedAt }`.
- `expiresAt` — TTL (default 7 dias, configurável via `SESSION_MAX_AGE`).
- **Limpeza automática**: `setInterval` horário deleta sessions expiradas (`deleteMany where expiresAt < now`).
- No `onRequest`, session expirada é deletada e o cookie ignorado.

Sem JWT, sem Redis — tudo local. O `SESSION_SECRET` (em env) é a chave do HMAC; se vazado, todas as sessões são forjáveis.

## `requireAuth` guard

Decorator em `app` usado como `preHandler` nos routes protegidos:

```ts
if (!request.isAuthenticated) {
  if (isHtmx) reply.header("HX-Redirect", "/login");  // HTMX redireciona a página toda
  else reply.redirect("/login");
  return reply.status(401).send();
}
```

HTMX-aware: em request `hx-*`, manda `HX-Redirect` pro header (o cliente HTMX troca a página). Em navegação direta, `redirect` normal. Routes públicos: só `/login` e `/about`.

## CSP (Content Security Policy)

`fastify-helmet` com CSP estrito:

| Diretiva | Valor | Efeito |
|----------|-------|--------|
| `script-src-attr` | `'none'` | **Bloqueia** `onclick`/`onchange` inline no HTML |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net` | Monaco exige eval + jsDelivr (CDN) |
| `worker-src` | `'self' blob:` | Monaco web workers |
| `styleSrc` | `'self' 'unsafe-inline' jsdelivr` | Tailwind/DaisyUI inline |

**Implicação:** toda interatividade é via HTMX (`hx-*` attributes) + event delegation no `footer.ejs`. Jamais `onclick="..."` no EJS. → [Request flow](REQUEST-FLOW.md#o-pattern-htmx-sem-framework-js).

## Outros

- `bcrypt` v5 pra hash de senha.
- `@fastify/cookie` assina/verifica cookies.
- Sem CORS (mesma origem — SSR).
- Variáveis sensíveis em `.env` (gitignored); `.env.example` como template.
