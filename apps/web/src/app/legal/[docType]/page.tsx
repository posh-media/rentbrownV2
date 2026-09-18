"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LegalDocumentDto } from "@rentbrown/types";
import { Alert, Card, PageHeader, Spinner } from "@rentbrown/ui";
import { api } from "@/lib/api";

export default function LegalDocPage() {
  const { docType } = useParams<{ docType: string }>();
  const [doc, setDoc] = useState<LegalDocumentDto | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "ready">("loading");

  useEffect(() => {
    api
      .legalDocuments()
      .then((docs) => {
        const found = docs.find((d) => d.docType.toLowerCase() === String(docType).toLowerCase());
        setDoc(found ?? null);
        setState(found ? "ready" : "missing");
      })
      .catch(() => setState("missing"));
  }, [docType]);

  return (
    <div className="rb-shell" style={{ maxWidth: 720, paddingTop: 64 }}>
      {state === "loading" ? (
        <Spinner label="Loading document" />
      ) : state === "missing" || !doc ? (
        <Card>
          <PageHeader title="Document unavailable" />
          <p className="rb-muted">We couldn't find that legal document.</p>
          <Link href="/">Back to RentBrown</Link>
        </Card>
      ) : (
        <Card>
          {doc.version.startsWith("DEV-") ? (
            <Alert variant="warning">
              DEVELOPMENT PLACEHOLDER — this document is not counsel-approved.
            </Alert>
          ) : null}
          <PageHeader
            title={doc.title}
            subtitle={`${doc.docType} · version ${doc.version}${
              doc.effectiveAt
                ? ` · effective ${new Date(doc.effectiveAt).toLocaleDateString()}`
                : ""
            }`}
          />
          {doc.summary ? (
            <p className="rb-muted" style={{ fontSize: 15, lineHeight: "24px" }}>
              {doc.summary}
            </p>
          ) : null}
          {doc.contentUrl ? (
            <p style={{ marginTop: 16 }}>
              <a href={doc.contentUrl} target="_blank" rel="noreferrer">
                Read the full document
              </a>
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}
