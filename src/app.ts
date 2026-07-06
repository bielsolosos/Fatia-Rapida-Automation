import fastifyCookie from "@fastify/cookie";
import fastifyFormbody from "@fastify/formbody";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import Fastify from "fastify";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { globalErrorHandler } from "./core/exceptions/global-error-handler.js";
import { servicesPlugin } from "./infrastructure/fastify/services-plugin.js";
import { aboutRoute } from "./api/routes/about-route.js";
import { authRoute } from "./api/routes/auth-route.js";
import { dashboardRoute } from "./api/routes/dashboard-route.js";
import { execucaoRoute } from "./api/routes/execucao-route.js";
import { scriptRoute } from "./api/routes/script-route.js";
import { tarefaRoute } from "./api/routes/tarefa-route.js";
import { authPlugin } from "./infrastructure/fastify/auth-plugin.js";
import { prismaPlugin } from "./infrastructure/fastify/prisma-plugin.js";
import { schedulerPlugin } from "./infrastructure/fastify/scheduler-plugin.js";

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
          "'unsafe-eval'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:"],
        workerSrc: ["'self'", "blob:"],
        fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
      },
    },
  });

  // ── Form parsing ──
  await app.register(fastifyFormbody);

  // ── Cookies + Sessions ──
  await app.register(fastifyCookie);

  // ── Static files ──
  let publicDir = path.join(__dirname, "public");
  if (!fs.existsSync(publicDir)) {
    publicDir = path.join(__dirname, "..", "public");
  }

  await app.register(fastifyStatic, {
    root: publicDir,
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
  await app.register(servicesPlugin);

  // ── Controllers ──
  await app.register(authRoute);
  await app.register(dashboardRoute);
  await app.register(tarefaRoute, { prefix: "/tarefas" });
  await app.register(execucaoRoute, { prefix: "/execucoes" });
  await app.register(scriptRoute, { prefix: "/scripts" });
  await app.register(aboutRoute);

  // ── Scheduler (must be registered after services) ──
  if (config.enableScheduler) {
    await app.register(schedulerPlugin);
  }

  // ── Error handler ──
  app.setErrorHandler(globalErrorHandler);

  // ── 404 handler ──
  app.setNotFoundHandler((request, reply) => {
    const isHtmx = request.headers["hx-request"] === "true";

    if (isHtmx) {
      return reply
        .status(404)
        .send(
          "<div class=\"toast error\" role=\"alert\">Página não encontrada</div>",
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
