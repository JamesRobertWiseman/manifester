import type { FastifyInstance } from "fastify";
import { ManagerConflictError, ManagerNotFoundError, ManagerRequestError } from "../errors.ts";

export function registerErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error, _request, reply) => {
    const details = record(error);
    const validation = details && Array.isArray(details["validation"])
      ? details["validation"].find((entry) => record(entry)?.["message"])
      : undefined;
    const validationMessage = record(validation)?.["message"];
    const statusCode = details?.["statusCode"];
    const status = error instanceof ManagerNotFoundError
      ? 404
      : error instanceof ManagerConflictError
        ? 409
        : error instanceof ManagerRequestError
          ? 400
          : typeof statusCode === "number" && statusCode >= 400 && statusCode < 500
            ? statusCode
            : 500;
    return reply.code(status).send({
      message: typeof validationMessage === "string"
        ? validationMessage
        : error instanceof Error
          ? error.message
          : "The manager could not complete this action.",
    });
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}
