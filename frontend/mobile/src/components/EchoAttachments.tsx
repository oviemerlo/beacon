import { useEffect, useState, type ReactNode } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getUploadUrl, isImageAttachment } from "../helpers/uploads";
import { colors, radii } from "../theme/tokens";
import type { BroadcastAttachment } from "../types/api";

export function EchoMediaLayout({
  attachments,
  children,
}: {
  attachments?: BroadcastAttachment[];
  children: ReactNode;
}) {
  if (!attachments?.length) return children;
  return (
    <View style={styles.row}>
      <View style={styles.copy}>{children}</View>
      <View style={styles.media}>
        <EchoAttachments attachments={attachments} />
      </View>
    </View>
  );
}

export function EchoAttachments({ attachments }: { attachments?: BroadcastAttachment[] }) {
  if (!attachments?.length) return null;
  const many = attachments.length > 1;
  return (
    <View style={[styles.grid, many && styles.gridMany]}>
      {attachments.map((file) => (
        <AttachmentTile key={file.file_id} file={file} many={many} />
      ))}
    </View>
  );
}

function AttachmentTile({ file, many }: { file: BroadcastAttachment; many: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const image = isImageAttachment(file.content_type, file.original_filename);

  useEffect(() => {
    let cancelled = false;
    getUploadUrl(file.file_id)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file.file_id]);

  return (
    <Pressable
      onPress={() => url && void Linking.openURL(url)}
      disabled={!url}
      style={[styles.tile, many ? styles.tileMany : styles.tileSingle]}
    >
      {image && url ? (
        <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.doc}>
          <Text style={styles.kind}>{fileKind(file.content_type, file.original_filename)}</Text>
          <Text style={styles.name} numberOfLines={2}>
            {file.original_filename}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function fileKind(contentType: string, name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  if (contentType.includes("pdf") || ext === "PDF") return "PDF";
  if (contentType.includes("word") || ext === "DOCX") return "DOCX";
  if (contentType.includes("sheet") || ext === "XLSX") return "XLSX";
  if (ext) return ext;
  return "FILE";
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  copy: { flex: 1, minWidth: 0, justifyContent: "flex-start" },
  media: { width: "42%", maxWidth: 184, aspectRatio: 1 },
  grid: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridMany: { gap: 1 },
  tile: { backgroundColor: colors.dusk800 },
  tileSingle: { width: "100%", height: "100%" },
  tileMany: { width: "50%", height: "50%" },
  image: { width: "100%", height: "100%" },
  doc: { flex: 1, justifyContent: "flex-end", padding: 10, gap: 6 },
  kind: {
    alignSelf: "flex-start",
    color: colors.parchment300,
    fontSize: 10,
    fontFamily: "monospace",
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk900,
    borderRadius: radii.beacon,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  name: { color: colors.parchment100, fontSize: 11, fontFamily: "monospace" },
});
