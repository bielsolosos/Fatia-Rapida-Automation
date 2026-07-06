import type { FastifyBaseLogger } from "fastify";
import type { Logger } from "./logger.js";

export class FastifyLogger implements Logger {
  constructor(private readonly log: FastifyBaseLogger) {}

  info(msg: string, ctx?: Record<string, unknown>): void {
    if (ctx) this.log.info(ctx, msg);
    else this.log.info(msg);
  }

  warn(msg: string, ctx?: Record<string, unknown>): void {
    if (ctx) this.log.warn(ctx, msg);
    else this.log.warn(msg);
  }

  error(msg: string, ctx?: Record<string, unknown>): void {
    if (ctx) this.log.error(ctx, msg);
    else this.log.error(msg);
  }
}
