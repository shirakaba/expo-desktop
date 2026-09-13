import GetEnv from "getenv";

const { boolish, int } = GetEnv;

class Env {
  /** The React Native Metro port that's baked into React Native scripts and tools. */
  get RCT_METRO_PORT() {
    return int("RCT_METRO_PORT", 0);
  }

  /** Enable profiling metrics */
  get EXPO_PROFILE() {
    return boolish("EXPO_PROFILE", false);
  }

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
  /** Is running under an end-to-end test harness. */
  get EXPO_E2E_TEST() {
    return boolish("EXPO_E2E_TEST", false);
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
