import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { api } from "./lib/api";
import { t } from "./theme";

export default function App() {
  const [apiStatus, setApiStatus] = useState<"checking" | "up" | "down">("checking");

  useEffect(() => {
    api
      .health()
      .then(() => setApiStatus("up"))
      .catch(() => setApiStatus("down"));
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.eyebrow}>RENTBROWN V2</Text>
      <Text style={styles.title}>RentBrown</Text>
      <View style={styles.card}>
        <Text style={styles.body}>
          API status:{" "}
          <Text
            style={{
              color:
                apiStatus === "up"
                  ? t.status.success.fg
                  : apiStatus === "down"
                    ? t.status.error.fg
                    : t.text.tertiary,
              fontWeight: "700",
            }}
          >
            {apiStatus}
          </Text>
        </Text>
        <Text style={styles.body}>Phase 1 shell — product surfaces arrive in later phases.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.bg.canvas,
    paddingHorizontal: 24,
    paddingTop: 96,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: t.text.tertiary,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
    color: t.text.primary,
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: t.bg.surface,
    borderColor: t.border.default,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: t.text.secondary,
  },
});
