import axios from "axios";
import type { NotificationChannel, NotificationPayload } from "./notification-channel.js";

export class DiscordChannel implements NotificationChannel {
  async send(url: string, payload: NotificationPayload): Promise<void> {
    const { tarefa, stdout, stderr } = payload;

    const linhas = [
      `**Tarefa:** ${tarefa.nome}`,
      tarefa.descricao ? `*${tarefa.descricao}*` : "",
      "",
      "**Saída (stdout):**",
      `\`\`\`\n${stdout || "(sem saída)"}\n\`\`\``,
    ];
    if (stderr) {
      linhas.push("**Erro (stderr):**");
      linhas.push(`\`\`\`\n${stderr}\n\`\`\``);
    }

    const embed = {
      title: `Fatia Rápida — ${tarefa.nome}`,
      description: tarefa.descricao || "Tarefa executada automaticamente",
      color: 0xff6b6b,
      fields: [
        {
          name: "Payload",
          value: `\`\`\`${linhas.join("\n")}\`\`\``,
          inline: false,
        },
        {
          name: "Executado em",
          value: new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
          inline: true,
        },
      ],
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
