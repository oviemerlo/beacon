import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { signInWithApple, signInWithGoogle } from "../lib/auth";
import { colors, radii } from "../theme/tokens";
import { SignalPing } from "../components/Shared";

export function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onSignedIn();
    } catch (e: any) {
      setError(e.message ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <SignalPing size={10} />
        <Text style={styles.brandText}>BEACON</Text>
      </View>
      <Text style={styles.title}>Sign in to continue</Text>
      <Text style={styles.subtitle}>We only use this to verify who you are — never to post on your behalf.</Text>

      {busy ? (
        <ActivityIndicator color={colors.signal500} style={{ marginTop: 24 }} />
      ) : (
        <>
          <Pressable style={styles.buttonPrimary} onPress={() => handle(signInWithGoogle)}>
            <Text style={styles.buttonPrimaryText}>Get started</Text>
          </Pressable>

          <Pressable style={styles.buttonSecondary} onPress={() => handle(signInWithGoogle)}>
            <Text style={styles.buttonSecondaryText}>Sign in</Text>
          </Pressable>

          <Text style={styles.joinPrompt}>
            New to Beacon? <Text style={styles.joinNow}>Join now</Text>
          </Text>

          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radii.beacon}
              style={{ width: "100%", height: 48, marginTop: 12 }}
              onPress={() => handle(signInWithApple)}
            />
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, justifyContent: "center", padding: 24 },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 },
  brandText: { color: colors.signal400, fontWeight: "700", letterSpacing: 3, fontSize: 12 },
  title: { color: colors.parchment100, fontSize: 24, fontWeight: "700", textAlign: "center" },
  subtitle: { color: colors.parchment500, fontSize: 14, textAlign: "center", marginTop: 8, marginBottom: 28 },
  buttonPrimary: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingVertical: 14, alignItems: "center" },
  buttonPrimaryText: { color: colors.dusk950, fontWeight: "700" },
  buttonSecondary: {
    backgroundColor: colors.dusk700,
    borderRadius: radii.beacon,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.dusk600,
  },
  buttonSecondaryText: { color: colors.parchment100, fontWeight: "600" },
  joinPrompt: { color: colors.parchment500, textAlign: "center", marginTop: 14, fontSize: 13 },
  joinNow: { color: colors.signal400, fontWeight: "600" },
  error: { color: colors.rust400, textAlign: "center", marginTop: 16 },
});
