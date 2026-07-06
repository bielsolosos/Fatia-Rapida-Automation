import type { Logger } from "../../../core/logger/logger.js";
import type { NotificationChannel, NotificationPayload } from "./notification-channel.js";

export class NotificationService {
  constructor(
    private readonly channels: NotificationChannel[],
    private readonly logger: Logger,
  ) {}

  async send(url: string | null, payload: NotificationPayload): Promise<void> {
    if (!url) return;
    for (const channel of this.channels) {
      try {
        await channel.send(url, payload);
      } catch (err) {
        this.logger.error("Falha ao enviar notificação", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
