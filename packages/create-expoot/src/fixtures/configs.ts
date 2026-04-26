import { defineConfig } from "../define-config.ts";

export const defaultConfig = defineConfig({
  name: {
    alphanumeric: "MyApp123",
    display_name: "My App 123",
    reverse_dns: "com.example.my-app-123",
  },
});

export const badName = {
  alphanumeric: () =>
    defineConfig({
      name: {
        ...defaultConfig.name,
        alphanumeric: "My App",
      },
    }),
  reverse_dns: () =>
    defineConfig({
      name: {
        ...defaultConfig.name,
        reverse_dns: "123com",
      },
    }),
};
