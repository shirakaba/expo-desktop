# Expo Desktop

This is a project to bring best-effort support for react-native-macos and react-native-windows to Expo in userland. It includes a CLI (analogous to `@expo/cli`), and ports of the CLI's internal logic like `@expo/config-plugins` and `@expo-prebuild-config` to support desktop platforms.

## The `expo-desktop` CLI

### `create-app` command

You can run this from source as follows (alter as appropriate):

```sh
cd packages/expo-desktop
npm_config_user_agent=bun node src/cli.ts create-app MyApp \
  --display-name "My App" \
  --rdns com.example.my-app-123 \
  --template ../../templates/blank-typescript/expo-desktop-template-blank-typescript-55.83.1.tgz
```

Do not create apps inside this monorepo. Use a scratch directory outside the monorepo (e.g. by changing `src/cli.ts` to an absolute path).

### `prebuild` command

You can run this from source as follows (alter as appropriate):

```sh
cd packages/expo-desktop
npm_config_user_agent=bun node src/cli.ts prebuild \
  --template ../../templates/bare-minimum/expo-desktop-template-bare-minimum-55.83.1.tgz
```

When focusing on macOS or Windows prebuilds, you can pass `--platform macos`, `--platform windows`, or `--platform desktop` to avoid having to unnecessarily wait to install the iOS CocoaPods.

## Coding style

Most of this codebase is a direct port of Expo's internals. Such files should remain line-for-line faithful with the original (except, where diverging for the sake of adding desktop support), to minimise differences from upstream.

However, for new code (or when explicitly requested), any functions that may throw errors or have semi-successful states should adopt the "never throw" philosophy, whereby you try-catch all throwing operations, give context along with errors, and properly convey any semi-successful state so that the consumer can decide what to do with it, rather than just swallowing the error and logging a message, or throwing an error to make it the consumer's problem:

```ts
async function readPackageJson(filePath: string): readPackageJsonResult {
  let file: string;
  try {
    file = await fs.readFile(filePath, "utf8");
  } catch (error) {
    return { type: "reject", subtype: "error reading file", error };
  }

  let json: unknown;
  try {
    json = JSON.parse(file);
  } catch (error) {
    return { type: "reject", subtype: "error parsing JSON", error };
  }

  if (typeof json !== "boolean") {
    return { type: "reject", subtype: "unexpected shape" };
  }

  return { type: "resolve", value: json };
}

type readPackageJsonResult =
  | { type: "resolve"; value: boolean }
  | { type: "reject"; subtype: "error reading file"; error: unknown }
  | { type: "reject"; subtype: "error parsing JSON"; error: unknown }
  | { type: "reject"; subtype: "unexpected shape" };
```

Consumers should then handle those cases exhaustively with `ts-pattern`'s `match()` utility (though `if` and `switch` can be acceptable when the code would benefit from control flow).
