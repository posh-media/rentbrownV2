import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import type { AppConfigService } from "../../config/config.service.js";
import { requestContext } from "../logging/json-logger.js";

/**
 * Global error surface — never leaks secrets, stack traces, DB details, or PII
 * in production responses. Consistent ApiError shape for all clients.
 */
const DB_CONN_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "28000", // invalid_authorization_specification
  "28P01", // invalid_password — DB credential misconfig is a 503, not a 500
]);

/** pg/pool connectivity failures — surface 503, never the driver internals */
function isDbConnectivityError(err: unknown): boolean {
  const hasCode = (e: unknown) =>
    typeof (e as { code?: unknown })?.code === "string" &&
    DB_CONN_CODES.has((e as { code: string }).code);
  if (hasCode(err)) return true;
  if (err instanceof AggregateError) {
    return err.errors.length > 0 && err.errors.every(hasCode);
  }
  return false;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = requestContext.getStore()?.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code =
        typeof body === "object" && body !== null && "code" in body
          ? String((body as { code: unknown }).code)
          : exception.name.replace(/Exception$/, "").toUpperCase() || "HTTP_ERROR";
      message =
        typeof body === "string"
          ? body
          : typeof body === "object" && body !== null && "message" in body
            ? Array.isArray((body as { message: unknown }).message)
              ? (body as { message: string[] }).message.join("; ")
              : String((body as { message: unknown }).message)
            : exception.message;
      if (typeof body === "object" && body !== null && "details" in body) {
        details = (body as { details: unknown }).details;
      }
    } else if (isDbConnectivityError(exception)) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = "DATABASE_UNAVAILABLE";
      message = "Service temporarily unavailable";
    } else if (exception instanceof Error) {
      // never surface raw error text in production
      message = this.config.isProd ? "Something went wrong" : exception.message;
    }

    if (status >= 500 || code === "DATABASE_UNAVAILABLE") {
      // server-side log retains the real error; client gets a sanitized shape
      console.error(
        JSON.stringify({
          level: "error",
          msg: "unhandled exception",
          requestId,
          path: req.url,
          error: exception instanceof Error ? exception.stack : String(exception),
        }),
      );
    }

    res.status(status).json({
      error: {
        code,
        message: status >= 500 && this.config.isProd ? "Something went wrong" : message,
        requestId,
        ...(details !== undefined ? { details } : {}),
      },
    });
  }
}
