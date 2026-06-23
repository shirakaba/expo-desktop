import GetEnv from "getenv";

const { boolish } = GetEnv;

class Env {
  /** Enable debug logging */
  get EXPO_DEBUG() {
    return boolish("EXPO_DEBUG", false);
  }
  /** Enable the beta version of Expo (TODO: Should this just be in the beta version of expo releases?) */
  get EXPO_BETA() {
    return boolish("EXPO_BETA", false);
  }
  /** Is running in non-interactive CI mode */
  get CI() {
    return boolish("CI", false);
  }
  /** Disable all API caches. Does not disable bundler caches. */
  get EXPO_NO_CACHE() {
    return boolish("EXPO_NO_CACHE", false);
  }
  /** Disable telemetry (analytics) */
  get EXPO_NO_TELEMETRY() {
    return boolish("EXPO_NO_TELEMETRY", false);
  }

  // https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/utils/env.ts

  /** Skip warning users about a dirty git status */
  get EXPO_NO_GIT_STATUS() {
    return boolish("EXPO_NO_GIT_STATUS", true);
  }
}

export const env = new Env();
