import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  const prisma = new PrismaClient({
    log: app.log.level === "debug" ? [{ emit: "event", level: "query" }] : [],
  });

  await prisma.$connect();
  app.log.info("Prisma conectado ao banco de dados");

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    app.log.info("Desconectando Prisma...");
    await prisma.$disconnect();
  });
});
