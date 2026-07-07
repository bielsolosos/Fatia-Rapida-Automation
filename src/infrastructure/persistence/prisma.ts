import { PrismaClient } from "@prisma/client";
import { config } from "../../config.js";

export const prisma = new PrismaClient({
  log:
    config.logLevel === "debug"
      ? [{ emit: "event", level: "query" }]
      : [],
});

export async function connectPrisma(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
