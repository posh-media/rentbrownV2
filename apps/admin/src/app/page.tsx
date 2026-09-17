import { ApiStatus } from "@/components/ApiStatus";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <p
        style={{
          fontSize: 12,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        RentBrown V2 — internal
      </p>
      <h1 style={{ fontSize: 26, lineHeight: "34px", margin: "8px 0 24px" }}>Operations console</h1>
      <div className="card">
        <ApiStatus />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Admin surfaces — withdrawal queue, KYC review, RBAC management — arrive in later phases
          behind permission-gated routes.
        </p>
      </div>
    </main>
  );
}
