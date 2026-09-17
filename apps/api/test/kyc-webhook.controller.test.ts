import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import type { KycService } from "../src/modules/kyc/kyc.service.js";
import { KycWebhookController } from "../src/modules/kyc/kyc-webhook.controller.js";

function ctrl(returnValue: unknown, error?: unknown) {
  const kyc = {
    handleProviderCallback: error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(returnValue),
  } as unknown as KycService;
  return { c: new KycWebhookController(kyc), kyc };
}

const req = (raw: string) => ({ rawBody: Buffer.from(raw) }) as never;

describe("KycWebhookController", () => {
  it("passes the raw body and headers to the service and returns 200 on duplicates", async () => {
    const { c, kyc } = ctrl({ received: true, duplicate: true });
    const out = await c.smileIdentity(req("{}"), { "response-signature": "x" });
    expect(out).toEqual({ received: true, duplicate: true });
    expect(kyc.handleProviderCallback).toHaveBeenCalledWith(
      { "response-signature": "x" },
      expect.any(Buffer),
    );
  });

  it("propagates 401 for a bad signature", async () => {
    const { c } = ctrl(
      undefined,
      new UnauthorizedException({ code: "INVALID_SIGNATURE", message: "bad" }),
    );
    await expect(c.smileIdentity(req("{}"), {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("propagates 503 when the provider is not configured", async () => {
    const err = Object.assign(new Error("no provider"), { status: 503 });
    const { c } = ctrl(undefined, err);
    await expect(c.smileIdentity(req("{}"), {})).rejects.toMatchObject({ status: 503 });
  });
});
