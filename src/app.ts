import fastifyCookie from "@fastify/cookie";
import fastifyFormbody from "@fastify/formbody";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { schedulerPlugin } from "./plugins/scheduler.js";
import { authRoutes } from "./routes/auth.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { execucaoRoutes } from "./routes/execucoes.js";
import { tarefaRoutes } from "./routes/tarefas.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      ...(config.isDev && {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
    },
  });

  // ── Security ──
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:"],
      },
    },
  });

  // ── Form parsing ──
  await app.register(fastifyFormbody);

  // ── Cookies + Sessions ──
  await app.register(fastifyCookie);

  // ── Static files ──
  await app.register(fastifyStatic, {
    root: path.join(__dirname, "..", "public"),
    prefix: "/public/",
  });

  // ── View engine (EJS) ──
  await app.register(fastifyView, {
    engine: { ejs },
    root: path.join(__dirname, "views"),
    defaultContext: {
      title: "Fatia Rápida",
    },
    options: {
      filename: path.join(__dirname, "views"),
    },
  });

  // ── Plugins ──
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  // ── Routes ──
  await app.register(authRoutes);
  await app.register(dashboardRoutes);
  await app.register(tarefaRoutes, { prefix: "/tarefas" });
  await app.register(execucaoRoutes, { prefix: "/execucoes" });

  // ── Scheduler (must be registered after prisma) ──
  if (config.enableScheduler) {
    await app.register(schedulerPlugin);
  }

  // ── Error handler ──
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode = error.statusCode || 500;
    const isHtmx = request.headers["hx-request"] === "true";

    if (isHtmx) {
      return reply
        .status(statusCode)
        .send(
          `<div class="toast error" role="alert">${error.message || "Erro interno"}</div>`,
        );
    }

    return reply.status(statusCode).view("pages/error.ejs", {
      title: `Erro ${statusCode}`,
      statusCode,
      message: error.message || "Algo deu errado.",
    });
  });

  // ── 404 handler ──
  app.setNotFoundHandler((request, reply) => {
    const isHtmx = request.headers["hx-request"] === "true";

    if (isHtmx) {
      return reply
        .status(404)
        .send(
          '<div class="toast error" role="alert">Página não encontrada</div>',
        );
    }

    return reply.status(404).view("pages/error.ejs", {
      title: "Não encontrado",
      statusCode: 404,
      message: "A página que você procura não existe.",
    });
  });

  return app;
}
