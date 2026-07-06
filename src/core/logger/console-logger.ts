import type { Logger } from "./logger.js";

export class ConsoleLogger implements Logger {
  info(msg: string, ctx?: Record<string, unknown>): void {
    console.log(msg, ctx ?? "");
  }
  warn(msg: string, ctx?: Record<string, unknown>): void {
    console.warn(msg, ctx ?? "");
  }
  error(msg: string, ctx?: Record<string, unknown>): void {
    console.error(msg, ctx ?? "");
  }
}

export const consoleLogger = new ConsoleLogger();
