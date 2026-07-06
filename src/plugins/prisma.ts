import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  connectPrisma,
  disconnectPrisma,
  prisma,
} from "../infrastructure/persistence/prisma.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  await connectPrisma();
  app.log.info("Prisma conectado ao banco de dados");

  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    app.log.info("Desconectando Prisma...");
    await disconnectPrisma();
  });
});
