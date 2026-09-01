import { useEffect, useState } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, Text, View } from "react-native";

import { TokenStore } from "../helpers/secureStore";
import { apiFetch } from "../helpers/api";
import { LoginScreen } from "../screens/LoginScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { NewBroadcastScreen } from "../screens/NewBroadcastScreen";
import { BroadcastDetailScreen } from "../screens/BroadcastDetailScreen";
import { ConversationsScreen } from "../screens/ConversationsScreen";
import { ConversationDetailScreen } from "../screens/ConversationDetailScreen";
import { FollowTagsScreen } from "../screens/FollowTagsScreen";
import { BlockedUsersScreen } from "../screens/BlockedUsersScreen";
import { AdminReportsScreen } from "../screens/AdminReportsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { colors } from "../theme/tokens";
import type { UnreadCount, UserProfile } from "../types/api";

const RootStack = createNativeStackNavigator();
const FeedStack = createNativeStackNavigator();
const ConversationsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.dusk950, card: colors.dusk900, border: colors.dusk700, primary: colors.signal500, text: colors.parchment100 },
};

function FeedStackNavigator() {
  return (
    <FeedStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.dusk900 }, headerTintColor: colors.parchment100 }}>
      <FeedStack.Screen
        name="FeedHome"
        options={{
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Image source={require("../assets/echotocrowd-icon.png")} style={{ width: 24, height: 24, borderRadius: 6 }} />
              <Text style={{ color: colors.parchment100, fontWeight: "700", fontSize: 17 }}>EchoToCrowd</Text>
            </View>
          ),
        }}
      >
        {({ navigation }: any) => (
          <FeedScreen
            onOpenBroadcast={(id) => navigation.navigate("BroadcastDetail", { broadcastId: id })}
            onOpenConversation={(conversationId) => navigation.navigate("ConversationDetail", { conversationId })}
          />
        )}
      </FeedStack.Screen>
      <FeedStack.Screen name="BroadcastDetail" options={{ title: "Reply" }}>
        {({ route, navigation }: any) => (
          <BroadcastDetailScreen broadcastId={route.params.broadcastId} onLeaveThread={() => navigation.goBack()} />
        )}
      </FeedStack.Screen>
      <FeedStack.Screen name="ConversationDetail" options={{ title: "Conversation" }}>
        {({ route }: any) => <ConversationDetailScreen conversationId={route.params.conversationId} />}
      </FeedStack.Screen>
    </FeedStack.Navigator>
  );
}

function ConversationsStackNavigator() {
  return (
    <ConversationsStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.dusk900 }, headerTintColor: colors.parchment100 }}>
      <ConversationsStack.Screen name="ConversationsHome" options={{ title: "Messages" }}>
        {({ navigation }: any) => (
          <ConversationsScreen onOpenConversation={(conversationId) => navigation.navigate("ConversationDetail", { conversationId })} />
        )}
      </ConversationsStack.Screen>
      <ConversationsStack.Screen name="ConversationDetail" options={{ title: "Conversation", headerBackTitle: "Back to messages" }}>
        {({ route }: any) => <ConversationDetailScreen conversationId={route.params.conversationId} />}
      </ConversationsStack.Screen>
    </ConversationsStack.Navigator>
  );
}

function ProfileStackNavigator({ onSignOut }: { onSignOut: () => void }) {
  return (
    <ProfileStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.dusk900 }, headerTintColor: colors.parchment100 }}>
      <ProfileStack.Screen name="ProfileHome" options={{ title: "Profile" }}>
        {({ navigation }: any) => (
          <ProfileScreen
            onSignedOut={onSignOut}
            onOpenFollowTags={() => navigation.navigate("FollowTags")}
            onOpenBlockedUsers={() => navigation.navigate("BlockedUsers")}
            onOpenAdminReports={() => navigation.navigate("AdminReports")}
          />
        )}
      </ProfileStack.Screen>
      <ProfileStack.Screen name="FollowTags" component={FollowTagsScreen} options={{ title: "Echo Tags" }} />
      <ProfileStack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ title: "Blocked users" }} />
      <ProfileStack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: "Admin reports" }} />
    </ProfileStack.Navigator>
  );
}

function AppTabs({ onSignOut }: { onSignOut: () => void }) {
  const [feedUnread, setFeedUnread] = useState(0);
  const [messageUnread, setMessageUnread] = useState(0);
  const [mentionUnread, setMentionUnread] = useState(0);

  useEffect(() => {
    let active = true;

    const loadCounts = async () => {
      try {
        const [feed, messages] = await Promise.all([
          apiFetch<UnreadCount>("/feed/unread-count"),
          apiFetch<UnreadCount>("/conversations/unread-count"),
        ]);
        if (!active) return;
        setFeedUnread(feed.count ?? 0);
        setMessageUnread(messages.count ?? 0);
        setMentionUnread(messages.mention_count ?? 0);
      } catch {
        if (!active) return;
        setFeedUnread(0);
        setMessageUnread(0);
        setMentionUnread(0);
      }
    };

    void loadCounts();
    const interval = setInterval(() => {
      void loadCounts();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.dusk900, borderTopColor: colors.dusk700 },
        tabBarActiveTintColor: colors.signal400,
        tabBarInactiveTintColor: colors.parchment500,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Feed: focused ? "radio" : "radio-outline",
            Broadcast: focused ? "megaphone" : "megaphone-outline",
            Messages: focused ? "chatbubbles" : "chatbubbles-outline",
            Profile: focused ? "person" : "person-outline",
          } as const;
          return <Ionicons name={icons[route.name as keyof typeof icons]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Feed" component={FeedStackNavigator} options={{ tabBarBadge: feedUnread > 0 ? feedUnread : undefined }} />
      <Tabs.Screen name="Broadcast">
        {({ navigation }: any) => <NewBroadcastScreen onPosted={() => navigation.navigate("Feed")} />}
      </Tabs.Screen>
      <Tabs.Screen
        name="Messages"
        component={ConversationsStackNavigator}
        options={{ tabBarBadge: mentionUnread > 0 ? "@" : messageUnread > 0 ? messageUnread : undefined }}
      />
      <Tabs.Screen name="Profile">{() => <ProfileStackNavigator onSignOut={onSignOut} />}</Tabs.Screen>
    </Tabs.Navigator>
  );
}

type AuthState = "loading" | "signed-out" | "needs-onboarding" | "signed-in";

export function RootNavigator() {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    const hasSession = await TokenStore.hasSession();
    if (!hasSession) {
      setAuthState("signed-out");
      return;
    }
    try {
      const user = await apiFetch<UserProfile>("/users/me");
      setAuthState(user.location_label ? "signed-in" : "needs-onboarding");
    } catch {
      setAuthState("signed-out");
    }
  }

  if (authState === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.dusk950, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.signal500} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {authState === "signed-out" && (
          <RootStack.Screen name="Login">
            {() => <LoginScreen onSignedIn={() => checkSession()} />}
          </RootStack.Screen>
        )}
        {authState === "needs-onboarding" && (
          <RootStack.Screen name="Onboarding">
            {() => <OnboardingScreen onDone={() => setAuthState("signed-in")} />}
          </RootStack.Screen>
        )}
        {authState === "signed-in" && (
          <RootStack.Screen name="App">
            {() => <AppTabs onSignOut={() => setAuthState("signed-out")} />}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
