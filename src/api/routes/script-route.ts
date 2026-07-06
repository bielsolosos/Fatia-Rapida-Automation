import type { FastifyPluginAsync } from "fastify";
import { config } from "../../config.js";
import {
  parseFormScript,
  scriptCreateSchema,
} from "../models/script/form.js";

export const scriptRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (_request, reply) => {
    const scripts = await app.services.script.list();
    return reply.view("pages/scripts.ejs", {
      scripts,
      scriptsDir: config.scriptsDir,
      isAuthenticated: true,
      currentPage: "scripts",
    });
  });

  app.get("/novo", async (_request, reply) => {
    return reply.view("pages/script-form.ejs", {
      scriptsDir: config.scriptsDir,
      isAuthenticated: true,
      currentPage: "scripts",
    });
  });

  app.get<{ Params: { id: string } }>(
    "/:id/editar",
    async (request, reply) => {
      const script = await app.services.script.getById(request.params.id);
      if (!script) {
        return reply.status(404).view("pages/error.ejs", {
          statusCode: 404,
          message: "Script não encontrado",
          isAuthenticated: true,
        });
      }
      return reply.view("pages/script-form.ejs", {
        script,
        scriptsDir: config.scriptsDir,
        isAuthenticated: true,
        currentPage: "scripts",
      });
    },
  );

  app.post("/", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const input = parseFormScript(body);
    const parsed = scriptCreateSchema.safeParse(input);
    if (!parsed.success) {
      return reply.view("pages/script-form.ejs", {
        errors: parsed.error.issues,
        values: input,
        isAuthenticated: true,
        currentPage: "scripts",
      });
    }

    await app.services.script.create(parsed.data);
    return reply.redirect("/scripts");
  });

  app.post<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    if (body._method !== "PUT") {
      return reply.status(400).send("Método inválido");
    }

    const input = parseFormScript(body);
    const parsed = scriptCreateSchema.safeParse(input);
    if (!parsed.success) {
      const script = await app.services.script.getById(request.params.id);
      return reply.view("pages/script-form.ejs", {
        script,
        errors: parsed.error.issues,
        values: input,
        isAuthenticated: true,
        currentPage: "scripts",
      });
    }

    await app.services.script.update(request.params.id, parsed.data);
    return reply.redirect("/scripts");
  });

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await app.services.script.delete(request.params.id);
    return reply.send("");
  });

  app.post<{ Params: { id: string } }>(
    "/:id/executar",
    async (request, reply) => {
      const start = Date.now();
      try {
        const result = await app.services.execucao.runScriptManually(
          request.params.id,
        );
        return reply.view("partials/execution-output.ejs", {
          result,
          duracao: Date.now() - start,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        return reply.status(500).view("partials/execution-output.ejs", {
          result: { stdout: "", stderr: message, exitCode: 1, duracao: 0 },
        });
      }
    },
  );
};
