import type { FastifyPluginAsync } from "fastify";

export const aboutRoute: FastifyPluginAsync = async (app) => {
  app.get("/about", async (request, reply) => {
    return reply.view("pages/about.ejs", {
      title: "Sobre o Projeto",
      isAuthenticated: request.isAuthenticated,
      currentPage: "about",
    });
  });
};
