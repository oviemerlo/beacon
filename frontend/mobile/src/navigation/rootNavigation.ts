import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

export function openJoinToken(token: string): boolean {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate("App", {
    screen: "Groups",
    params: { screen: "JoinGroup", params: { token } },
  });
  return true;
}
