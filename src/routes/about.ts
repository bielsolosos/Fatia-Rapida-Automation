import type { FastifyPluginAsync } from "fastify";

export const aboutRoutes: FastifyPluginAsync = async (app) => {
  // Rota pública — sem requireAuth
  app.get("/about", async (request, reply) => {
    return reply.view("pages/about.ejs", {
      title: "Sobre o Projeto",
      isAuthenticated: request.isAuthenticated,
      currentPage: "about",
    });
  });
};
1;
