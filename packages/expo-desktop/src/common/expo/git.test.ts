import spawnAsync from "@expo/spawn-async";
import prompts from "prompts";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { initGitRepoAsync } from "./git.ts";

vi.mock("@expo/spawn-async", () => ({ default: vi.fn() }));
vi.mock("prompts", () => ({ default: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("CI", "false");
  vi.mocked(spawnAsync).mockResolvedValue({} as Awaited<ReturnType<typeof spawnAsync>>);
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

test.each([{ yes: true, ci: false }, { yes: false, ci: true }])(
  "skips Git initialization inside an existing repository without prompting (%j)",
  async ({ yes, ci }) => {
    vi.stubEnv("CI", String(ci));

    await expect(initGitRepoAsync("/app", { yes })).resolves.toBe(false);

    expect(prompts).not.toHaveBeenCalled();
    expect(vi.mocked(spawnAsync).mock.calls.map(([, args]) => args)).toEqual([
      ["--version"],
      ["rev-parse", "--is-inside-work-tree"],
    ]);
  },
);

test.each([true, undefined])("defaults to skipping an existing repository (answer: %s)", async (answer) => {
  vi.mocked(prompts).mockResolvedValue({ answer });

  await expect(initGitRepoAsync("/app")).resolves.toBe(false);

  expect(prompts).toHaveBeenCalledWith(expect.objectContaining({ initial: true }));
  expect(spawnAsync).toHaveBeenCalledTimes(2);
});
