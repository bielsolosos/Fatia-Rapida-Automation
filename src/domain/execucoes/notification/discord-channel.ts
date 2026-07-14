import axios from "axios";
import type { NotificationChannel, NotificationPayload } from "./notification-channel.js";

const FIELD_MAX = 1024;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (truncado)`;
}

function codeBlock(content: string): string {
  return `\`\`\`\n${content}\n\`\`\``;
}

export class DiscordChannel implements NotificationChannel {
  async send(url: string, payload: NotificationPayload): Promise<void> {
    const { tarefa, stdout, stderr } = payload;

    const fields: Array<{ name: string; value: string; inline: boolean }> = [];

    if (stdout) {
      fields.push({
        name: "Saída (stdout)",
        value: codeBlock(truncate(stdout, FIELD_MAX - 10)),
        inline: false,
      });
    }

    if (stderr) {
      fields.push({
        name: "Erro (stderr)",
        value: codeBlock(truncate(stderr, FIELD_MAX - 10)),
        inline: false,
      });
    }

    fields.push({
      name: "Executado em",
      value: new Date().toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      }),
      inline: true,
    });

    const embed = {
      title: `Fatia Rápida — ${tarefa.nome}`,
      description:
        tarefa.descricao || "Tarefa executada automaticamente",
      color: 0xff6b6b,
      fields,
      footer: { text: "Fatia Rápida Automation" },
      timestamp: new Date().toISOString(),
    };

    await axios.post(
      url,
      { embeds: [embed] },
      { timeout: 10_000, headers: { "Content-Type": "application/json" } },
    );
  }
}