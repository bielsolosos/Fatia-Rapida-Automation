import type { FastifyPluginAsync } from "fastify";

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

    // If HTMX partial request, return just the table rows
    if (isPartial || request.headers["hx-request"] === "true") {
      let html = "";
      for (const exec of execucoes) {
        html += await reply.view("partials/execution-row.ejs", { exec });
      }
      // @fastify/view returns the reply, we need raw rendering
      // Actually let's build it inline for partials
      const rows = execucoes
        .map((exec) => {
          const date = new Date(exec.executadoEm).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          });
          const badgeClass =
            exec.status === "SUCESSO"
              ? "badge-success"
              : exec.status === "FALHA"
                ? "badge-danger"
                : "badge-warning";
          const tarefaNome = exec.tarefa
            ? exec.tarefa.nome
            : (exec as any).script
              ? `Script: ${(exec as any).script.nome}`
              : exec.tarefaId
                ? exec.tarefaId.substring(0, 8) + "..."
                : "(avulso)";
          const duracao = exec.duracao ? exec.duracao + "ms" : "—";
          const viewBtn = exec.saida
            ? `<button class="outline btn-sm" hx-get="/execucoes/${exec.id}/detalhes" hx-target="#exec-detail-modal" hx-swap="innerHTML">👁️ Ver</button>`
            : "—";

          return `<tr id="exec-${exec.id}">
          <td>${date}</td>
          <td><span class="badge ${badgeClass}">${exec.status}</span></td>
          <td>${tarefaNome}</td>
          <td>${duracao}</td>
          <td>${viewBtn}</td>
        </tr>`;
        })
        .join("");

      return reply.type("text/html").send(rows);
    }

    return reply.view("pages/execucoes.ejs", {
      execucoes,
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
