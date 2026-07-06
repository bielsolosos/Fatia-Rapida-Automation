import type { PrismaClient } from "@prisma/client";
import type {
  TarefaCreateInput,
  TarefaUpdateInput,
} from "../../../validators/tarefa.schema.js";

export class TarefaService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: TarefaCreateInput) {
    return this.prisma.tarefa.create({
      data: {
        nome: input.nome,
        descricao: input.descricao || null,
        comandoOuPayload: input.comandoOuPayload || null,
        webhookUrl: input.webhookUrl || null,
        diasSemana: JSON.stringify(input.diasSemana),
        horarios: JSON.stringify(input.horarios),
        scriptId: input.scriptId ?? null,
      },
    });
  }

  async update(id: string, input: TarefaUpdateInput) {
    return this.prisma.tarefa.update({
      where: { id },
      data: {
        nome: input.nome,
        descricao: input.descricao || null,
        comandoOuPayload: input.comandoOuPayload || null,
        webhookUrl: input.webhookUrl || null,
        diasSemana: JSON.stringify(input.diasSemana),
        horarios: JSON.stringify(input.horarios),
        scriptId: input.scriptId ?? null,
      },
    });
  }

  async getById(id: string) {
    return this.prisma.tarefa.findUnique({
      where: { id },
      include: {
        script: true,
        _count: { select: { execucoes: true } },
      },
    });
  }

  async list() {
    return this.prisma.tarefa.findMany({
      include: {
        script: { select: { id: true, nome: true } },
        _count: { select: { execucoes: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async toggle(id: string) {
    const tarefa = await this.prisma.tarefa.findUnique({ where: { id } });
    if (!tarefa) return null;
    return this.prisma.tarefa.update({
      where: { id },
      data: { ativo: !tarefa.ativo },
    });
  }

  async delete(id: string) {
    return this.prisma.tarefa.delete({ where: { id } });
  }
}
