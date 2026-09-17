import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../src/common/pipes/zod-validation.pipe.js";

const schema = z.object({
  amount: z.string().regex(/^\d+$/),
  currency: z.enum(["NGN", "USD"]),
});

const meta = { type: "body" } as never;

describe("ZodValidationPipe", () => {
  it("passes through valid payloads", () => {
    const pipe = new ZodValidationPipe(schema);
    const input = { amount: "500000", currency: "NGN" };
    expect(pipe.transform(input, meta)).toEqual(input);
  });

  it("rejects invalid payloads with field details", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ amount: "abc", currency: "EUR" }, meta);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        details: { path: string; message: string }[];
      };
      const paths = body.details.map((d) => d.path);
      expect(paths).toContain("amount");
      expect(paths).toContain("currency");
    }
  });
});
