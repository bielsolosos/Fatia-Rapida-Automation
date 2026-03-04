import path from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function required(key: string): string {
  const value = env[key];
  if (!value)
    throw new Error(`Variável de ambiente obrigatória não definida: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return env[key] || fallback;
}

export const config = {
  port: Number(optional("PORT", "3000")),
  host: optional("HOST", "0.0.0.0"),
  nodeEnv: optional("NODE_ENV", "development"),
  isDev: optional("NODE_ENV", "development") === "development",

  // Database
  databaseUrl: required("DATABASE_URL"),

  // Admin (single-user)
  adminUsername: required("ADMIN_EMAIL"),
  adminPasswordHash: required("ADMIN_PASSWORD_HASH"),

  // Session
  sessionSecret: required("SESSION_SECRET"),
  sessionMaxAge: Number(
    optional("SESSION_MAX_AGE", String(7 * 24 * 60 * 60 * 1000)),
  ), // 7 dias

  // Scheduler
  enableScheduler: optional("ENABLE_SCHEDULER", "true") === "true",

  // Log
  logLevel: optional("LOG_LEVEL", "info"),

  // Scripts
  scriptsDir: optional(
    "SCRIPTS_DIR",
    path.join(__dirname, "..", "scripts", "user"),
  ),
} as const;
