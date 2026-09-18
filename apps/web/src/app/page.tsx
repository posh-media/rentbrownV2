"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@rentbrown/ui";
import { ApiStatus } from "@/components/ApiStatus";
import { useSession } from "@/lib/auth";

export default function Home() {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) router.replace("/account");
  }, [loading, session, router]);

  if (loading || session) {
    return (
      <div
        className="rb-shell"
        style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}
      >
        <Spinner label="Loading" />
      </div>
    );
  }

  return (
    <main className="rb-shell" style={{ maxWidth: 720, paddingTop: 80 }}>
      <p className="rb-eyebrow">RentBrown</p>
      <h1 style={{ fontSize: 34, lineHeight: "42px", margin: "0 0 16px" }}>
        Property-backed investing, built on clarity.
      </h1>
      <p className="rb-muted" style={{ fontSize: 16, lineHeight: "26px", maxWidth: 520 }}>
        Invest in vetted property opportunities with fixed-term returns — every number traceable,
        every term up front.
      </p>
      <div className="rb-row" style={{ marginTop: 32 }}>
        <Link href="/signup" className="rb-btn rb-btn--primary">
          Create an account
        </Link>
        <Link href="/login" className="rb-btn rb-btn--ghost">
          Log in
        </Link>
      </div>
      <footer style={{ marginTop: 96, fontSize: 12 }}>
        <ApiStatus />
      </footer>
    </main>
  );
}
