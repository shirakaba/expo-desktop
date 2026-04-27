import { expect, test } from "bun:test";

import { badName, defaultConfig } from "./fixtures/configs.ts";

test("performs pattern validation on strings", () => {
  expect(badName.alphanumeric).toThrow(/name\.alphanumeric must be only letters and digits 0-9/);
  expect(badName.reverse_dns).toThrow(/name\.reverse_dns must be matched by/);
});

test("fills in partial config", () => {
  const { react_native_version, android, ios, macos, windows } = defaultConfig;

  expect(react_native_version).toBe("0.82");

  expect(android.application_id).toBe("com.example.my_app_123");
  expect(android.package_namespace).toBe("com.example.my_app_123");
  expect(android.root_project_name).toBe("My App 123");

  expect(ios.bundle_display_name).toBe("My App 123");
  expect(ios.bundle_identifier).toBe("com.example.my-app-123");

  expect(macos.bundle_display_name).toBe("My App 123");
  expect(macos.bundle_identifier).toBe("com.example.my-app-123");

  expect(windows.display_name).toBe("My App 123");
  expect(windows.namespace).toBe("com.example.myapp123");
  expect(windows.project_name).toBe("MyApp123");
});
