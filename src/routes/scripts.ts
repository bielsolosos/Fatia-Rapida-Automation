import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";
import {
  createScript,
  deleteScript,
  executeScriptManually,
  getScriptById,
  listScripts,
  updateScript,
} from "../services/script.service.js";
import {
  parseFormScript,
  scriptCreateSchema,
} from "../validators/script.schema.js";

export const scriptRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

  // GET /scripts — lista
  app.get("/", async (_request, reply) => {
    const scripts = await listScripts(app.prisma);
    return reply.view("pages/scripts.ejs", {
      scripts,
      scriptsDir: config.scriptsDir,
      isAuthenticated: true,
      currentPage: "scripts",
    });
  });

  // GET /scripts/novo — formulário de criação
  app.get("/novo", async (_request, reply) => {
    return reply.view("pages/script-form.ejs", {
      scriptsDir: config.scriptsDir,
      isAuthenticated: true,
      currentPage: "scripts",
    });
  });

  // GET /scripts/:id/editar — formulário de edição
  app.get<{ Params: { id: string } }>("/:id/editar", async (request, reply) => {
    const script = await getScriptById(app.prisma, request.params.id);
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
  });

  // POST /scripts — criar
  app.post("/", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    let input: ReturnType<typeof parseFormScript>;
    try {
      input = parseFormScript(body);
    } catch {
      return reply.view("pages/script-form.ejs", {
        errors: [{ message: "Dados inválidos" }],
        values: body,
        isAuthenticated: true,
        currentPage: "scripts",
      });
    }

    const parsed = scriptCreateSchema.safeParse(input);
    if (!parsed.success) {
      return reply.view("pages/script-form.ejs", {
        errors: parsed.error.issues,
        values: input,
        isAuthenticated: true,
        currentPage: "scripts",
      });
    }

    await createScript(app.prisma, parsed.data);
    return reply.redirect("/scripts");
  });

  // POST /scripts/:id (com _method=PUT) — atualizar
  app.post<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    if (body._method !== "PUT") {
      return reply.status(400).send("Método inválido");
    }

    let input: ReturnType<typeof parseFormScript>;
    try {
      input = parseFormScript(body);
    } catch {
      const script = await getScriptById(app.prisma, request.params.id);
      return reply.view("pages/script-form.ejs", {
        script,
        errors: [{ message: "Dados inválidos" }],
        values: body,
        isAuthenticated: true,
        currentPage: "scripts",
      });
    }

    const parsed = scriptCreateSchema.safeParse(input);
    if (!parsed.success) {
      const script = await getScriptById(app.prisma, request.params.id);
      return reply.view("pages/script-form.ejs", {
        script,
        errors: parsed.error.issues,
        values: input,
        isAuthenticated: true,
        currentPage: "scripts",
      });
    }

    await updateScript(app.prisma, request.params.id, parsed.data);
    return reply.redirect("/scripts");
  });

  // DELETE /scripts/:id — deletar (HTMX)
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await deleteScript(app.prisma, request.params.id);
    return reply.send("");
  });

  // POST /scripts/:id/executar — execução manual (HTMX)
  app.post<{ Params: { id: string } }>(
    "/:id/executar",
    async (request, reply) => {
      const start = Date.now();
      try {
        const result = await executeScriptManually(
          app.prisma,
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
