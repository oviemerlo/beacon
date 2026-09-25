import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { TokenStore } from "./secureStore";
import { apiBaseUrl } from "./api";

const API_URL = apiBaseUrl();
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID, // MUST be Web type, not Android
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  offlineAccess: true,
});

function logAuth(stage: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  if (details) {
    console.log(`[auth] ${stage}`, details);
    return;
  }
  console.log(`[auth] ${stage}`);
}

async function exchangeGoogleIdTokenWithBackend(idToken: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/google/token-exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
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
    logAuth("google:backend-exchange:error", { status: res.status });
    throw new Error(`Backend rejected Google sign-in (${res.status})`);
  }

  const { access_token, refresh_token } = await res.json();
  await TokenStore.save(access_token, refresh_token);
  logAuth("google:success");
}

export async function signInWithGoogle(): Promise<void> {
  try {
    logAuth("google:start", { platform: Platform.OS });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();

    const idToken = userInfo.data?.idToken;
    logAuth("google:id-token", { present: Boolean(idToken) });

    if (!idToken) throw new Error("Google idToken missing - webClientId is wrong type");

    await exchangeGoogleIdTokenWithBackend(idToken);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    logAuth("google:native-error", {
      code: err?.code,
      cancelled: err?.code === statusCodes.SIGN_IN_CANCELLED,
    });
    throw e;
  }
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
      authorization_code: credential.authorizationCode,
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