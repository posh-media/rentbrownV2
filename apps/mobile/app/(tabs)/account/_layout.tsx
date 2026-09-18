import { Stack } from "expo-router";

export default function AccountLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, title: "Account" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" options={{ title: "Edit profile" }} />
      <Stack.Screen name="kyc" options={{ title: "Verification" }} />
    </Stack>
  );
}
