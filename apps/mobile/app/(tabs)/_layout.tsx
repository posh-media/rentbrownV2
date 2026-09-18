import { Tabs } from "expo-router";
import { Text } from "react-native";
import { t } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.action.primary,
        tabBarInactiveTintColor: t.text.tertiary,
        tabBarStyle: { backgroundColor: t.bg.surface, borderTopColor: t.border.default },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌂</Text>,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◉</Text>,
        }}
      />
    </Tabs>
  );
}
