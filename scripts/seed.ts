/**
 * Seed script — cria dados de exemplo para testes
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding banco de dados...\n");

  // ── Scripts padrões ──
  console.log("📝 Criando scripts padrões...\n");

  const scriptsDir = join(process.cwd(), "scripts", "user");

  // Script 1: Enviar Email (Node.js)
  const emailScript = await prisma.script.create({
    data: {
      id: "4931b8bc-efe6-4bff-95be-bf18c7ce8883",
      nome: "Enviar Email",
      descricao:
        "Envia email via SMTP (Gmail, Outlook, etc.). Configure variáveis SMTP_HOST, SMTP_USER, SMTP_PASS.",
      tipo: "NODEJS",
      arquivo: "4931b8bc-efe6-4bff-95be-bf18c7ce8883.js",
      conteudo: readFileSync(
        join(scriptsDir, "4931b8bc-efe6-4bff-95be-bf18c7ce8883.js"),
        "utf-8",
      ),
      ativo: true,
    },
  });
  console.log(`✅ Script criado: ${emailScript.nome}`);

  // Script 2: Backup Database (Shell)
  const backupScript = await prisma.script.create({
    data: {
      id: "cce22c5d-37e4-4e47-a63e-0a75f1490710",
      nome: "Backup Database",
      descricao:
        "Cria backup timestamped do banco SQLite e mantém os 10 mais recentes.",
      tipo: "SHELL",
      arquivo: "bcce22c5d-37e4-4e47-a63e-0a75f1490710.sh",
      conteudo: readFileSync(
        join(scriptsDir, "cce22c5d-37e4-4e47-a63e-0a75f1490710.sh"),
        "utf-8",
      ),
      ativo: true,
    },
  });
  console.log(`✅ Script criado: ${backupScript.nome}`);

  // Script 3: System Status (Python)
  const statusScript = await prisma.script.create({
    data: {
      id: "30b6e77d-8b12-4d48-ba54-229fec3afa24",
      nome: "System Status",
      descricao:
        "Monitora CPU, memória, disco e temperatura do sistema (requer psutil).",
      tipo: "PYTHON",
      arquivo: "30b6e77d-8b12-4d48-ba54-229fec3afa24.py",
      conteudo: readFileSync(
        join(scriptsDir, "30b6e77d-8b12-4d48-ba54-229fec3afa24.py"),
        "utf-8",
      ),
      ativo: true,
    },
  });
  console.log(`✅ Script criado: ${statusScript.nome}\n`);
  console.log("\n🎉 Seed concluído!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
