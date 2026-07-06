import type { FastifyPluginAsync } from "fastify";
import { loginSchema } from "../../validators/auth.schema.js";

export const authRoute: FastifyPluginAsync = async (app) => {
  app.get("/login", async (request, reply) => {
    if (request.isAuthenticated) {
      return reply.redirect("/");
    }
    return reply.view("pages/login.ejs", {});
  });

  app.post("/login", async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return reply.view("pages/login.ejs", {
        error: parsed.error.issues[0]?.message || "Dados inválidos",
        username: body.username || "",
      });
    }

    const { username, password } = parsed.data;
    const success = await app.login(reply, username, password);

    if (!success) {
      return reply.view("pages/login.ejs", {
        error: "Usuário ou senha inválidos",
        username,
      });
    }

    return reply.redirect("/");
  });

  app.post("/logout", async (request, reply) => {
    await app.logout(request, reply);
    return reply.redirect("/login");
  });
};
