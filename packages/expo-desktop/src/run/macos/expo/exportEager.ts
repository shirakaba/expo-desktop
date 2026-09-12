import { env } from "../../../common/expo/env.ts";
import { debugEvent } from "./events.ts";
import { exportEmbedInternalAsync } from "./exportEmbed.ts";
import { getExportEmbedOptionsKey, resolveEagerOptionsAsync } from "./resolveEagerOptions.ts";

export async function exportEagerAsync(
  projectRoot: string,
  {
    dev,
    platform,
    // We default to resetting the cache in non-CI environments since prebundling overwrites the cache reset later.
    resetCache = !env.CI,
    assetsDest,
    bundleOutput,
  }: {
    assetsDest?: string;
    bundleOutput?: string;
    dev: boolean;
    platform: string;
    resetCache?: boolean;
  },
) {
  const options = await resolveEagerOptionsAsync(projectRoot, {
    dev,
    platform,
    resetCache,
    assetsDest,
    bundleOutput,
  });

  debugEvent("eager:starting", { bundleOutput: options.bundleOutput });
  await exportEmbedInternalAsync(projectRoot, options);

  return { options, key: getExportEmbedOptionsKey(options) };
}
