import { describe, expect, it, vi } from "vitest";
import type { ArgumentsHost } from "@nestjs/common";
import { BadRequestException, HttpStatus } from "@nestjs/common";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter.js";
import type { AppConfigService } from "../src/config/config.service.js";

function makeHost(reqUrl = "/v1/x") {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ url: reqUrl }),
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

function config(isProd: boolean): AppConfigService {
  return { isProd } as AppConfigService;
}

describe("HttpExceptionFilter", () => {
  it("maps HttpException to the standard error shape", () => {
    const { host, res } = makeHost();
    new HttpExceptionFilter(config(false)).catch(
      new BadRequestException({ code: "VALIDATION_FAILED", message: "bad input" }),
      host,
    );
    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body = res.json.mock.calls[0]![0] as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.message).toBe("bad input");
  });

  it("sanitizes unexpected errors in production — no stack, no internals", () => {
    const { host, res } = makeHost();
    new HttpExceptionFilter(config(true)).catch(
      new Error("pg: connection to db.internal:5432 refused"),
      host,
    );
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = res.json.mock.calls[0]![0] as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Something went wrong");
    expect(JSON.stringify(body)).not.toContain("db.internal");
  });

  it("maps pg connectivity failures to 503 DATABASE_UNAVAILABLE", () => {
    const { host, res } = makeHost();
    new HttpExceptionFilter(config(false)).catch(
      Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" }),
      host,
    );
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    const body = res.json.mock.calls[0]![0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
    expect(body.error.message).toBe("Service temporarily unavailable");
  });

  it("maps pg AggregateError (pool connect) to 503 DATABASE_UNAVAILABLE", () => {
    const { host, res } = makeHost();
    const agg = new AggregateError([
      Object.assign(new Error("a"), { code: "ECONNREFUSED" }),
      Object.assign(new Error("b"), { code: "ETIMEDOUT" }),
    ]);
    new HttpExceptionFilter(config(false)).catch(agg, host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    const body = res.json.mock.calls[0]![0] as { error: { code: string } };
    expect(body.error.code).toBe("DATABASE_UNAVAILABLE");
  });

  it("does not map mixed AggregateError to DATABASE_UNAVAILABLE", () => {
    const { host, res } = makeHost();
    const agg = new AggregateError([
      Object.assign(new Error("a"), { code: "ECONNREFUSED" }),
      new Error("unrelated"),
    ]);
    new HttpExceptionFilter(config(false)).catch(agg, host);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it("includes raw error message outside production", () => {
    const { host, res } = makeHost();
    new HttpExceptionFilter(config(false)).catch(new Error("boom detail"), host);
    const body = res.json.mock.calls[0]![0] as { error: { message: string } };
    expect(body.error.message).toBe("boom detail");
  });
});
