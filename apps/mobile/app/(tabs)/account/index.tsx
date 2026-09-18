import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import {
  Alert,
  Badge,
  Body,
  Button,
  Card,
  Screen,
  Spinner,
  Title,
} from "../../../src/components/primitives";
import { useMe } from "../../../src/lib/me";
import { supabase } from "../../../src/lib/supabase";

export default function Account() {
  const router = useRouter();
  const { me, loading } = useMe();

  if (loading || !me) {
    return (
      <Screen>
        <Spinner label="Loading account" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Title>{me.displayName ?? me.username}</Title>
          <Badge status={me.accountStatus} />
        </View>
        <Body muted>
          @{me.username} · {me.email}
        </Body>
        <View style={{ height: 16 }} />

        {me.capabilities.withdrawal?.reason === "KYC_REQUIRED" ? (
          <Alert variant="info">
            Complete identity verification to enable withdrawals when they launch.
          </Alert>
        ) : null}
        {me.pendingConsents.length > 0 ? (
          <Alert variant="warning">
            You have updated documents to review — please complete onboarding.
          </Alert>
        ) : null}

        <Card>
          <Body>Identity verification</Body>
          <View style={{ height: 8 }} />
          <Badge
            status={me.kyc.status}
            label={me.kyc.status === "NONE" ? "Not started" : me.kyc.status}
          />
          <Button
            title={me.kyc.canStart ? "Start verification" : "View verification"}
            onPress={() => router.push("/(tabs)/account/kyc")}
          />
        </Card>

        <Card>
          <Body muted>Display currency: {me.displayCurrency}</Body>
          {me.referralCode ? <Body muted>Referral code: {me.referralCode}</Body> : null}
          <Button
            variant="ghost"
            title="Edit profile"
            onPress={() => router.push("/(tabs)/account/profile")}
          />
        </Card>

        <Button
          variant="secondary"
          title="Sign out"
          onPress={async () => {
            await supabase.auth.signOut();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
