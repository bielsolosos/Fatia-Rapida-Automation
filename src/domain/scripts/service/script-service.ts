import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ScriptTipo } from "../../../core/enums/script-tipo.js";
import type { ScriptStorage } from "../storage/script-storage.js";
import type { ScriptCreateInput } from "../../../api/models/script/form.js";

export class ScriptService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: ScriptStorage,
  ) {}

  async list() {
    return this.prisma.script.findMany({
      include: { _count: { select: { tarefas: true, execucoes: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    return this.prisma.script.findUnique({
      where: { id },
      include: { _count: { select: { tarefas: true, execucoes: true } } },
    });
  }

  async create(input: ScriptCreateInput) {
    const id = randomUUID();
    const ext = this.extensaoPorTipo(input.tipo);
    const arquivo = `${id}.${ext}`;
    await this.storage.write(arquivo, input.conteudo);
    return this.prisma.script.create({
      data: {
        id,
        nome: input.nome,
        descricao: input.descricao || null,
        tipo: input.tipo,
        arquivo,
        conteudo: input.conteudo,
      },
    });
  }

  async update(id: string, input: ScriptCreateInput) {
    const existing = await this.prisma.script.findUnique({ where: { id } });
    if (!existing) return null;
    const ext = this.extensaoPorTipo(input.tipo);
    const novoArquivo = `${id}.${ext}`;
    if (existing.arquivo !== novoArquivo) {
      await this.storage.remove(existing.arquivo);
    }
    await this.storage.write(novoArquivo, input.conteudo);
    return this.prisma.script.update({
      where: { id },
      data: {
        nome: input.nome,
        descricao: input.descricao || null,
        tipo: input.tipo,
        arquivo: novoArquivo,
        conteudo: input.conteudo,
      },
    });
  }

  async delete(id: string) {
    const script = await this.prisma.script.findUnique({ where: { id } });
    if (!script) return null;
    await this.storage.remove(script.arquivo);
    return this.prisma.script.delete({ where: { id } });
  }

  private extensaoPorTipo(tipo: string): string {
    if (tipo === ScriptTipo.NODEJS) return "js";
    if (tipo === ScriptTipo.PYTHON) return "py";
    return "sh";
  }
}
