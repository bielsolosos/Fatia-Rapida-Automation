import type { Tarefa } from "@prisma/client";

export interface NotificationPayload {
  tarefa: Tarefa;
  stdout: string;
  stderr: string;
}

export interface NotificationChannel {
  send(url: string, payload: NotificationPayload): Promise<void>;
}
