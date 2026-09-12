import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { TokenStore } from "./secureStore";
import { apiBaseUrl } from "./api";

const API_URL = apiBaseUrl();
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
console.log("[auth] configure-webClientId", GOOGLE_WEB_CLIENT_ID);

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID, // MUST be Web type, not Android
  offlineAccess: true,
});

function logAuth(stage: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[auth] ${stage}`, details);
    return;
  }
  console.log(`[auth] ${stage}`);
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

export async function signInWithGoogle(): Promise<void> {
  try {
    console.log("[auth] google:start", {
      platform: Platform.OS,
      webClientIdPrefix: GOOGLE_WEB_CLIENT_ID?.slice(0, 25),
    });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    console.log("[auth] google:raw-result", JSON.stringify(userInfo, null, 2));

    const idToken = userInfo.data?.idToken;
    console.log("[auth] google:id-token", idToken ? "received" : "MISSING");

    if (!idToken) throw new Error("Google idToken missing - webClientId is wrong type");

    await exchangeGoogleIdTokenWithBackend(idToken);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    console.log("[auth] google:native-error", {
      code: err?.code,
      message: err?.message,
      cancelled: err?.code === statusCodes.SIGN_IN_CANCELLED,
      full: JSON.stringify(e, null, 2),
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