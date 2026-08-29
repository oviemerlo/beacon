import { Text, View, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

export function VerifiedMark({ verified }: { verified?: boolean }) {
  if (!verified) return null;
  return (
    <View style={styles.badge} accessibilityLabel="Verified student">
      <Text style={styles.mark}>✓</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.moss500,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: { color: colors.dusk950, fontSize: 11, fontWeight: "800", lineHeight: 12 },
});
