import { useRouter } from "expo-router";
import { View } from "react-native";
import { Body, Button, Screen, Title } from "../../src/components/primitives";

const BEATS = [
  "Property-backed opportunities, vetted before they reach you.",
  "Fixed-term returns with every number traceable.",
  "Your money, your terms — no hidden fees.",
];

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen style={{ justifyContent: "center" }}>
      <Title>RentBrown</Title>
      <View style={{ marginVertical: 24, gap: 16 }}>
        {BEATS.map((b) => (
          <Body key={b} muted>
            • {b}
          </Body>
        ))}
      </View>
      <Button title="Create an account" onPress={() => router.push("/(auth)/signup")} />
      <Button variant="ghost" title="Log in" onPress={() => router.push("/(auth)/login")} />
    </Screen>
  );
}
