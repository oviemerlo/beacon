import { View, Text, StyleSheet } from "react-native";
import { Card } from "../components/Shared";
import { colors } from "../theme/tokens";

export function ConversationsScreen() {
  // Barebone, same gap as web: GET /conversations (list-for-me) isn't in
  // the API yet — backend only exposes /conversations/{id}/messages so far.
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <Card>
        <Text style={styles.emptyTitle}>No conversations yet.</Text>
        <Text style={styles.emptySubtitle}>Reply to a broadcast in your feed to start one.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
