# How I generated this React Native Windows native module

## Generating the necessary demo app

First, I created an Expo Desktop app (this is necessary because `react-native init-windows` does not work standalone and must have a ready-installed `react-native` + `react-native-windows` project in order to run its commands):

```sh
pnpm dlx expo-desktop@latest create-app --filesafe-name demo --display-name "Expo Desktop Demo App" --rdns uk.co.birchlabs.expo-desktop-demo
```

## Generating the library itself

Next, I generated a library alongside that app:

```sh
cd demo
pnpm exec react-native init-windows --logging --overwrite --template cpp-lib --name ExpoDesktopStubs
```

```diff
  .
  ├── App.tsx
  ├── NuGet.config
  ├── android
  ├── app.json
  ├── assets
  ├── babel.config.js
  ├── index.ts
  ├── ios
  ├── jest.config.windows.js
  ├── macos
  ├── metro.config.js
  ├── node_modules
  ├── package.json    # `codegenConfig` field added
  ├── tsconfig.json
  └── windows
+     ├── ExperimentalFeatures.props
+     ├── ExpoDesktopStubs
+     ├── ExpoDesktopStubs.sln
+     └── NuGet.config
```

## Transplanting the library

I moved those newly-created files into a new location, `packages/expo-desktop-stubs`:

```
.
├── package.json
├── tsconfig.json
└── windows
    ├── ExperimentalFeatures.props
    ├── ExpoDesktopStubs
    ├── ExpoDesktopStubs.sln
    └── NuGet.config
```

For the package.json, I made sure to cut-and-paste the `codegenConfig` that was previously added to `apps/demo/package.json`:

```json
  "codegenConfig": {
    "windows": {
      "namespace": "ExpoDesktopStubsCodegen",
      "outputDirectory": "windows/ExpoDesktopStubs/codegen",
      "separateDataTypes": true
    }
  }
```
