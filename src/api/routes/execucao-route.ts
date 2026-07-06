import type { FastifyPluginAsync } from "fastify";
import { toExecucaoRowView } from "../models/execucao/execucao-view.js";

export const execucaoRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

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

    const { execucoes, total } = await app.services.execucao.list({
      page,
      limit,
      status,
    });

    const totalPages = Math.ceil(total / limit);
    const views = execucoes.map(toExecucaoRowView);

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

  app.get<{ Params: { id: string } }>(
    "/:id/detalhes",
    async (request, reply) => {
      const exec = await app.services.execucao.getById(request.params.id);
      if (!exec) {
        return reply.status(404).send("<p>Execução não encontrada</p>");
      }
      return reply.view("partials/execution-detail.ejs", { exec });
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    await app.services.execucao.delete(request.params.id);
    return reply.send("");
  });
};
