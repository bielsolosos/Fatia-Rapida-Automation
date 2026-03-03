import type { FastifyPluginAsync } from "fastify";
import { getDashboardStats } from "../services/tarefa.service.js";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  // All dashboard routes require auth
  app.addHook("preHandler", app.requireAuth);

  // GET / — dashboard with stats
  app.get("/", async (request, reply) => {
    const stats = await getDashboardStats(app.prisma);

    const jobCount = app.scheduler?.getActiveJobCount() ?? 0;

    return reply.view("pages/dashboard.ejs", {
      stats,
      jobCount,
      isAuthenticated: true,
      currentPage: "dashboard",
    });
  });
};
