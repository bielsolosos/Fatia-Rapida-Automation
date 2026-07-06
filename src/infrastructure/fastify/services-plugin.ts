import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { buildServices, type Services } from "../../core/composition/composition-root.js";
import { FastifyLogger } from "../../core/logger/fastify-logger.js";

declare module "fastify" {
  interface FastifyInstance {
    services: Services;
  }
}

export const servicesPlugin = fp(async (app: FastifyInstance) => {
  const logger = new FastifyLogger(app.log);
  const services = buildServices(logger);
  app.decorate("services", services);
});
