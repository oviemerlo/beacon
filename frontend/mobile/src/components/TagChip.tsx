import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii } from "../theme/tokens";
import type { Tag } from "../types/api";

export function TagChip({
  tag,
  selected,
  onToggle,
  onShowCountries,
  locked = false,
}: {
  tag: Tag;
  selected: boolean;
  onToggle: () => void;
  onShowCountries: (tag: Tag) => void;
  locked?: boolean;
}) {
  const countries = tag.countries ?? [];
  const showInfo = countries.length > 0;

  return (
    <View style={[styles.pill, selected && styles.pillActive, !showInfo && styles.pillPlain, locked && styles.pillLocked]}>
      <Pressable
        onPress={onToggle}
        onLongPress={showInfo ? () => onShowCountries(tag) : undefined}
        delayLongPress={350}
        style={showInfo ? styles.labelHit : undefined}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <Text style={[styles.pillText, selected && styles.pillTextActive]}>{tag.label}</Text>
      </Pressable>
      {showInfo && (
        <Pressable
          onPress={() => onShowCountries(tag)}
          hitSlop={8}
          style={styles.infoHit}
          accessibilityRole="button"
          accessibilityLabel={`Countries in ${tag.label}`}
        >
          <Text style={[styles.infoText, selected && styles.pillTextActive]}>ⓘ</Text>
        </Pressable>
      )}
    </View>
  );
}

export function TagChipRow({
  tags,
  selectedIds,
  onToggle,
  onShowCountries,
  locked = false,
}: {
  tags: Tag[];
  selectedIds: number[];
  onToggle: (tagId: number) => void;
  onShowCountries: (tag: Tag) => void;
  locked?: boolean;
}) {
  return (
    <View style={styles.row}>
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          selected={selectedIds.includes(tag.id)}
          onToggle={() => onToggle(tag.id)}
          onShowCountries={onShowCountries}
          locked={locked}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: colors.dusk600,
    borderWidth: 1,
    backgroundColor: colors.dusk800,
    borderRadius: radii.pill,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  pillPlain: { paddingRight: 12 },
  pillActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  pillLocked: { opacity: 0.4 },
  labelHit: { paddingRight: 4 },
  infoHit: { paddingHorizontal: 4, paddingVertical: 2 },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  pillTextActive: { color: colors.signal400 },
  infoText: { color: colors.parchment500, fontSize: 12 },
});
