import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Linking } from "react-native";
import * as Location from "expo-location";
import { apiFetch } from "../helpers/api";
import { FollowTagsScreen } from "./FollowTagsScreen";
import { colors, radii } from "../theme/tokens";

const MIN_AGE_YEARS = 16;
const TERMS_VERSION = "2026-09";
const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function calculateAge(dobIso: string, today = new Date()): number {
  const [year, month, day] = dobIso.split("-").map(Number);
  let years = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    years -= 1;
  }
  return years;
}

function isValidIsoDate(value: string): boolean {
  if (!DOB_PATTERN.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"profile" | "blocked" | "location" | "terms" | "tags">("profile");
  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [prefillingLocationLabel, setPrefillingLocationLabel] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function prefillLocationLabel(latitude: number, longitude: number) {
    setPrefillingLocationLabel(true);
    try {
      const response = await apiFetch<{ label: string | null }>(
        `/geocode/reverse?latitude=${latitude}&longitude=${longitude}`
      );
      if (response?.label) {
        setLocationLabel(response.label);
      }
    } catch {
      // Best-effort only; manual entry stays available on any failure.
    } finally {
      setPrefillingLocationLabel(false);
    }
  }

  async function requestLocation() {
    setLocationError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationError("Location permission was denied — enter your area manually below.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;
    setCoords({ lat: latitude, lng: longitude });
    void prefillLocationLabel(latitude, longitude);
  }

  async function saveLocationAndContinue() {
    if (!coords) {
      setLocationError("Set your location to continue — this is what broadcasts near you are measured against.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ latitude: coords.lat, longitude: coords.lng, location_label: locationLabel || undefined }),
      });
      setStep("terms");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveProfileAndContinue() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setProfileError("Display name is required.");
      return;
    }
    if (!isValidIsoDate(birthdate)) {
      setProfileError("Birthdate must be in YYYY-MM-DD format.");
      return;
    }
    if (calculateAge(birthdate) < MIN_AGE_YEARS) {
      setStep("blocked");
      return;
    }

    setProfileError(null);
    setProfileSubmitting(true);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          display_name: trimmedName,
          date_of_birth: birthdate,
        }),
      });
      setStep("location");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setProfileSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, step === "tags" && styles.tagsStep]}>
      {step === "profile" ? (
        <ProfileStep
          displayName={displayName}
          birthdate={birthdate}
          profileError={profileError}
          profileSubmitting={profileSubmitting}
          onDisplayNameChange={setDisplayName}
          onBirthdateChange={setBirthdate}
          onContinue={saveProfileAndContinue}
        />
      ) : step === "blocked" ? (
        <BlockedStep
          onGoBack={() => {
            setBirthdate("");
            setProfileError(null);
            setStep("profile");
          }}
        />
      ) : step === "location" ? (
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
          {prefillingLocationLabel && (
            <View style={styles.inlinePrefillLoader}>
              <ActivityIndicator size="small" color={colors.parchment500} />
            </View>
          )}

          {locationError && <Text style={styles.error}>{locationError}</Text>}

          <Pressable style={styles.buttonPrimary} onPress={saveLocationAndContinue} disabled={submitting}>
            {submitting ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Continue</Text>}
          </Pressable>
        </>
      ) : step === "terms" ? (
        <TermsStep onAccepted={() => setStep("tags")} />
      ) : (
        <TagStep onDone={onDone} />
      )}
    </View>
  );
}

function BlockedStep({ onGoBack }: { onGoBack: () => void }) {
  return (
    <>
      <Text style={styles.title}>EchoToCrowd is rated 16+</Text>
      <Text style={styles.subtitle}>You can't create an account right now.</Text>
      <Pressable style={styles.buttonSecondary} onPress={onGoBack}>
        <Text style={styles.buttonSecondaryText}>Go back</Text>
      </Pressable>
    </>
  );
}

function ProfileStep({
  displayName,
  birthdate,
  profileError,
  profileSubmitting,
  onDisplayNameChange,
  onBirthdateChange,
  onContinue,
}: {
  displayName: string;
  birthdate: string;
  profileError: string | null;
  profileSubmitting: boolean;
  onDisplayNameChange: (value: string) => void;
  onBirthdateChange: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>Pick the name people see and confirm your age.</Text>

      <TextInput
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor={colors.parchment500}
        value={displayName}
        onChangeText={onDisplayNameChange}
        autoCapitalize="words"
      />
      <TextInput
        style={styles.input}
        placeholder="Birthdate (YYYY-MM-DD)"
        placeholderTextColor={colors.parchment500}
        value={birthdate}
        onChangeText={onBirthdateChange}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {profileError && <Text style={styles.error}>{profileError}</Text>}
      <Pressable style={styles.buttonPrimary} onPress={onContinue} disabled={profileSubmitting}>
        {profileSubmitting ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Continue</Text>}
      </Pressable>
    </>
  );
}

export function TermsStep({ onAccepted }: { onAccepted: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!agreed) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/users/me/accept-terms", {
        method: "POST",
        body: JSON.stringify({ version: TERMS_VERSION }),
      });
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your agreement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Text style={styles.title}>Terms</Text>
      <Text style={styles.subtitle}>EchoToCrowd has zero tolerance for objectionable content or abusive users.</Text>
      <Pressable style={styles.checkRow} onPress={() => setAgreed((current) => !current)}>
        <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
          {agreed ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.checkLabel}>I agree to the Terms of Service, including the Community Guidelines, and the Privacy Policy</Text>
      </Pressable>
      <Pressable onPress={() => void Linking.openURL("https://www.echotocrowd.com/terms")}>
        <Text style={styles.link}>Terms of Service</Text>
      </Pressable>
      <Pressable onPress={() => void Linking.openURL("https://www.echotocrowd.com/privacy")}>
        <Text style={styles.link}>Privacy Policy</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.buttonPrimary, !agreed && styles.buttonDisabled]} onPress={() => void accept()} disabled={!agreed || submitting}>
        {submitting ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Continue</Text>}
      </Pressable>
    </>
  );
}

function TagStep({ onDone }: { onDone: () => void }) {
  return <FollowTagsScreen onDone={onDone} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, justifyContent: "center", padding: 24 },
  tagsStep: { justifyContent: "flex-start", padding: 0 },
  title: { color: colors.parchment100, fontSize: 22, fontWeight: "700" },
  subtitle: { color: colors.parchment500, fontSize: 14, marginTop: 8, marginBottom: 20 },
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
  buttonDisabled: { opacity: 0.45 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: colors.signal500, borderColor: colors.signal500 },
  checkmark: { color: colors.dusk950, fontWeight: "700" },
  checkLabel: { color: colors.parchment100, flex: 1, fontSize: 15 },
  link: { color: colors.signal400, fontSize: 15, marginBottom: 8 },
  error: { color: colors.rust400, fontSize: 13, marginTop: 8 },
  inlinePrefillLoader: { marginBottom: 8, alignItems: "flex-start" },
});
