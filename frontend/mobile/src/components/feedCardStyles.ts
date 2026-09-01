import { StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

export const feedCardStyles = StyleSheet.create({
  headingCopy: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 20, rowGap: 8 },
  senderCluster: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 },
  cardText: { color: colors.parchment100, fontSize: 16, fontWeight: "400", lineHeight: 22, marginTop: 8, marginBottom: 4 },
  cardOverflow: { overflow: "visible", zIndex: 1 },
  cardMenuOpen: { zIndex: 20, elevation: 12 },
});
