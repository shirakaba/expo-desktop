import { defineAppConfig } from "../define-config.ts";

export const defaultConfig = defineAppConfig({
  name: {
    alphanumeric: "MyApp123",
    display_name: "My App 123",
    reverse_dns: "com.example.my-app-123",
  },
});

export const badName = {
  alphanumeric: () =>
    defineAppConfig({
      name: {
        ...defaultConfig.name,
        alphanumeric: "My App",
      },
    }),
  reverse_dns: () =>
    defineAppConfig({
      name: {
        ...defaultConfig.name,
        reverse_dns: "123com",
      },
    }),
};
