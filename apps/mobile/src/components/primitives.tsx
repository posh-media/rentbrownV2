/**
 * RN primitives — Warm Institutional Fintech, light theme.
 * Display only; authorization is always server-side.
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { t } from "../theme";

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: t.text.secondary }]}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export function Button({
  variant = "primary",
  title,
  onPress,
  loading,
  disabled,
}: {
  variant?: ButtonVariant;
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && { backgroundColor: t.action.primary },
        variant === "secondary" && { backgroundColor: t.action.secondary },
        variant === "ghost" && {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: t.border.default,
        },
        variant === "destructive" && { backgroundColor: t.status.error.fg },
        off && { opacity: 0.55 },
        pressed && !off && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "secondary" || variant === "ghost"
              ? t.action.secondaryText
              : t.action.primaryText
          }
        />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === "secondary" || variant === "ghost"
              ? { color: t.action.secondaryText }
              : { color: t.action.primaryText },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <Text style={styles.errorText} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Input({ error, ...rest }: TextInputProps & { error?: boolean }) {
  return (
    <TextInput
      style={[styles.input, error && { borderColor: t.status.error.fg }]}
      placeholderTextColor={t.text.tertiary}
      {...rest}
    />
  );
}

const badgeTone: Record<string, { fg: string; bg: string }> = {
  APPROVED: t.status.success,
  ACTIVE: t.status.success,
  COMPLETED: t.status.success,
  VERIFIED: t.status.success,
  IN_REVIEW: t.status.pending,
  SUBMITTED: t.status.pending,
  PENDING: t.status.pending,
  MORE_INFO_REQUIRED: t.status.pending,
  RESTRICTED: t.status.warning,
  SUSPENDED: t.status.warning,
  REJECTED: t.status.error,
  FAILED: t.status.error,
  CLOSED: t.status.error,
};

export function Badge({ status, label }: { status: string; label?: string }) {
  const tone = badgeTone[status] ?? t.status.info;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>
        {(label ?? status).replaceAll("_", " ")}
      </Text>
    </View>
  );
}

export function Alert({
  variant = "info",
  children,
}: {
  variant?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const tone = t.status[variant];
  return (
    <View
      style={[styles.alert, { backgroundColor: tone.bg, borderColor: tone.fg }]}
      accessibilityLiveRegion={variant === "error" ? "assertive" : "polite"}
    >
      <Text style={{ color: tone.fg, fontSize: 14, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <View style={{ alignItems: "center", padding: 24 }}>
      <ActivityIndicator color={t.action.primary} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg.canvas, padding: 24 },
  title: { fontSize: 24, fontWeight: "700", color: t.text.primary, marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 21, color: t.text.primary },
  card: {
    backgroundColor: t.bg.surface,
    borderWidth: 1,
    borderColor: t.border.default,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnText: { fontSize: 15, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "600", color: t.text.primary, marginBottom: 4 },
  hint: { fontSize: 12, color: t.text.tertiary, marginTop: 4 },
  errorText: { fontSize: 12, color: t.status.error.fg, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: t.border.default,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: t.text.primary,
    backgroundColor: t.bg.surface,
  },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  alert: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 },
});
