import type { FastifyPluginAsync } from "fastify";

export const dashboardRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireAuth);

  app.get("/", async (_request, reply) => {
    const stats = await app.services.dashboard.getStats();
    const jobCount = app.scheduler?.getActiveJobCount() ?? 0;

    return reply.view("pages/dashboard.ejs", {
      stats,
      jobCount,
      isAuthenticated: true,
      currentPage: "dashboard",
    });
  });
};
