import type { ConfigPlugin } from "@expo/config-plugins";
import type { getPrebuildConfigAsync } from "expo-desktop-prebuild-config";

/**
 * @see https://github.com/microsoft/react-native-test-app/blob/0951cf5a3727c01d2ef25540eb796eb56b14ae04/packages/app/scripts/config-plugins/plugins/withInternal.mjs#L9
 */
export const withInternal: ConfigPlugin<Internals> = (config, internals) => {
  // @ts-ignore TODO
  config._internal = {
    isDebug: false,
    // @ts-ignore TODO
    ...config._internal,
    ...internals,
  };
  return config;
};

type Internals = Omit<PrebuildOptions, "appJsonPath">;
type PrebuildOptions = {
  projectRoot: string;
} & Parameters<typeof getPrebuildConfigAsync>[1];
