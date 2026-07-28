import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { apiFetch } from "../lib/api";
import { colors, radii } from "../theme/tokens";

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"location" | "tags">("location");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function requestLocation() {
    setError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setError("Location permission was denied — enter your area manually below.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  async function saveLocationAndContinue() {
    if (!coords) {
      setError("Set your location to continue — this is what broadcasts near you are measured against.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ latitude: coords.lat, longitude: coords.lng, location_label: locationLabel || undefined }),
      });
      setStep("tags");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      {step === "location" ? (
        <>
          <Text style={styles.title}>Where are you based?</Text>
          <Text style={styles.subtitle}>
            This sets what broadcasts can reach your feed. It's never shown to other users directly.
          </Text>

          <Pressable style={styles.buttonSecondary} onPress={requestLocation}>
            <Text style={styles.buttonSecondaryText}>{coords ? "Location set ✓" : "Share my location"}</Text>
          </Pressable>

          <TextInput
            style={styles.input}
            placeholder="Neighborhood or city (optional label)"
            placeholderTextColor={colors.parchment500}
            value={locationLabel}
            onChangeText={setLocationLabel}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.buttonPrimary} onPress={saveLocationAndContinue} disabled={submitting}>
            {submitting ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Continue</Text>}
          </Pressable>
        </>
      ) : (
        <TagStep onDone={onDone} />
      )}
    </View>
  );
}

function TagStep({ onDone }: { onDone: () => void }) {
  // Barebone, same as web: fetch GET /tags (not yet in the API) and render
  // selectable tag pills grouped by type once that endpoint exists.
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    try {
      await apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({}) });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Text style={styles.title}>What describes you?</Text>
      <Text style={styles.subtitle}>
        Tags boost what shows up first in your feed — they never restrict who can see your broadcasts.
      </Text>
      <Text style={styles.todo}>
        TODO: wire to GET /tags once that endpoint exists — render a selectable tag grid, then PATCH /users/me
        with the chosen tag IDs.
      </Text>
      <Pressable style={styles.buttonPrimary} onPress={finish} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Finish setup</Text>}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, justifyContent: "center", padding: 24 },
  title: { color: colors.parchment100, fontSize: 22, fontWeight: "700" },
  subtitle: { color: colors.parchment500, fontSize: 14, marginTop: 8, marginBottom: 20 },
  todo: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace", marginBottom: 20 },
  input: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 12,
    color: colors.parchment100,
    marginBottom: 8,
  },
  buttonSecondary: { backgroundColor: colors.dusk700, borderRadius: radii.beacon, paddingVertical: 14, alignItems: "center", marginBottom: 12 },
  buttonSecondaryText: { color: colors.parchment100, fontWeight: "600" },
  buttonPrimary: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  buttonPrimaryText: { color: colors.dusk950, fontWeight: "700" },
  error: { color: colors.rust400, fontSize: 13, marginTop: 8 },
});
