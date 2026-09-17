import { describe, expect, it } from "vitest";
import {
  depositMachine,
  investmentMachine,
  kycMachine,
  rewardMachine,
  roundMachine,
  withdrawalMachine,
} from "./states.js";

describe("investment state machine", () => {
  it("wallet path: verified payment activates", () => {
    expect(investmentMachine.canTransition("PAYMENT_VERIFIED", "ACTIVE")).toBe(true);
  });

  it("direct path: verified payment with no capacity refunds", () => {
    expect(investmentMachine.canTransition("PAYMENT_VERIFIED", "REFUND_INITIATED")).toBe(true);
    expect(investmentMachine.canTransition("REFUND_INITIATED", "REFUNDED")).toBe(true);
  });

  it("maturity lifecycle: ACTIVE → MATURITY_DUE → COMPLETED", () => {
    expect(investmentMachine.canTransition("ACTIVE", "MATURITY_DUE")).toBe(true);
    expect(investmentMachine.canTransition("MATURITY_DUE", "COMPLETED")).toBe(true);
    expect(investmentMachine.isTerminal("COMPLETED")).toBe(true);
  });

  it("no early exit: ACTIVE has no path back to a pre-investment state", () => {
    expect(investmentMachine.canTransition("ACTIVE", "PAYMENT_PENDING")).toBe(false);
    expect(investmentMachine.canTransition("ACTIVE", "REFUND_INITIATED")).toBe(false);
    expect(investmentMachine.canTransition("ACTIVE", "FAILED")).toBe(false);
  });

  it("guards illegal transitions", () => {
    expect(() => investmentMachine.assertTransition("COMPLETED", "ACTIVE")).toThrow();
    expect(() => investmentMachine.assertTransition("CHECKOUT_INITIATED", "COMPLETED")).toThrow();
  });

  it("late payment after expiry routes to refund", () => {
    expect(investmentMachine.canTransition("PAYMENT_EXPIRED", "REFUND_INITIATED")).toBe(true);
    expect(investmentMachine.canTransition("PAYMENT_EXPIRED", "ACTIVE")).toBe(false);
  });
});

describe("withdrawal state machine (manual admin payout)", () => {
  it("happy path: REQUESTED → FUNDS_RESERVED → PENDING_MANUAL_PAYOUT → COMPLETED", () => {
    expect(withdrawalMachine.canTransition("REQUESTED", "FUNDS_RESERVED")).toBe(true);
    expect(withdrawalMachine.canTransition("FUNDS_RESERVED", "PENDING_MANUAL_PAYOUT")).toBe(true);
    expect(withdrawalMachine.canTransition("PENDING_MANUAL_PAYOUT", "COMPLETED")).toBe(true);
  });

  it("rejection releases funds, never destroys them", () => {
    expect(withdrawalMachine.canTransition("PENDING_MANUAL_PAYOUT", "REJECTED_RELEASED")).toBe(
      true,
    );
    expect(withdrawalMachine.canTransition("PENDING_MANUAL_PAYOUT", "FAILED_RELEASED")).toBe(true);
    expect(withdrawalMachine.isTerminal("REJECTED_RELEASED")).toBe(true);
  });

  it("no transition skips the reservation", () => {
    expect(withdrawalMachine.canTransition("REQUESTED", "COMPLETED")).toBe(false);
    expect(withdrawalMachine.canTransition("REQUESTED", "PENDING_MANUAL_PAYOUT")).toBe(false);
  });
});

describe("round state machine", () => {
  it("lifecycle: DRAFT → SCHEDULED → OPEN → CLOSED_TO_NEW → SETTLING → SETTLED", () => {
    expect(roundMachine.canTransition("DRAFT", "SCHEDULED")).toBe(true);
    expect(roundMachine.canTransition("OPEN", "CLOSED_TO_NEW")).toBe(true);
    expect(roundMachine.canTransition("CLOSED_TO_NEW", "SETTLING")).toBe(true);
    expect(roundMachine.isTerminal("SETTLED")).toBe(true);
  });

  it("closed rounds are immutable — no reopening", () => {
    expect(roundMachine.canTransition("CLOSED_TO_NEW", "OPEN")).toBe(false);
    expect(roundMachine.canTransition("SETTLED", "OPEN")).toBe(false);
  });
});

describe("referral reward state machine", () => {
  it("PENDING → CREDITED on qualification; CREDITED → REVERSED on clawback", () => {
    expect(rewardMachine.canTransition("PENDING", "CREDITED")).toBe(true);
    expect(rewardMachine.canTransition("CREDITED", "REVERSED")).toBe(true);
  });
});

describe("deposit + kyc machines", () => {
  it("deposit: INTENT_CREATED → VERIFIED → CREDITED, CREDITED → REVERSED", () => {
    expect(depositMachine.canTransition("INTENT_CREATED", "VERIFIED")).toBe(true);
    expect(depositMachine.canTransition("CREDITED", "REVERSED")).toBe(true);
    expect(depositMachine.canTransition("CREDITED", "VERIFIED")).toBe(false);
  });

  it("kyc resubmission keeps history", () => {
    expect(kycMachine.canTransition("REJECTED", "DRAFT")).toBe(true);
    expect(kycMachine.canTransition("MORE_INFO_REQUIRED", "SUBMITTED")).toBe(true);
  });
});
