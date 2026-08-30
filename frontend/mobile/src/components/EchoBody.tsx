import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle } from "react-native";
import { BROADCAST_CONTENT_MAX, ECHO_BODY_COLLAPSED_LINES } from "../helpers/broadcastContent";
import { colors } from "../theme/tokens";

export function EchoBody({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  return (
    <View>
      <Text
        style={[style, styles.measure]}
        onTextLayout={(event) => {
          if (event.nativeEvent.lines.length > ECHO_BODY_COLLAPSED_LINES) setCanExpand(true);
        }}
      >
        {children}
      </Text>
      <Text style={style} numberOfLines={expanded ? undefined : ECHO_BODY_COLLAPSED_LINES}>
        {children}
      </Text>
      {canExpand ? (
        <Pressable onPress={() => setExpanded((open) => !open)} accessibilityRole="button">
          <Text style={styles.toggle}>{expanded ? "Show less" : "Show more"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CharacterCountdown({ value, max = BROADCAST_CONTENT_MAX }: { value: string; max?: number }) {
  const left = Math.max(0, max - value.length);
  return <Text style={[styles.countdown, left <= 20 && styles.countdownLow]}>{left} left</Text>;
}

const styles = StyleSheet.create({
  measure: { position: "absolute", opacity: 0, left: 0, right: 0 },
  toggle: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace", marginTop: 4 },
  countdown: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace", textAlign: "right", marginTop: 4, marginBottom: 12 },
  countdownLow: { color: colors.signal400 },
});
