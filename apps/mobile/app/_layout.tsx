import "react-native-url-polyfill/auto";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { SessionProvider, useSession } from "../src/lib/session";
import { MeProvider, useMe } from "../src/lib/me";
import { Spinner } from "../src/components/primitives";

function Gate() {
  const { session, loading: sessionLoading } = useSession();
  const { me, loading: meLoading, disabled } = useMe();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (sessionLoading || (session && meLoading)) return;
    const inAuth = segments[0] === "(auth)";
    const onLegal = segments[0] === "legal";

    if (!session) {
      if (!inAuth && !onLegal) router.replace("/(auth)/welcome");
      return;
    }
    if (disabled) return; // blocked screen rendered below
    if (me && me.pendingConsents.length > 0) {
      if (segments[0] !== "onboarding") router.replace("/onboarding");
      return;
    }
    if (inAuth) router.replace("/(tabs)/home");
  }, [session, sessionLoading, me, meLoading, disabled, segments, router]);

  if (sessionLoading || (session && meLoading)) return <Spinner label="Loading" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="legal/[docType]" options={{ headerShown: true, title: "Document" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) return <Spinner label="Loading fonts" />;

  return (
    <SessionProvider>
      <MeProvider>
        <Gate />
      </MeProvider>
    </SessionProvider>
  );
}
