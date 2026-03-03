/**
 * Seed script — cria dados de exemplo para testes
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding banco de dados...\n");

  // Criar tarefa com agendamento
  const tarefa = await prisma.tarefa.create({
    data: {
      nome: "Ponto Matutino",
      descricao: "Registrar ponto às 8h de segunda a sexta",
      webhookUrl: null,
      comandoOuPayload: JSON.stringify({ action: "clock_in", type: "morning" }),
      ativo: true,
      agendamentos: {
        create: [
          {
            diasSemana: JSON.stringify([1, 2, 3, 4, 5]),
            horarios: JSON.stringify(["08:00"]),
            ativo: true,
          },
        ],
      },
    },
  });
  console.log(`✅ Tarefa criada: ${tarefa.nome} (${tarefa.id})`);

  // Criar segunda tarefa
  const tarefa2 = await prisma.tarefa.create({
    data: {
      nome: "Ponto Vespertino",
      descricao: "Registrar ponto às 12h e 13h de segunda a sexta",
      webhookUrl: null,
      comandoOuPayload: JSON.stringify({
        action: "clock_in",
        type: "afternoon",
      }),
      ativo: true,
      agendamentos: {
        create: [
          {
            diasSemana: JSON.stringify([1, 2, 3, 4, 5]),
            horarios: JSON.stringify(["12:00", "13:00"]),
            ativo: true,
          },
        ],
      },
    },
  });
  console.log(`✅ Tarefa criada: ${tarefa2.nome} (${tarefa2.id})`);

  // Criar execução de exemplo
  await prisma.execucao.create({
    data: {
      tarefaId: tarefa.id,
      status: "SUCESSO",
      saida: JSON.stringify({ type: "payload", message: "Execução de teste" }),
      duracao: 150,
    },
  });
  console.log("✅ Execução de exemplo criada");

  console.log("\n🎉 Seed concluído!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
