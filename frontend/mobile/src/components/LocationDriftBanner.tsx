import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";

import { syncLocationIfMoved } from "../helpers/locationSync";
import { colors, radii } from "../theme/tokens";
import type { UserProfile } from "../types/api";

let dismissedForSession = false;

export function LocationDriftBanner({
  registeredLatitude,
  registeredLongitude,
  onProfile,
}: {
  registeredLatitude: number | null;
  registeredLongitude: number | null;
  onProfile: (profile: UserProfile) => void;
}) {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [dismissed, setDismissed] = useState(dismissedForSession);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      if (dismissedForSession) {
        setDismissed(true);
        return;
      }
      const permissions = await Location.getForegroundPermissionsAsync();
      if (!active) return;
      setCanAskAgain(permissions.canAskAgain);
      setNeedsPermission(permissions.status !== "granted");
    }

    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (dismissed || !needsPermission) return null;

  function dismissSession() {
    dismissedForSession = true;
    setDismissed(true);
  }

  async function enableLocation() {
    const current = await Location.getForegroundPermissionsAsync();
    if (!current.canAskAgain && current.status !== "granted") {
      await Linking.openSettings();
      return;
    }
    setSaving(true);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      setCanAskAgain(result.canAskAgain);
      if (result.status !== "granted") {
        setNeedsPermission(true);
        return;
      }
      setNeedsPermission(false);
      const profile = await syncLocationIfMoved({
        latitude: registeredLatitude,
        longitude: registeredLongitude,
      });
      if (profile) onProfile(profile);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Turn on location to see echoes near you.</Text>
      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButton} disabled={saving} onPress={() => void enableLocation()}>
          {saving ? (
            <ActivityIndicator color={colors.dusk950} />
          ) : (
            <Text style={styles.primaryButtonText}>{canAskAgain ? "Turn on location" : "Open Settings"}</Text>
          )}
        </Pressable>
        <Pressable style={styles.secondaryButton} disabled={saving} onPress={dismissSession}>
          <Text style={styles.secondaryButtonText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: `${colors.rust400}99`,
    backgroundColor: `${colors.rust400}1A`,
    borderRadius: radii.beacon,
    padding: 12,
  },
  text: {
    color: colors.parchment100,
    fontSize: 12,
    lineHeight: 18,
  },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  primaryButton: {
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.dusk950, fontSize: 12, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: colors.dusk700,
    borderRadius: radii.beacon,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.parchment100, fontSize: 12, fontWeight: "600" },
});
