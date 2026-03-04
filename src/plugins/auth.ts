import bcrypt from "bcrypt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";

// ── Session data shape ──
interface SessionData {
  username: string;
  authenticatedAt: string;
}

declare module "fastify" {
  interface FastifyRequest {
    session: SessionData | null;
    isAuthenticated: boolean;
  }
}

// ── Helpers ──
function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function signCookie(sid: string, secret: string): string {
  const encoder = new TextEncoder();
  // Simple HMAC-like signature using the secret
  let hash = 0;
  const combined = sid + secret;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `${sid}.${Math.abs(hash).toString(36)}`;
}

function verifySignedCookie(value: string, secret: string): string | null {
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const sid = value.substring(0, dotIndex);
  const expected = signCookie(sid, secret);
  return expected === value ? sid : null;
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  const COOKIE_NAME = "fatia.sid";

  // ── Decorators ──
  app.decorateRequest("session", null);
  app.decorateRequest("isAuthenticated", false);

  // ── Load session on every request ──
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cookieValue = request.cookies[COOKIE_NAME];
      if (!cookieValue) return;

      const sid = verifySignedCookie(cookieValue, config.sessionSecret);
      if (!sid) return;

      try {
        const session = await app.prisma.session.findUnique({ where: { sid } });
        if (!session) return;

        if (new Date() > session.expiresAt) {
          // Session expired, clean up
          await app.prisma.session.delete({ where: { sid } }).catch(() => {});
          return;
        }

        request.session = JSON.parse(session.data) as SessionData;
        request.isAuthenticated = true;
      } catch {
        // Invalid session, ignore
      }
    },
  );

  // ── Auth methods on app ──
  app.decorate(
    "login",
    async (
      reply: FastifyReply,
      username: string,
      password: string,
    ): Promise<boolean> => {
      // Validate credentials against env config
      if (username !== config.adminUsername) return false;

      const valid = await bcrypt.compare(password, config.adminPasswordHash);
      if (!valid) return false;

      // Create session
      const sid = generateSessionId();
      const expiresAt = new Date(Date.now() + config.sessionMaxAge);
      const data: SessionData = {
        username,
        authenticatedAt: new Date().toISOString(),
      };

      await app.prisma.session.create({
        data: {
          sid,
          data: JSON.stringify(data),
          expiresAt,
        },
      });

      // Set cookie
      reply.setCookie(COOKIE_NAME, signCookie(sid, config.sessionSecret), {
        path: "/",
        httpOnly: true,
        secure: !config.isDev,
        sameSite: "lax",
        maxAge: config.sessionMaxAge / 1000, // seconds
      });

      return true;
    },
  );

  app.decorate(
    "logout",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const cookieValue = request.cookies[COOKIE_NAME];
      if (cookieValue) {
        const sid = verifySignedCookie(cookieValue, config.sessionSecret);
        if (sid) {
          await app.prisma.session.delete({ where: { sid } }).catch(() => {});
        }
      }

      reply.clearCookie(COOKIE_NAME, { path: "/" });
    },
  );

  // ── Auth guard (preHandler) ──
  app.decorate(
    "requireAuth",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.isAuthenticated) {
        const isHtmx = request.headers["hx-request"] === "true";
        if (isHtmx) {
          // Tell HTMX to redirect the whole page
          reply.header("HX-Redirect", "/login");
          return reply.status(401).send();
        }
        return reply.redirect("/login");
      }
    },
  );

  // ── Cleanup expired sessions periodically (every hour) ──
  const cleanupInterval = setInterval(
    async () => {
      try {
        const deleted = await app.prisma.session.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        if (deleted.count > 0) {
          app.log.info(
            `Limpeza: ${deleted.count} sessions expiradas removidas`,
          );
        }
      } catch {
        // Best effort
      }
    },
    60 * 60 * 1000,
  );

  app.addHook("onClose", async () => {
    clearInterval(cleanupInterval);
  });
});

// ── Type augmentation for app decorators ──
declare module "fastify" {
  interface FastifyInstance {
    login: (
      reply: FastifyReply,
      username: string,
      password: string,
    ) => Promise<boolean>;
    logout: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAuth: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
