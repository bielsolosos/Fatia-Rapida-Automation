import type { FastifyPluginAsync } from "fastify";
import {
  parseFormTarefa,
  tarefaCreateSchema,
} from "../../validators/tarefa.schema.js";

export const tarefaRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (_request, reply) => {
    const tarefas = await app.services.tarefa.list();
    return reply.view("pages/tarefas.ejs", {
      tarefas,
      isAuthenticated: true,
      currentPage: "tarefas",
    });
  });

  app.get("/nova", async (_request, reply) => {
    const scripts = await app.services.script.list();
    return reply.view("pages/tarefa-form.ejs", {
      scripts,
      isAuthenticated: true,
      currentPage: "tarefas",
    });
  });

  app.get<{ Params: { id: string } }>(
    "/clonar/:id",
    async (request, reply) => {
      const [tarefa, scripts] = await Promise.all([
        app.services.tarefa.getById(request.params.id),
        app.services.script.list(),
      ]);
      if (!tarefa) {
        return reply.status(404).view("pages/error.ejs", {
          statusCode: 404,
          message: "Tarefa não encontrada",
          isAuthenticated: true,
        });
      }
      return reply.view("pages/tarefa-form.ejs", {
        prefill: tarefa,
        scripts,
        isAuthenticated: true,
        currentPage: "tarefas",
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/:id/editar",
    async (request, reply) => {
      const [tarefa, scripts] = await Promise.all([
        app.services.tarefa.getById(request.params.id),
        app.services.script.list(),
      ]);
      if (!tarefa) {
        return reply.status(404).view("pages/error.ejs", {
          statusCode: 404,
          message: "Tarefa não encontrada",
          isAuthenticated: true,
        });
      }
      return reply.view("pages/tarefa-form.ejs", {
        tarefa,
        scripts,
        isAuthenticated: true,
        currentPage: "tarefas",
      });
    },
  );

  app.post("/", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const input = parseFormTarefa(body);

    const parsed = tarefaCreateSchema.safeParse(input);
    if (!parsed.success) {
      return reply.view("pages/tarefa-form.ejs", {
        errors: parsed.error.issues,
        values: input,
        isAuthenticated: true,
        currentPage: "tarefas",
      });
    }

    const tarefa = await app.services.tarefa.create(parsed.data);

    if (app.scheduler) {
      await app.scheduler.scheduleTask(tarefa.id);
    }

    return reply.redirect("/tarefas");
  });

  app.post<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    if (body._method !== "PUT") {
      return reply.status(400).send("Método inválido");
    }

    const input = parseFormTarefa(body);
    const parsed = tarefaCreateSchema.safeParse(input);

    if (!parsed.success) {
      const tarefa = await app.services.tarefa.getById(request.params.id);
      return reply.view("pages/tarefa-form.ejs", {
        tarefa,
        errors: parsed.error.issues,
        values: input,
        isAuthenticated: true,
        currentPage: "tarefas",
      });
    }

    await app.services.tarefa.update(request.params.id, parsed.data);

    if (app.scheduler) {
      await app.scheduler.rescheduleTask(request.params.id);
    }

    return reply.redirect("/tarefas");
  });

  app.patch<{ Params: { id: string } }>(
    "/:id/toggle",
    async (request, reply) => {
      const tarefa = await app.services.tarefa.toggle(request.params.id);
      if (!tarefa) {
        return reply
          .status(404)
          .send("<div class=\"toast error\">Tarefa não encontrada</div>");
      }

      if (app.scheduler) {
        if (tarefa.ativo) {
          await app.scheduler.scheduleTask(tarefa.id);
        } else {
          app.scheduler.unscheduleTask(tarefa.id);
        }
      }

      return reply.view("partials/task-card.ejs", { tarefa });
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    if (app.scheduler) {
      app.scheduler.unscheduleTask(request.params.id);
    }

    await app.services.tarefa.delete(request.params.id);

    return reply.send("");
  });
};
