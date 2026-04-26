import { expect, test } from "bun:test";

import { badName } from "./fixtures/configs.ts";

test("performs pattern validation on strings", () => {
  expect(badName.alphanumeric).toThrow();
  expect(badName.reverse_dns).toThrow();
});
