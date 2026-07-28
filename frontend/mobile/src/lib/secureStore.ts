import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "beacon_access_token";
const REFRESH_KEY = "beacon_refresh_token";

export const TokenStore = {
  async save(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  },
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async hasSession() {
    return (await SecureStore.getItemAsync(ACCESS_KEY)) !== null;
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
