import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { TokenStore } from "./secureStore";
import { apiBaseUrl } from "./api";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

WebBrowser.maybeCompleteAuthSession();

const API_URL = apiBaseUrl();
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

if (Platform.OS === "android") {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID, // Android uses the Web client's ID to get a verifiable idToken
  });
}

function logAuth(stage: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[auth] ${stage}`, details);
    return;
  }
  console.log(`[auth] ${stage}`);
}

function getGoogleIosRedirectUri(clientId: string): string {
  const suffix = ".apps.googleusercontent.com";
  if (!clientId.endsWith(suffix)) {
    throw new Error("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not a valid Google iOS client ID");
  }
  const clientPrefix = clientId.slice(0, -suffix.length);
  return `com.googleusercontent.apps.${clientPrefix}:/oauthredirect`;
}

async function exchangeGoogleIdTokenWithBackend(idToken: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/google/token-exchange?id_token=${encodeURIComponent(idToken)}`, {
      method: "POST",
    });
  } catch {
    logAuth("google:backend-exchange:network-error", { apiUrl: API_URL });
    throw new Error(
      Platform.OS === "android"
        ? `Couldn't reach the API at ${API_URL}. On the Android emulator the host machine is http://10.0.2.2:8000`
        : `Couldn't reach the API at ${API_URL}. On the iOS simulator use http://127.0.0.1:8000`
    );
  }
  logAuth("google:backend-exchange:response", { ok: res.ok, status: res.status, apiUrl: API_URL });
  if (!res.ok) {
    const text = await res.text();
    logAuth("google:backend-exchange:error", { body: text });
    throw new Error(`Backend rejected Google sign-in: ${text}`);
  }

  const { access_token, refresh_token } = await res.json();
  await TokenStore.save(access_token, refresh_token);
  logAuth("google:success");
}

/**
 * Android: uses the native Google Sign-In SDK (Play Services) instead of a
 * browser redirect. Google disallows custom URI scheme redirects for new
 * Android OAuth clients by default, so the browser-based AuthSession flow
 * below (used for iOS/web) isn't viable here — this is Google's recommended
 * path for Android instead.
 */
async function signInWithGoogleAndroid(): Promise<void> {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;
  if (!idToken) throw new Error("Google sign-in was cancelled or failed");
  logAuth("google:id-token:received");

  await exchangeGoogleIdTokenWithBackend(idToken);
}

/**
 * iOS / web: browser-based AuthSession authorization code + PKCE flow,
 * exchanging the code with Google directly, then handing the resulting
 * ID token to the backend's POST /auth/google/token-exchange — the
 * native-app path the backend scaffold already exposes (see
 * beacon-backend/app/api/routes/auth.py). The web app itself uses the
 * redirect-based /auth/google/login flow instead; both land on the same
 * upsert logic server-side.
 *
 * Requires a dev build, not Expo Go, since Expo Go can't register custom
 * schemes.
 */
async function signInWithGoogleAuthSession(): Promise<void> {
  const clientId = Platform.OS === "ios" ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      Platform.OS === "ios"
        ? "Missing EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in mobile/.env"
        : "Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env"
    );
  }

  const redirectUri =
    Platform.OS === "ios"
      ? getGoogleIosRedirectUri(clientId)
      : AuthSession.makeRedirectUri({ scheme: "echotocrowd" });
  logAuth("google:redirect-uri", { redirectUri, clientId });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ["openid", "profile", "email"],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      prompt: "select_account",
    },
  });

  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  };
  logAuth("google:prompt:start");
  const result = await request.promptAsync(discovery);
  logAuth("google:prompt:result", { type: result.type, params: result.type === "success" ? result.params : undefined });

  const code = result.type === "success" ? (result.params as any).code : undefined;
  if (!code) throw new Error("Google sign-in was cancelled or failed");

  const codeVerifier = (request as any).codeVerifier as string | undefined;
  if (!codeVerifier) throw new Error("Missing PKCE code_verifier for Google token exchange");

  const tokenExchangeRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });
  logAuth("google:token-exchange:response", { ok: tokenExchangeRes.ok, status: tokenExchangeRes.status });
  if (!tokenExchangeRes.ok) {
    const text = await tokenExchangeRes.text();
    logAuth("google:token-exchange:error", { body: text });
    throw new Error(`Google token exchange failed: ${text}`);
  }
  const tokenPayload = await tokenExchangeRes.json();
  const idToken = tokenPayload?.id_token as string | undefined;
  if (!idToken) throw new Error("Google sign-in was cancelled or failed");
  logAuth("google:id-token:received");

  await exchangeGoogleIdTokenWithBackend(idToken);
}

export async function signInWithGoogle(): Promise<void> {
  logAuth("google:start", { platform: Platform.OS });
  if (Platform.OS === "android") {
    await signInWithGoogleAndroid();
    return;
  }
  await signInWithGoogleAuthSession();
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