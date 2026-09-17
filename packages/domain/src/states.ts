/**
 * Domain state machines — mirrors docs/STATE_MACHINES.md.
 * Transition guards are pure functions; the API is the only caller.
 * Failed/cancelled entities are terminal states, never deleted.
 */

type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

function makeMachine<S extends string>(name: string, map: TransitionMap<S>) {
  return {
    name,
    states: Object.keys(map) as S[],
    canTransition(from: S, to: S): boolean {
      return (map[from] ?? []).includes(to);
    },
    assertTransition(from: S, to: S): void {
      if (!this.canTransition(from, to)) {
        throw new Error(`illegal ${name} transition: ${from} → ${to}`);
      }
    },
    isTerminal(state: S): boolean {
      return (map[state] ?? []).length === 0;
    },
  };
}

// ── Investment round (RB-007) ────────────────────────────────────
export type RoundState =
  | "DRAFT"
  | "SCHEDULED"
  | "OPEN"
  | "CLOSED_TO_NEW"
  | "SETTLING"
  | "SETTLED"
  | "ARCHIVED"
  | "CANCELLED";

export const roundMachine = makeMachine<RoundState>("investment_round", {
  DRAFT: ["SCHEDULED", "ARCHIVED"],
  SCHEDULED: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED_TO_NEW"],
  CLOSED_TO_NEW: ["SETTLING"],
  SETTLING: ["SETTLED"],
  SETTLED: [],
  ARCHIVED: [],
  CANCELLED: [],
});

// ── Investment (RB-004/008 — no early exit by design) ────────────
export type InvestmentState =
  | "CHECKOUT_INITIATED"
  | "PAYMENT_PENDING"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_VERIFIED"
  | "ACTIVE"
  | "MATURITY_DUE"
  | "SETTLEMENT_PENDING"
  | "COMPLETED"
  | "REFUND_INITIATED"
  | "REFUNDED"
  | "REFUND_FAILED"
  | "OPS_ESCALATED"
  | "REVIEW_REQUIRED"
  | "FAILED";

export const investmentMachine = makeMachine<InvestmentState>("investment", {
  CHECKOUT_INITIATED: ["PAYMENT_PENDING", "FAILED"],
  PAYMENT_PENDING: ["PAYMENT_VERIFIED", "PAYMENT_EXPIRED", "FAILED"],
  PAYMENT_EXPIRED: ["REFUND_INITIATED"], // late payment → refund path
  PAYMENT_VERIFIED: ["ACTIVE", "REFUND_INITIATED"],
  ACTIVE: ["MATURITY_DUE", "REVIEW_REQUIRED"],
  MATURITY_DUE: ["COMPLETED", "SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["COMPLETED", "REVIEW_REQUIRED"],
  COMPLETED: [],
  REFUND_INITIATED: ["REFUNDED", "REFUND_FAILED"],
  REFUNDED: [],
  REFUND_FAILED: ["REFUND_INITIATED", "OPS_ESCALATED"],
  OPS_ESCALATED: [],
  REVIEW_REQUIRED: ["COMPLETED", "REFUND_INITIATED"],
  FAILED: [],
});

// ── Deposit ──────────────────────────────────────────────────────
export type DepositState =
  | "INTENT_CREATED"
  | "VERIFIED"
  | "CREDITED"
  | "REVERSED"
  | "PROVIDER_FAILED"
  | "CANCELLED_BY_USER"
  | "EXPIRED";

export const depositMachine = makeMachine<DepositState>("deposit", {
  INTENT_CREATED: ["VERIFIED", "PROVIDER_FAILED", "CANCELLED_BY_USER", "EXPIRED"],
  VERIFIED: ["CREDITED"],
  CREDITED: ["REVERSED"],
  REVERSED: [],
  PROVIDER_FAILED: [],
  CANCELLED_BY_USER: [],
  EXPIRED: [],
});

// ── Withdrawal — manual admin payout for V1 (RB-052) ─────────────
export type WithdrawalState =
  | "REQUESTED"
  | "FUNDS_RESERVED"
  | "PENDING_MANUAL_PAYOUT"
  | "COMPLETED"
  | "REJECTED"
  | "REJECTED_RELEASED"
  | "FAILED_RELEASED";

export const withdrawalMachine = makeMachine<WithdrawalState>("withdrawal", {
  REQUESTED: ["FUNDS_RESERVED", "REJECTED"],
  FUNDS_RESERVED: ["PENDING_MANUAL_PAYOUT", "REJECTED_RELEASED"],
  PENDING_MANUAL_PAYOUT: ["COMPLETED", "REJECTED_RELEASED", "FAILED_RELEASED"],
  COMPLETED: [],
  REJECTED: [],
  REJECTED_RELEASED: [],
  FAILED_RELEASED: [],
});

// ── Referral reward (RB-072/073) ─────────────────────────────────
export type RewardState = "PENDING" | "CREDITED" | "REVERSED" | "DISQUALIFIED";

export const rewardMachine = makeMachine<RewardState>("referral_reward", {
  PENDING: ["CREDITED", "DISQUALIFIED", "REVERSED"],
  CREDITED: ["REVERSED"],
  REVERSED: [],
  DISQUALIFIED: [],
});

// ── KYC case ─────────────────────────────────────────────────────
export type KycState =
  "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "MORE_INFO_REQUIRED" | "EXPIRED";

export const kycMachine = makeMachine<KycState>("kyc_case", {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED", "MORE_INFO_REQUIRED", "EXPIRED"],
  MORE_INFO_REQUIRED: ["SUBMITTED"],
  REJECTED: ["DRAFT"], // resubmission opens a new attempt — history kept
  EXPIRED: ["DRAFT"],
  APPROVED: ["EXPIRED"],
});

// ── Outbox / notification delivery ───────────────────────────────
export type DeliveryState = "PENDING" | "DISPATCHING" | "SENT" | "RETRY_SCHEDULED" | "FAILED";

export const deliveryMachine = makeMachine<DeliveryState>("notification_delivery", {
  PENDING: ["DISPATCHING"],
  DISPATCHING: ["SENT", "RETRY_SCHEDULED", "FAILED"],
  RETRY_SCHEDULED: ["DISPATCHING", "FAILED"],
  SENT: [],
  FAILED: [],
});

export const machines = {
  roundMachine,
  investmentMachine,
  depositMachine,
  withdrawalMachine,
  rewardMachine,
  kycMachine,
  deliveryMachine,
};
