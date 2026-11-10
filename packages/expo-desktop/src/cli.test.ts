import { runCommand, runMain } from "citty";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { runMacosAsync } from "./run/macos/runMacosAsync.ts";
import { runWindowsAsync } from "./run/windows/runWindowsAsync.ts";

vi.mock("citty", async (importOriginal) => ({
  ...(await importOriginal<typeof import("citty")>()),
  runMain: vi.fn(),
}));
vi.mock("@clack/prompts", () => ({ log: { info: vi.fn() } }));
vi.mock("./run/macos/runMacosAsync.ts", () => ({ runMacosAsync: vi.fn() }));
vi.mock("./run/windows/runWindowsAsync.ts", () => ({ runWindowsAsync: vi.fn() }));

beforeAll(async () => {
  await import("./cli.ts");
});

beforeEach(() => {
  vi.mocked(runMacosAsync).mockClear();
  vi.mocked(runWindowsAsync).mockClear();
});

describe.each([
  { platform: "macos", run: vi.mocked(runMacosAsync) },
  { platform: "windows", run: vi.mocked(runWindowsAsync) },
])("run $platform", ({ platform, run }) => {
  test.each([
    { configuration: undefined, flags: [] },
    { configuration: "Debug", flags: ["--configuration", "Debug"] },
    { configuration: "Release", flags: ["--configuration", "Release"] },
  ])(
    "preserves configuration=$configuration until option resolution",
    async ({ configuration, flags }) => {
      const [main] = vi.mocked(runMain).mock.calls[0]!;

      await runCommand(main, { rawArgs: ["run", platform, ...flags] });

      await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
      expect(run.mock.calls[0]![1]).toMatchObject({ bundler: true });
      expect(run.mock.calls[0]![1].configuration).toBe(configuration);
    },
  );

  test.each([
    { configuration: undefined, flags: [] },
    { configuration: "Debug", flags: ["--configuration", "Debug"] },
    { configuration: "Release", flags: ["--configuration", "Release"] },
  ])(
    "passes --no-bundler with configuration=$configuration to option resolution",
    async ({ configuration, flags }) => {
      const [main] = vi.mocked(runMain).mock.calls[0]!;

      await runCommand(main, { rawArgs: ["run", platform, "--no-bundler", ...flags] });

      await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
      expect(run.mock.calls[0]![1]).toMatchObject({ bundler: false });
      expect(run.mock.calls[0]![1].configuration).toBe(configuration);
    },
  );
});
