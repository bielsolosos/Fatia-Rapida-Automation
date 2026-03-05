import axios from "axios";

interface WebhookData {
  nome: string;
  descricao: string | null;
  payload: string | null;
}

interface WebhookResult {
  status: number;
  sent: boolean;
}

/**
 * Envia um embed formatado para um webhook Discord.
 */
export async function sendDiscordWebhook(
  url: string,
  data: WebhookData,
): Promise<WebhookResult> {
  const embed = {
    title: `Fatia Rápida — ${data.nome}`,
    description: data.descricao || "Tarefa executada automaticamente",
    color: 0xff6b6b, // vermelho suave
    fields: [
      ...(data.payload
        ? [
            {
              name: "Payload",
              value: `\`\`\`${data.payload}\`\`\``,
              inline: false,
            },
          ]
        : []),
      {
        name: "Executado em",
        value: new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
        inline: true,
      },
    ],
    footer: {
      text: "Fatia Rápida Automation",
    },
    timestamp: new Date().toISOString(),
  };

  const response = await axios.post(
    url,
    {
      embeds: [embed],
    },
    {
      timeout: 10000,
      headers: { "Content-Type": "application/json" },
    },
  );

  return {
    status: response.status,
    sent: true,
  };
}
