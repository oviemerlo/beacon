import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme/tokens";
import type { LinkPreview } from "../types/api";

export function LinkPreviewList({ previews }: { previews?: LinkPreview[] }) {
  const rows = (previews ?? []).filter((preview) => preview.status !== "failed");
  if (!rows.length) return null;
  return (
    <View style={styles.list}>
      {rows.map((preview) => (
        <LinkPreviewCard key={preview.id} preview={preview} />
      ))}
    </View>
  );
}

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  const host = hostname(preview.normalized_url);
  const meta = preview.site_name || host;
  const title = preview.title || host || preview.normalized_url;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={() => void Linking.openURL(preview.normalized_url)}
      style={preview.image_url ? styles.imageCard : styles.textCard}
    >
      {preview.image_url ? (
        <Image source={{ uri: preview.image_url }} style={styles.thumb} resizeMode="cover" />
      ) : null}
      <View style={styles.copy}>
        {meta ? (
          <View style={styles.metaRow}>
            {!preview.image_url && preview.favicon_url ? (
              <Image source={{ uri: preview.favicon_url }} style={styles.favicon} />
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {preview.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  list: { marginTop: 8, gap: 8 },
  imageCard: {
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
  },
  textCard: {
    overflow: "hidden",
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
  },
  thumb: { width: 128, height: 96, backgroundColor: colors.dusk900 },
  copy: { flex: 1, minWidth: 0, padding: 10, justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  favicon: { width: 12, height: 12, borderRadius: 2 },
  meta: { flex: 1, color: colors.parchment500, fontSize: 10, fontFamily: "monospace" },
  title: { color: colors.parchment100, fontSize: 14, lineHeight: 18 },
  description: { color: colors.parchment500, fontSize: 12, lineHeight: 16, marginTop: 2 },
});
