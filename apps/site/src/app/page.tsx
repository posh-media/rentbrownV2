export default function Home() {
  return (
    <main style={{ maxWidth: 880, margin: "64px auto", padding: "0 24px" }}>
      <p
        style={{
          fontSize: 12,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--accent-gold)",
        }}
      >
        RentBrown
      </p>
      <h1
        className="display-serif"
        style={{ fontSize: 44, lineHeight: "52px", margin: "12px 0 20px" }}
      >
        Property investment, made institutional.
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 18, maxWidth: 560 }}>
        Phase 1 marketing shell — copy, disclosures, and counsel-approved product language are
        finalized before launch.
      </p>
    </main>
  );
}
