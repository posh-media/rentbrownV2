"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Card, Spinner } from "@rentbrown/ui";
import { supabase } from "@/lib/supabase";

/**
 * Landing for email confirmation / magic link / password reset.
 * PKCE flow: exchange ?code= for a session; implicit links carry tokens in
 * the URL hash which the Supabase client picks up on getSession().
 */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/account";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const code = params.get("code");
      if (code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(code);
        if (err) {
          setError("This link has expired or is invalid — request a new one.");
          return;
        }
      } else {
        // implicit/hash flow — wait a tick for the client to parse the hash
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setError("No sign-in session found — the link may have expired.");
          return;
        }
      }
      router.replace(next.startsWith("/") ? next : "/account");
    })();
    // run once — params/router are stable for this landing page
  }, []);

  return (
    <div className="rb-shell" style={{ maxWidth: 420, paddingTop: 120 }}>
      <Card>
        {error ? (
          <Alert variant="error">{error}</Alert>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Spinner label="Finishing sign-in" />
          </div>
        )}
      </Card>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
