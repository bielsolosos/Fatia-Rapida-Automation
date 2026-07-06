import type { PrismaClient, Script, Tarefa } from "@prisma/client";
import { ActionTipo } from "../../../core/enums/action-tipo.js";
import { ExecucaoStatus } from "../../../core/enums/execucao-status.js";
import { BusinessException } from "../../../core/exceptions/business-exception.js";
import { consoleLogger } from "../../../core/logger/console-logger.js";
import type { Logger } from "../../../core/logger/logger.js";
import { prisma } from "../../../infrastructure/persistence/prisma.js";
import {
  actionExecutorFactory,
  type ActionExecutorFactory,
} from "../action/action-executor-factory.js";
import type { ActionContext } from "../action/action-executor.js";
import {
  scriptActionExecutor,
  type ScriptActionExecutor,
} from "../action/script-action-executor.js";
import type { ExecucaoSaida } from "../model/execucao-saida.js";
import {
  notificationService,
  type NotificationService,
} from "../notification/notification-service.js";

export interface ExecucaoResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duracao: number;
}

export class ExecucaoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly actionFactory: ActionExecutorFactory,
    private readonly scriptExecutor: ScriptActionExecutor,
    private readonly notification: NotificationService,
  ) {}

  async runTask(tarefa: Tarefa): Promise<void> {
    const start = Date.now();
    const execucao = await this.prisma.execucao.create({
      data: { tarefaId: tarefa.id, status: ExecucaoStatus.EM_ANDAMENTO },
    });

    let stdout = "";
    let stderr = "";

    try {
      let script: Script | null = null;
      if (tarefa.scriptId) {
        script = await this.prisma.script.findUnique({
          where: { id: tarefa.scriptId },
        });
      }

      const ctx: ActionContext = { tarefa, script };
      const executor = this.actionFactory.for(tarefa);
      const result = await executor.execute(ctx);
      stdout = result.stdout;
      stderr = result.stderr;

      if (result.exitCode !== 0 && result.tipo !== ActionTipo.NOOP) {
        throw new Error(`Execução saiu com código ${result.exitCode}`);
      }

      if (tarefa.webhookUrl) {
        await this.notification.send(tarefa.webhookUrl, {
          tarefa,
          stdout,
          stderr,
        });
      }

      const duracao = Date.now() - start;
      const saida = this.buildSuccessSaida(result.tipo, {
        stdout,
        stderr,
        script,
        tarefa,
        exitCode: result.exitCode,
      });
      this.logger.info(`Tarefa "${tarefa.nome}" concluída em ${duracao}ms`);

      await this.prisma.execucao.update({
        where: { id: execucao.id },
        data: {
          status: ExecucaoStatus.SUCESSO,
          saida: JSON.stringify(saida),
          duracao,
        },
      });
    } catch (err) {
      const duracao = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Tarefa "${tarefa.nome}" falhou: ${errorMessage}`);

      const saida: ExecucaoSaida = {
        type: "ERROR",
        error: errorMessage,
        stdout,
        stderr,
      };
      await this.prisma.execucao.update({
        where: { id: execucao.id },
        data: {
          status: ExecucaoStatus.FALHA,
          saida: JSON.stringify(saida),
          duracao,
        },
      });
    }
  }

  async runScriptManually(scriptId: string): Promise<ExecucaoResult> {
    const script = await this.prisma.script.findUnique({
      where: { id: scriptId },
    });
    if (!script) throw new BusinessException("Script não encontrado");

    const start = Date.now();
    const execucao = await this.prisma.execucao.create({
      data: { scriptId, status: ExecucaoStatus.EM_ANDAMENTO },
    });

    const result = await this.scriptExecutor.execute({ script });
    const duracao = Date.now() - start;

    const status =
      result.exitCode === 0 ? ExecucaoStatus.SUCESSO : ExecucaoStatus.FALHA;
    const saida: ExecucaoSaida = {
      type: "SCRIPT",
      stdout: result.stdout,
      stderr: result.stderr,
      scriptNome: script.nome,
      exitCode: result.exitCode,
    };

    await this.prisma.execucao.update({
      where: { id: execucao.id },
      data: { status, saida: JSON.stringify(saida), duracao },
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duracao,
    };
  }

  private buildSuccessSaida(
    tipo: ActionTipo,
    data: {
      stdout: string;
      stderr: string;
      script: Script | null;
      tarefa: Tarefa;
      exitCode: number;
    },
  ): ExecucaoSaida {
    if (tipo === ActionTipo.SCRIPT) {
      return {
        type: "SCRIPT",
        stdout: data.stdout,
        stderr: data.stderr,
        scriptNome: data.script?.nome ?? "",
        exitCode: data.exitCode,
      };
    }
    if (tipo === ActionTipo.SHELL) {
      return {
        type: "SHELL",
        stdout: data.stdout,
        stderr: data.stderr,
        comando: data.tarefa.comandoOuPayload ?? "",
      };
    }
    return { type: "NOOP" };
  }
}

export const execucaoService = new ExecucaoService(
  prisma,
  consoleLogger,
  actionExecutorFactory,
  scriptActionExecutor,
  notificationService,
);
