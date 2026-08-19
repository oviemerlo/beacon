import { useEffect, useState } from "react";
import { Text, View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { colors, radii } from "../theme/tokens";
import { distanceMeters } from "../helpers/distance";

const LOCATION_DRIFT_THRESHOLD_METERS = 50000;
let dismissedForSession = false;

export function LocationDriftBanner({
  registeredLatitude,
  registeredLongitude,
  onConfirmUpdate,
}: {
  registeredLatitude: number | null;
  registeredLongitude: number | null;
  onConfirmUpdate: (latitude: number, longitude: number) => Promise<void>;
}) {
  const [distance, setDistance] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function check() {
      if (dismissedForSession) {
        setDismissed(true);
        return;
      }
      if (registeredLatitude == null || registeredLongitude == null) return;
      const permissions = await Location.getForegroundPermissionsAsync();
      if (permissions.status !== "granted") return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const drift = distanceMeters(
        registeredLatitude,
        registeredLongitude,
        pos.coords.latitude,
        pos.coords.longitude
      );
      setCurrentCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setDistance(drift);
    }
    check().catch(() => setDistance(null));
  }, [registeredLatitude, registeredLongitude]);

  if (dismissed || distance == null || distance <= LOCATION_DRIFT_THRESHOLD_METERS || currentCoords == null) return null;

  function dismissSession() {
    dismissedForSession = true;
    setDismissed(true);
  }

  async function confirmUpdate() {
    if (!currentCoords) return;
    setSaving(true);
    try {
      await onConfirmUpdate(currentCoords.latitude, currentCoords.longitude);
      dismissSession();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        You seem to be about {Math.round(distance)}m from your registered location.
        Update location for more accurate nearby results?
      </Text>
      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButton} disabled={saving} onPress={confirmUpdate}>
          {saving ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.primaryButtonText}>Update location</Text>}
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
