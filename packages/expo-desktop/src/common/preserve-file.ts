import fs from "node:fs/promises";

/**
 * Read the state of a file on first call of the generator, then run the
 * generator again to restore it back to that value that was read.
 */
export async function* preserveFile({
  filePath,
  enable,
}: {
  filePath: string;
  enable?: boolean | undefined;
}) {
  if (!enable) {
    return;
  }
  const fileBefore = await fs.readFile(filePath, "utf-8");
  yield;
  await fs.writeFile(filePath, fileBefore, "utf-8");
}
