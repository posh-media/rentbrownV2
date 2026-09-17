import { ConsoleLogger, type LogLevel } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

/** request-scoped context: correlation id + user id available to logs */
export const requestContext = new AsyncLocalStorage<{ requestId?: string; userId?: string }>();

/** Structured JSON logger — one line per event, PII-safe fields only. */
export class JsonLogger extends ConsoleLogger {
  private write(level: LogLevel, message: unknown, context?: string, meta?: unknown) {
    const ctx = requestContext.getStore();
    const line = {
      ts: new Date().toISOString(),
      level,
      msg: typeof message === "string" ? message : JSON.stringify(message),
      context,
      requestId: ctx?.requestId,
      userId: ctx?.userId,
      ...(typeof meta === "object" && meta !== null ? (meta as object) : {}),
    };
    const out = JSON.stringify(line);
    if (level === "error") process.stderr.write(out + "\n");
    else process.stdout.write(out + "\n");
  }

  override log(message: unknown, context?: string) {
    this.write("log", message, context);
  }
  override error(message: unknown, stack?: string, context?: string) {
    this.write("error", message, context, { stack });
  }
  override warn(message: unknown, context?: string) {
    this.write("warn", message, context);
  }
  override debug(message: unknown, context?: string) {
    this.write("debug", message, context);
  }
  override verbose(message: unknown, context?: string) {
    this.write("verbose", message, context);
  }
}
