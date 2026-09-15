import { Alert, Pressable, Share, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://echotocrowd.com").replace(/\/$/, "");

export function echoShareUrl(broadcastId: string): string {
  return `${WEB_ORIGIN}/e/${broadcastId}`;
}

export async function shareEcho({
  broadcastId,
  senderName,
}: {
  broadcastId: string;
  senderName: string;
  content?: string;
}) {
  const url = echoShareUrl(broadcastId);
  const title = `${senderName} on EchoToCrowd`;
  try {
    await Share.share({ title, message: url, url });
  } catch {
    Alert.alert("Couldn't share this Echo.");
  }
}

export function ShareButton({
  broadcastId,
  senderName,
  content,
  style,
  textStyle,
}: {
  broadcastId: string;
  senderName: string;
  content: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share this Echo"
      onPress={() => void shareEcho({ broadcastId, senderName, content })}
      style={style}
    >
      <Text style={textStyle}>Share</Text>
    </Pressable>
  );
}
