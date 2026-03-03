import "dotenv/config";
import { buildApp } from "./app.js";
import { config } from "./config.js";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      `🍕 Fatia Rápida rodando em http://${config.host}:${config.port}`,
    );
  } catch (err) {
    app.log.fatal(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Recebido ${signal}, encerrando...`);
      await app.close();
      process.exit(0);
    });
  }
}

main();
