import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getUploadUrl, uploadAvatar, waitForUploadUrl } from "../helpers/uploads";
import { colors } from "../theme/tokens";

export function ProfileAvatar({
  fileId,
  scanStatus,
}: {
  fileId?: string | null;
  scanStatus?: string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    const load = scanStatus === "pending" ? waitForUploadUrl(fileId) : getUploadUrl(fileId);
    load
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, scanStatus]);

  async function pickPhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is required.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const mime = asset.mimeType ?? "image/jpeg";
    if (mime !== "image/jpeg" && mime !== "image/png") {
      setError("Use a JPEG or PNG photo.");
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadAvatar({
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        type: mime,
      });
      const nextUrl = await waitForUploadUrl(uploaded.file_id);
      setUrl(nextUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => void pickPhoto()} disabled={busy} style={styles.circle} accessibilityLabel="Change profile photo">
        {url ? <Image source={{ uri: url }} style={styles.image} /> : <Text style={styles.placeholder}>+</Text>}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.parchment100} />
          </View>
        ) : null}
      </Pressable>
      <Text style={styles.hint}>{busy ? "Uploading…" : "Change photo"}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "flex-end", gap: 6 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  placeholder: { color: colors.parchment500, fontSize: 22 },
  busy: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D0E14B3",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace" },
  error: { color: colors.rust400, fontSize: 11, maxWidth: 140, textAlign: "right" },
});
