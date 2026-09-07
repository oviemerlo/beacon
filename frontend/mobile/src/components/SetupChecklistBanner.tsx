import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { apiFetch } from "../helpers/api";
import { colors, radii } from "../theme/tokens";
import type { SetupStatus } from "../types/api";
import { Card } from "./Shared";

function openSetupHref(href: string, navigation: { getParent?: () => unknown; navigate: (name: string, params?: object) => void }) {
  const tabs = (navigation.getParent?.() as { navigate: (name: string, params?: object) => void } | undefined) ?? navigation;
  if (href === "/broadcasts/new") {
    tabs.navigate("Broadcast");
    return;
  }
  if (href === "/follow-tags") {
    tabs.navigate("Profile", { screen: "FollowTags" });
    return;
  }
  tabs.navigate("Profile");
}

export function SetupChecklistBanner({ style }: { style?: ViewStyle }) {
  const navigation = useNavigation();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      apiFetch<SetupStatus>("/users/me/setup-status")
        .then(setStatus)
        .catch(() => setStatus(null));
    }, [])
  );

  if (dismissed || !status || status.all_required_done) return null;

  const incompleteRequired = status.items.filter((item) => !item.optional && !item.done);
  const optionalIncomplete = status.items.find((item) => item.optional && !item.done);

  return (
    <Card style={style}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Finish setting up — {status.completed_required}/{status.total_required} done
        </Text>
        <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityLabel="Dismiss setup checklist">
          <Text style={styles.dismiss}>×</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {incompleteRequired.map((item) => (
          <Pressable key={item.key} onPress={() => openSetupHref(item.action_href, navigation as any)}>
            <Text style={styles.link}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      {optionalIncomplete ? (
        <>
          <View style={styles.divider} />
          <Pressable style={styles.optionalRow} onPress={() => openSetupHref(optionalIncomplete.action_href, navigation as any)}>
            <Text style={[styles.link, { flex: 1 }]}>{optionalIncomplete.label}</Text>
            <Text style={styles.optionalBadge}>Optional</Text>
          </Pressable>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { color: colors.parchment100, fontSize: 14, fontWeight: "600", flex: 1 },
  dismiss: { color: colors.parchment500, fontSize: 18, lineHeight: 18 },
  list: { marginTop: 12, gap: 8 },
  link: { color: colors.signal400, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.dusk800, marginVertical: 12 },
  optionalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionalBadge: {
    color: colors.signal400,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    borderColor: colors.signal500,
    borderWidth: 1,
    borderRadius: radii.pill,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
