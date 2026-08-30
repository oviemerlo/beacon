import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { displayTagLabel, REGION_INFO_SUBTITLE } from "../helpers/tags";
import { colors, radii } from "../theme/tokens";
import type { Tag } from "../types/api";

export function RegionCountriesSheet({
  tag,
  onClose,
}: {
  tag: Tag | null;
  onClose: () => void;
}) {
  const countries = tag?.countries ?? [];

  return (
    <Modal visible={tag != null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss country list" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{tag ? displayTagLabel(tag.label) : ""}</Text>
          <Text style={styles.subtitle}>{REGION_INFO_SUBTITLE}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {countries.map((country) => (
              <Text key={country} style={styles.country}>
                {country}
              </Text>
            ))}
          </ScrollView>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: colors.dusk900,
    borderTopLeftRadius: radii.beacon * 1.6,
    borderTopRightRadius: radii.beacon * 1.6,
    borderColor: colors.dusk700,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: "70%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.dusk600,
    marginBottom: 12,
  },
  title: { color: colors.parchment100, fontSize: 18, fontWeight: "700" },
  subtitle: { color: colors.parchment500, fontSize: 12, marginTop: 4, marginBottom: 12 },
  list: { maxHeight: 360 },
  listContent: { paddingBottom: 8 },
  country: { color: colors.parchment300, fontSize: 14, paddingVertical: 6, borderBottomColor: colors.dusk700, borderBottomWidth: StyleSheet.hairlineWidth },
  closeButton: {
    marginTop: 12,
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeText: { color: colors.parchment100, fontWeight: "600" },
});
