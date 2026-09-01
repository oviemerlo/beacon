import { Alert, Pressable, Share, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { stripUrls } from "../helpers/share";
import { echoPreview } from "../helpers/time";

const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://echotocrowd.com").replace(/\/$/, "");

export function echoShareUrl(broadcastId: string): string {
  return `${WEB_ORIGIN}/e/${broadcastId}`;
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
  async function onShare() {
    const url = echoShareUrl(broadcastId);
    const title = `${senderName} on EchoToCrowd`;
    const previewText = stripUrls(content);
    const text = previewText ? echoPreview(previewText) : `${senderName} shared an Echo`;
    try {
      await Share.share({ title, message: `${text}\n${url}` });
    } catch {
      Alert.alert("Couldn't share this Echo.");
    }
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Share this Echo" onPress={() => void onShare()} style={style}>
      <Text style={textStyle}>Share</Text>
    </Pressable>
  );
}
