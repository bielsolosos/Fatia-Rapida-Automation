import { hash } from "bcrypt";
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.log("🔐 Gerador de hash bcrypt para Fatia Rápida\n");

  const password = await ask("Digite a senha: ");

  if (!password || password.length < 6) {
    console.error("❌ Senha deve ter pelo menos 6 caracteres");
    process.exit(1);
  }

  const hashed = await hash(password, 10);

  console.log("\n✅ Hash gerado com sucesso!\n");
  console.log("Copie e cole no seu .env:\n");
  console.log(`ADMIN_PASSWORD_HASH=${hashed}\n`);

  rl.close();
}

main();
