import { useEffect, useState, type ReactNode } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getUploadUrl, isImageAttachment } from "../helpers/uploads";
import { colors, radii } from "../theme/tokens";
import type { BroadcastAttachment } from "../types/api";

export function EchoMediaLayout({
  attachments,
  corner,
  children,
}: {
  attachments?: BroadcastAttachment[];
  corner?: ReactNode;
  children: ReactNode;
}) {
  const count = attachments?.length ?? 0;
  const railMedia = count === 1;
  const stripMedia = count > 1;
  if (count === 0 && !corner) return children;
  return (
    <View style={styles.stack}>
      <View style={styles.rail}>
        <View style={styles.copy}>{children}</View>
        {corner || railMedia ? (
          <View style={[styles.corner, railMedia && styles.cornerWide]}>
            {corner}
            {railMedia ? (
              <View style={styles.media}>
                <EchoAttachments attachments={attachments} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {stripMedia ? <EchoAttachments attachments={attachments} /> : null}
    </View>
  );
}

export function EchoAttachments({ attachments }: { attachments?: BroadcastAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {attachments.map((file) => (
        <AttachmentTile key={file.file_id} file={file} />
      ))}
    </ScrollView>
  );
}

function AttachmentTile({ file }: { file: BroadcastAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const image = isImageAttachment(file.content_type, file.original_filename);

  useEffect(() => {
    let cancelled = false;
    getUploadUrl(file.file_id)
      .then((next) => {
        if (!cancelled) {
          setUrl(next.url);
          setThumbnailUrl(next.thumbnail_url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
          setThumbnailUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file.file_id, file.has_thumbnail]);

  return (
    <Pressable
      onPress={() => url && void Linking.openURL(url)}
      disabled={!url}
      style={styles.tile}
    >
      {image && url ? (
        <Image source={{ uri: url }} style={styles.image} resizeMode="contain" />
      ) : file.has_thumbnail && thumbnailUrl ? (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: thumbnailUrl }} style={styles.image} resizeMode="cover" />
          <Text style={styles.kindOverlay}>{fileKind(file.content_type, file.original_filename)}</Text>
        </View>
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

const TILE = 120;

const styles = StyleSheet.create({
  stack: { gap: 8 },
  rail: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  copy: { flex: 1, minWidth: 0 },
  corner: { alignItems: "flex-end", gap: 8 },
  cornerWide: { width: TILE },
  media: { width: TILE, aspectRatio: 1 },
  strip: { flexDirection: "row", gap: 8, paddingRight: 4 },
  tile: {
    width: TILE,
    height: TILE,
    overflow: "hidden",
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
  },
  image: { width: "100%", height: "100%" },
  thumbWrap: { width: "100%", height: "100%" },
  kindOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    color: colors.parchment300,
    fontSize: 10,
    fontFamily: "monospace",
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk900,
    borderRadius: radii.beacon,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
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
