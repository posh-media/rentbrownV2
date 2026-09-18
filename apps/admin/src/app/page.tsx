"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@rentbrown/ui";
import { useSession } from "@/lib/auth";

export default function AdminHome() {
  const { session, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading) router.replace(session ? "/dashboard" : "/login");
  }, [loading, session, router]);

  return (
    <div
      className="rb-shell"
      style={{ display: "flex", justifyContent: "center", paddingTop: 120 }}
    >
      <Spinner label="Loading" />
    </div>
  );
}
