import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView } from "react-native";
import type { LegalDocumentDto } from "@rentbrown/types";
import { Alert, Body, Button, Screen, Spinner, Title } from "../../src/components/primitives";
import { api } from "../../src/lib/api";

export default function LegalDoc() {
  const { docType } = useLocalSearchParams<{ docType: string }>();
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
    <Screen>
      <ScrollView>
        {state === "loading" ? (
          <Spinner label="Loading document" />
        ) : state === "missing" || !doc ? (
          <Alert variant="warning">We couldn't find that legal document.</Alert>
        ) : (
          <>
            {doc.version.startsWith("DEV-") ? (
              <Alert variant="warning">
                DEVELOPMENT PLACEHOLDER — this document is not counsel-approved.
              </Alert>
            ) : null}
            <Title>{doc.title}</Title>
            <Body muted>
              {doc.docType} · version {doc.version}
            </Body>
            {doc.summary ? (
              <>
                <Body>{doc.summary}</Body>
              </>
            ) : null}
            {doc.contentUrl ? (
              <Button
                variant="ghost"
                title="Read the full document"
                onPress={() => void Linking.openURL(doc.contentUrl!)}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
