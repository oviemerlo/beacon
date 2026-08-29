import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  ATTACHMENT_LOCKED_MESSAGE,
  isAllowedAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  type PickedUpload,
} from "../helpers/uploads";
import { colors, radii } from "../theme/tokens";

export function BroadcastAttachments({
  files,
  onChange,
  canAttach,
  onLocked,
  compact = false,
}: {
  files: PickedUpload[];
  onChange: (files: PickedUpload[]) => void;
  canAttach: boolean;
  onLocked: () => void;
  compact?: boolean;
}) {
  async function pickPhoto() {
    if (!canAttach) {
      onLocked();
      return;
    }
    if (files.length >= MAX_ATTACHMENTS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Photo library permission is required to attach an image.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    if ((asset.fileSize ?? 0) > MAX_ATTACHMENT_BYTES) {
      Alert.alert("File too large", "Attachments must be 20 MB or smaller.");
      return;
    }
    const file: PickedUpload = {
      uri: asset.uri,
      name: asset.fileName ?? "photo.jpg",
      type: asset.mimeType ?? "image/jpeg",
    };
    if (!isAllowedAttachment(file.type, file.name)) {
      Alert.alert("Unsupported file", "Use a JPEG or PNG image.");
      return;
    }
    onChange([...files, file]);
  }

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => void pickPhoto()}
          disabled={files.length >= MAX_ATTACHMENTS}
          accessibilityLabel="Attach a photo"
          style={[styles.clip, !canAttach && styles.clipLocked]}
        >
          <Text style={styles.clipMark}>📎</Text>
        </Pressable>
        {!compact && (
          <Text style={styles.hint}>
            {canAttach ? "JPEG or PNG — 20 MB max" : ATTACHMENT_LOCKED_MESSAGE}
          </Text>
        )}
      </View>
      {files.map((file) => (
        <View key={`${file.uri}-${file.name}`} style={styles.fileRow}>
          <Text style={styles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
          <Pressable onPress={() => onChange(files.filter((item) => item !== file))}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 24, gap: 8 },
  wrapCompact: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  clip: {
    width: 36,
    height: 36,
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
    alignItems: "center",
    justifyContent: "center",
  },
  clipLocked: { opacity: 0.4 },
  clipMark: { fontSize: 16 },
  hint: { flex: 1, color: colors.parchment500, fontSize: 11, fontFamily: "monospace" },
  fileRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  fileName: { flex: 1, color: colors.parchment300, fontSize: 12, fontFamily: "monospace" },
  remove: { color: colors.parchment500, fontSize: 12 },
});
