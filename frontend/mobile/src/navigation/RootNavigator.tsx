import { useEffect, useRef, useState } from "react";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, AppState, Image, Linking, Text, View } from "react-native";

import { TokenStore } from "../helpers/secureStore";
import { apiFetch } from "../helpers/api";
import { syncLocationIfMoved } from "../helpers/locationSync";
import { ViewerUserProvider } from "../helpers/viewerUser";
import { parseJoinToken, setPendingJoinToken, takePendingJoinToken } from "../helpers/joinLink";
import { LoginScreen } from "../screens/LoginScreen";
import { OnboardingScreen, TermsStep } from "../screens/OnboardingScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { NewBroadcastScreen } from "../screens/NewBroadcastScreen";
import { BroadcastDetailScreen } from "../screens/BroadcastDetailScreen";
import { ConversationsScreen } from "../screens/ConversationsScreen";
import { ConversationDetailScreen } from "../screens/ConversationDetailScreen";
import { GroupsScreen } from "../screens/GroupsScreen";
import { NewGroupScreen } from "../screens/NewGroupScreen";
import { JoinGroupScreen } from "../screens/JoinGroupScreen";
import { FollowTagsScreen } from "../screens/FollowTagsScreen";
import { BlockedUsersScreen } from "../screens/BlockedUsersScreen";
import { AdminReportsScreen } from "../screens/AdminReportsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { colors } from "../theme/tokens";
import type { UnreadCount, UserProfile } from "../types/api";
import { navigationRef, openJoinToken } from "./rootNavigation";

const RootStack = createNativeStackNavigator();
const FeedStack = createNativeStackNavigator();
const ConversationsStack = createNativeStackNavigator();
const GroupsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const BroadcastStack = createNativeStackNavigator();
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

function GroupsStackNavigator() {
  return (
    <GroupsStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.dusk900 }, headerTintColor: colors.parchment100 }}>
      <GroupsStack.Screen name="GroupsHome" options={{ title: "Groups" }}>
        {({ navigation }: any) => (
          <GroupsScreen
            onOpenConversation={(conversationId) => navigation.navigate("ConversationDetail", { conversationId })}
            onCreateGroup={() => navigation.navigate("NewGroup")}
          />
        )}
      </GroupsStack.Screen>
      <GroupsStack.Screen name="NewGroup" options={{ title: "New group" }}>
        {({ navigation }: any) => (
          <NewGroupScreen onDone={(conversationId) => navigation.replace("ConversationDetail", { conversationId })} />
        )}
      </GroupsStack.Screen>
      <GroupsStack.Screen name="JoinGroup" options={{ title: "Join group" }}>
        {({ route, navigation }: any) => (
          <JoinGroupScreen
            token={route.params.token}
            onJoined={(conversationId) => navigation.replace("ConversationDetail", { conversationId })}
          />
        )}
      </GroupsStack.Screen>
      <GroupsStack.Screen name="ConversationDetail" options={{ title: "Conversation", headerBackTitle: "Back to groups" }}>
        {({ route }: any) => <ConversationDetailScreen conversationId={route.params.conversationId} />}
      </GroupsStack.Screen>
    </GroupsStack.Navigator>
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

function BroadcastStackNavigator() {
  return (
    <BroadcastStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.dusk900 }, headerTintColor: colors.parchment100 }}>
      <BroadcastStack.Screen name="NewBroadcast" options={{ title: "New broadcast" }}>
        {({ navigation }: any) => <NewBroadcastScreen onPosted={() => navigation.getParent()?.navigate("Feed")} />}
      </BroadcastStack.Screen>
    </BroadcastStack.Navigator>
  );
}

function SignedInApp({ onSignOut }: { onSignOut: () => void }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let active = true;

    async function syncFrom(registered: { latitude: number | null; longitude: number | null }) {
      const profile = await syncLocationIfMoved(registered);
      if (active && profile) setUser(profile);
    }

    async function start() {
      try {
        const me = await apiFetch<UserProfile>("/users/me");
        if (!active) return;
        setUser(me);
        userRef.current = me;
        await syncFrom({ latitude: me.latitude ?? null, longitude: me.longitude ?? null });
      } catch {
        // Stay signed in; the feed can still load its own profile.
      }
    }

    void start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const current = userRef.current;
      void syncFrom({ latitude: current?.latitude ?? null, longitude: current?.longitude ?? null });
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <ViewerUserProvider value={{ user, setUser }}>
      <AppTabs onSignOut={onSignOut} />
    </ViewerUserProvider>
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
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: colors.dusk900, borderTopColor: colors.dusk700 },
        tabBarActiveTintColor: colors.signal400,
        tabBarInactiveTintColor: colors.parchment500,
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Feed: focused ? "radio" : "radio-outline",
            Broadcast: focused ? "megaphone" : "megaphone-outline",
            Messages: focused ? "chatbubbles" : "chatbubbles-outline",
            Groups: focused ? "people" : "people-outline",
            Profile: focused ? "person" : "person-outline",
          } as const;
          return <Ionicons name={icons[route.name as keyof typeof icons]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Feed" component={FeedStackNavigator} options={{ tabBarBadge: feedUnread > 0 ? feedUnread : undefined }} />
      <Tabs.Screen name="Broadcast" component={BroadcastStackNavigator} />
      <Tabs.Screen
        name="Messages"
        component={ConversationsStackNavigator}
        options={{ tabBarBadge: mentionUnread > 0 ? "@" : messageUnread > 0 ? messageUnread : undefined }}
      />
      <Tabs.Screen name="Groups" component={GroupsStackNavigator} />
      <Tabs.Screen name="Profile">{() => <ProfileStackNavigator onSignOut={onSignOut} />}</Tabs.Screen>
    </Tabs.Navigator>
  );
}

type AuthState = "loading" | "signed-out" | "needs-onboarding" | "needs-terms" | "signed-in";

function flushPendingJoin(signedIn: boolean) {
  if (!signedIn) return;
  const token = takePendingJoinToken();
  if (token) openJoinToken(token);
}

export function RootNavigator() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const authStateRef = useRef(authState);
  authStateRef.current = authState;

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      const token = parseJoinToken(url ?? "");
      if (!token) return;
      if (authStateRef.current === "signed-in") {
        if (!openJoinToken(token)) setPendingJoinToken(token);
      } else {
        setPendingJoinToken(token);
      }
    });
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const token = parseJoinToken(url);
      if (!token) return;
      if (authStateRef.current === "signed-in") {
        if (!openJoinToken(token)) setPendingJoinToken(token);
      } else {
        setPendingJoinToken(token);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (authState !== "signed-in" || !navigationRef.isReady()) return;
    flushPendingJoin(true);
  }, [authState]);

  async function checkSession() {
    const hasSession = await TokenStore.hasSession();
    if (!hasSession) {
      setAuthState("signed-out");
      return;
    }
    try {
      const user = await apiFetch<UserProfile>("/users/me");
      if (!user.location_label) setAuthState("needs-onboarding");
      else if (!user.terms_accepted) setAuthState("needs-terms");
      else setAuthState("signed-in");
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
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => flushPendingJoin(authStateRef.current === "signed-in")}
    >
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
        {authState === "needs-terms" && (
          <RootStack.Screen name="Terms">
            {() => (
              <View style={{ flex: 1, backgroundColor: colors.dusk950, justifyContent: "center", padding: 24 }}>
                <TermsStep onAccepted={() => setAuthState("signed-in")} />
              </View>
            )}
          </RootStack.Screen>
        )}
        {authState === "signed-in" && (
          <RootStack.Screen name="App">
            {() => <SignedInApp onSignOut={() => setAuthState("signed-out")} />}
          </RootStack.Screen>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
