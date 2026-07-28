import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { TokenStore } from "./secureStore";

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

/**
 * Runs Google Sign-In on-device to get an ID token, then hands it to the
 * backend's POST /auth/google/token-exchange — the native-app path the
 * backend scaffold already exposes (see beacon-backend/app/api/routes/auth.py).
 * The web app uses the redirect-based /auth/google/login flow instead;
 * both land on the same upsert logic server-side.
 *
 * Uses a direct app-scheme redirect (beacon://) rather than the deprecated
 * auth.expo.io proxy — see CVE-2023-28131. Requires a dev build, not Expo Go,
 * since Expo Go can't register the custom scheme.
 */
export async function signInWithGoogle(): Promise<void> {
  const clientId = Platform.OS === "ios" ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      Platform.OS === "ios"
        ? "Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in mobile/.env"
        : "Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env"
    );
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "beacon" });

  // Random nonce for the id_token flow, from a CSPRNG (not Math.random()).
  const nonceBytes = await Crypto.getRandomBytesAsync(16);
  const nonce = Array.from(nonceBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ["openid", "profile", "email"],
    redirectUri,
    responseType: AuthSession.ResponseType.IdToken,
    usePKCE: false,
    extraParams: {
      nonce,
      prompt: "select_account",
    },
  });

  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  };
  const result = await request.promptAsync(discovery);

  const idToken = result.type === "success" ? (result.params as any).id_token : undefined;
  if (!idToken) throw new Error("Google sign-in was cancelled or failed");

  const res = await fetch(`${API_URL}/auth/google/token-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) throw new Error("Backend rejected Google sign-in");

  const { access_token, refresh_token } = await res.json();
  await TokenStore.save(access_token, refresh_token);
}

/** iOS only — the Apple button is conditionally rendered in LoginScreen. */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
  });

  if (!credential.identityToken) throw new Error("Apple sign-in didn't return an identity token");

  // Apple only sends fullName on the FIRST authorization ever — capture and
  // forward it now, since it won't be sent again on subsequent logins.
  const fullName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ")
    : undefined;

  const res = await fetch(`${API_URL}/auth/apple/token-exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity_token: credential.identityToken,
      ...(fullName ? { full_name: fullName } : {}),
    }),
  });
  if (!res.ok) throw new Error("Backend rejected the Apple sign-in");

  const { access_token, refresh_token } = await res.json();
  await TokenStore.save(access_token, refresh_token);
}

export async function signOut(): Promise<void> {
  await TokenStore.clear();
}