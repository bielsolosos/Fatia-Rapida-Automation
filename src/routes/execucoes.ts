import type { FastifyPluginAsync } from "fastify";
import { toExecucaoRowView } from "../api/models/execucao/execucao-view.js";

export const execucaoRoutes: FastifyPluginAsync = async (app) => {
  // All routes require auth
  app.addHook("preHandler", app.requireAuth);

  // GET /execucoes — list with pagination
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      partial?: string;
    };
  }>("/", async (request, reply) => {
    const page = Math.max(1, Number(request.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
    const status = request.query.status || undefined;
    const isPartial = request.query.partial === "true";

    const where = status ? { status } : {};

    const [execucoes, total] = await Promise.all([
      app.prisma.execucao.findMany({
        where,
        include: {
          tarefa: { select: { nome: true } },
          script: { select: { nome: true } },
        },
        orderBy: { executadoEm: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.execucao.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const views = execucoes.map(toExecucaoRowView);

    // HTMX partial: return just the table rows
    if (isPartial || request.headers["hx-request"] === "true") {
      return reply.view("partials/execution-rows.ejs", { views });
    }

    return reply.view("pages/execucoes.ejs", {
      views,
      currentPage: page,
      totalPages,
      limit,
      currentStatus: status || "",
      isAuthenticated: true,
    });
  });

  // GET /execucoes/:id/detalhes — execution detail (HTMX partial)
  app.get<{ Params: { id: string } }>(
    "/:id/detalhes",
    async (request, reply) => {
      const exec = await app.prisma.execucao.findUnique({
        where: { id: request.params.id },
        include: { tarefa: { select: { nome: true } } },
      });

      if (!exec) {
        return reply.status(404).send("<p>Execução não encontrada</p>");
      }

      return reply.view("partials/execution-detail.ejs", { exec });
    },
  );

  // DELETE /execucoes/:id — delete execution (HTMX)
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await app.prisma.execucao.delete({ where: { id: request.params.id } });
    return reply.send("");
  });
};
