import { useRouter } from "expo-router";
import { View } from "react-native";
import { Body, Button, Card, Screen, Title } from "../../src/components/primitives";
import { useMe } from "../../src/lib/me";

export default function Home() {
  const router = useRouter();
  const { me } = useMe();
  return (
    <Screen>
      <Title>Home</Title>
      <View style={{ height: 16 }} />
      {me && me.kyc.status !== "APPROVED" ? (
        <Card>
          <Body>Verify your identity to get ready for investing.</Body>
          <Button
            title={me.kyc.canStart ? "Start verification" : "View verification"}
            onPress={() => router.push("/(tabs)/account/kyc")}
          />
        </Card>
      ) : null}
      <Card>
        <Body muted>Opportunities arrive in a later phase.</Body>
      </Card>
    </Screen>
  );
}
