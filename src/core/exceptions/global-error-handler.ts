import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { BusinessException } from "./business-exception.js";

export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);

  const isHtmx = request.headers["hx-request"] === "true";

  let statusCode = 500;
  let message = error.message || "Algo deu errado.";

  if (error instanceof BusinessException) {
    statusCode = 400;
    message = error.message || "Erro de negócio";
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = error.issues[0]?.message ?? "Dados inválidos";
  } else if (error.statusCode) {
    statusCode = error.statusCode;
  }

  if (isHtmx) {
    reply
      .status(statusCode)
      .send(`<div class="toast error" role="alert">${message}</div>`);
    return;
  }

  reply.status(statusCode).view("pages/error.ejs", {
    title: `Erro ${statusCode}`,
    statusCode,
    message,
  });
}
