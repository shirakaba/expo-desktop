import { expect, test } from "vitest";

import { startBundlerAsync } from "./start-bundler.ts";

test("headless mode represents the server without starting another Metro process", async () => {
  const manager = await startBundlerAsync("/tmp/project-without-expo-cli", {
    port: 8081,
    headless: true,
    mode: "development",
  });

  await expect(manager.stopAsync()).resolves.toBeUndefined();
});
