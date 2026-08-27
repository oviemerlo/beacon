import { Text, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

export function VerifiedMark({ verified }: { verified?: boolean }) {
  if (!verified) return null;
  return (
    <Text style={styles.mark} accessibilityLabel="Verified student">
      ✓
    </Text>
  );
}

const styles = StyleSheet.create({
  mark: { color: colors.moss500, fontSize: 12, fontWeight: "700" },
});
