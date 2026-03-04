import type { FastifyPluginAsync } from "fastify";
import {
  createTarefa,
  deleteTarefa,
  getTarefaById,
  listTarefas,
  toggleTarefa,
  updateTarefa,
} from "../services/tarefa.service.js";
import {
  parseFormTarefa,
  tarefaCreateSchema,
} from "../validators/tarefa.schema.js";

export const tarefaRoutes: FastifyPluginAsync = async (app) => {
  // All tarefa routes require auth
  app.addHook("preHandler", app.requireAuth);

  // GET /tarefas — list all
  app.get("/", async (request, reply) => {
    const tarefas = await listTarefas(app.prisma);
    return reply.view("pages/tarefas.ejs", {
      tarefas,
      isAuthenticated: true,
      currentPage: "tarefas",
    });
  });

  // GET /tarefas/nova — form to create
  app.get("/nova", async (request, reply) => {
    return reply.view("pages/tarefa-form.ejs", {
      isAuthenticated: true,
      currentPage: "tarefas",
    });
  });

  // GET /tarefas/:id/clonar — form pre-filled to clone
  app.get<{ Params: { id: string } }>("/clonar/:id", async (request, reply) => {
    const tarefa = await getTarefaById(app.prisma, request.params.id);
    if (!tarefa) {
      return reply.status(404).view("pages/error.ejs", {
        statusCode: 404,
        message: "Tarefa não encontrada",
        isAuthenticated: true,
      });
    }
    return reply.view("pages/tarefa-form.ejs", {
      prefill: tarefa,
      isAuthenticated: true,
      currentPage: "tarefas",
    });
  });

  // GET /tarefas/:id/editar — form to edit
  app.get<{ Params: { id: string } }>("/:id/editar", async (request, reply) => {
    const tarefa = await getTarefaById(app.prisma, request.params.id);
    if (!tarefa) {
      return reply.status(404).view("pages/error.ejs", {
        statusCode: 404,
        message: "Tarefa não encontrada",
        isAuthenticated: true,
      });
    }
    return reply.view("pages/tarefa-form.ejs", {
      tarefa,
      isAuthenticated: true,
      currentPage: "tarefas",
    });
  });

  // POST /tarefas — create new
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

    const tarefa = await createTarefa(app.prisma, parsed.data);

    // Schedule the new task
    if (app.scheduler) {
      await app.scheduler.scheduleTask(tarefa.id);
    }

    return reply.redirect("/tarefas");
  });

  // POST /tarefas/:id (with _method=PUT) — update
  app.post<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    // Method override check
    if (body._method !== "PUT") {
      return reply.status(400).send("Método inválido");
    }

    const input = parseFormTarefa(body);
    const parsed = tarefaCreateSchema.safeParse(input);

    if (!parsed.success) {
      const tarefa = await getTarefaById(app.prisma, request.params.id);
      return reply.view("pages/tarefa-form.ejs", {
        tarefa,
        errors: parsed.error.issues,
        values: input,
        isAuthenticated: true,
        currentPage: "tarefas",
      });
    }

    await updateTarefa(app.prisma, request.params.id, parsed.data);

    // Reschedule the task
    if (app.scheduler) {
      await app.scheduler.rescheduleTask(request.params.id);
    }

    return reply.redirect("/tarefas");
  });

  // PATCH /tarefas/:id/toggle — toggle active (HTMX)
  app.patch<{ Params: { id: string } }>(
    "/:id/toggle",
    async (request, reply) => {
      const tarefa = await toggleTarefa(app.prisma, request.params.id);
      if (!tarefa) {
        return reply
          .status(404)
          .send('<div class="toast error">Tarefa não encontrada</div>');
      }

      // Reschedule or unschedule
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

  // DELETE /tarefas/:id — delete (HTMX)
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    // Unschedule first
    if (app.scheduler) {
      app.scheduler.unscheduleTask(request.params.id);
    }

    await deleteTarefa(app.prisma, request.params.id);

    // Return empty string so HTMX removes the element
    return reply.send("");
  });
};
