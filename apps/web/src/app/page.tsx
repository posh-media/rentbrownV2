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
        RentBrown V2
      </p>
      <h1 style={{ fontSize: 26, lineHeight: "34px", margin: "8px 0 24px" }}>Investor portal</h1>
      <div className="card">
        <ApiStatus />
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Phase 1 shell — product surfaces arrive in later phases.
        </p>
      </div>
    </main>
  );
}
