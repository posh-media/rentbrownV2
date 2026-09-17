import { Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "../logging/json-logger.js";

/** assigns/propagates x-request-id and scopes requestContext for the request */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    res.setHeader("x-request-id", requestId);
    requestContext.run({ requestId }, () => next());
  }
}
