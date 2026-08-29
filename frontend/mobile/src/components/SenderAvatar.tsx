import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getUploadUrl } from "../helpers/uploads";
import { colors } from "../theme/tokens";

export function SenderAvatar({
  fileId,
  name,
  size = 24,
}: {
  fileId?: string | null;
  name?: string | null;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getUploadUrl(fileId)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const frame = { width: size, height: size, borderRadius: size / 2 };

  if (!fileId || !url) {
    return (
      <View style={[styles.avatar, frame, styles.fallback]}>
        <Text style={[styles.initial, { fontSize: Math.max(10, size * 0.4) }]}>
          {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
    );
  }

  return <Image source={{ uri: url }} style={[styles.avatar, frame]} />;
}

const styles = StyleSheet.create({
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: colors.parchment300, fontWeight: "600" },
});
