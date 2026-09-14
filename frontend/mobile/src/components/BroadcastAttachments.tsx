import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ATTACHMENT_TYPES,
  isAllowedAttachment,
  isImageAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  type PickedUpload,
} from "../helpers/uploads";
import { colors, radii } from "../theme/tokens";

export function BroadcastAttachments({
  files,
  onChange,
  compact = false,
}: {
  files: PickedUpload[];
  onChange: (files: PickedUpload[]) => void;
  compact?: boolean;
}) {
  function tryAddFile(file: PickedUpload, size: number) {
    if (size > MAX_ATTACHMENT_BYTES) {
      Alert.alert("File too large", "Attachments must be 20 MB or smaller.");
      return;
    }
    if (!isAllowedAttachment(file.type, file.name)) {
      Alert.alert("Unsupported file", "Use a JPEG, PNG, PDF, DOCX, or XLSX file.");
      return;
    }
    onChange([...files, file]);
  }

  async function pickPhoto() {
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
    tryAddFile(
      {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      },
      asset.fileSize ?? 0
    );
  }

  async function pickDocument() {
    if (files.length >= MAX_ATTACHMENTS) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: Array.from(ATTACHMENT_TYPES),
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    tryAddFile(
      {
        uri: asset.uri,
        name: asset.name ?? "file",
        type: asset.mimeType ?? "",
      },
      asset.size ?? 0
    );
  }

  function pickAttachment() {
    if (files.length >= MAX_ATTACHMENTS) return;
    Alert.alert("Attach", "Choose a photo or a file.", [
      { text: "Photo", onPress: () => void pickPhoto() },
      { text: "File", onPress: () => void pickDocument() },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={pickAttachment}
          disabled={files.length >= MAX_ATTACHMENTS}
          accessibilityLabel="Attach a photo or file"
          style={styles.clip}
        >
          <Text style={styles.clipMark}>📎</Text>
        </Pressable>
        {!compact && <Text style={styles.hint}>JPEG, PNG, PDF, DOCX, or XLSX — 20 MB max</Text>}
      </View>
      {files.map((file) => (
        <View key={`${file.uri}-${file.name}`} style={styles.fileRow}>
          <AttachmentThumb file={file} />
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

function AttachmentThumb({ file }: { file: PickedUpload }) {
  if (isImageAttachment(file.type, file.name)) {
    return <Image source={{ uri: file.uri }} style={styles.thumb} />;
  }
  return (
    <View style={styles.thumb}>
      <FileTypeIcon type={file.type} name={file.name} />
    </View>
  );
}

function FileTypeIcon({ type, name }: { type: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (type.includes("pdf") || ext === "pdf") {
    return <MaterialCommunityIcons name="file-pdf-box" size={22} color={colors.rust400} />;
  }
  if (type.includes("word") || ext === "docx") {
    return <MaterialCommunityIcons name="file-word-box" size={22} color={colors.signal400} />;
  }
  if (type.includes("sheet") || ext === "xlsx") {
    return <MaterialCommunityIcons name="file-excel-box" size={22} color={colors.moss500} />;
  }
  return <MaterialCommunityIcons name="file-document" size={22} color={colors.parchment300} />;
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
  clipMark: { fontSize: 16 },
  hint: { flex: 1, color: colors.parchment500, fontSize: 11, fontFamily: "monospace" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fileName: { flex: 1, color: colors.parchment300, fontSize: 12, fontFamily: "monospace" },
  remove: { color: colors.parchment500, fontSize: 12 },
});
