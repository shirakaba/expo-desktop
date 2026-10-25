# expo-desktop-template-blank-typescript

## 55.83.10

### Patch Changes

- expo-desktop@1.0.6

## 55.83.9

### Patch Changes

- Updated dependencies [9e34c4d]
- Updated dependencies [3829af5]
  - expo-desktop@1.0.5

## 55.83.8

### Patch Changes

- 747fff7: Pin the Windows template to Hermes 0.0.0-2608.12001-35d34796 to fix ARM64 reload and runtime teardown crashes with RNW 0.83.2, retaining the precompiled RNW NuGet DLL. Existing apps should regenerate their Windows project or set HermesVersion in windows/ExperimentalFeatures.props, then restore NuGet dependencies and rebuild.
- 971907f: Support REACT_EAGER_TURBO_MODULE on React Native Windows 0.83 using the stock NuGet DLL. Collect eager modules across native packages and initialize them synchronously before the application bundle, including on reload, so Expo's existing REACT_INIT runtime installer can run without a JavaScript installModules workaround. Regenerate the Windows project with prebuild to install the startup hook.
- Updated dependencies [971907f]
  - expo-desktop-modules-core@55.0.2
  - expo-desktop-stubs@55.0.2

## 55.83.7

### Patch Changes

- Updated dependencies [7d4d460]
- Updated dependencies [a25d968]
- Updated dependencies [b3dbf03]
  - expo-desktop-modules-core@55.0.1
  - expo-desktop@1.0.4
  - expo-desktop-stubs@55.0.1

## 55.83.6

### Patch Changes

- b9f54ed: Provide the missing @react-native-windows/find-dotnet-tools dependency required
  by react-native-windows@0.83.2 in both templates.

  In blank-typescript, apply React Native Windows PR #16430 during postinstall
  using patch-package. Backport lazy PowerShell discovery to the
  @react-native-windows/cli@0.83.2 dependency of react-native-windows@0.83.2, so
  loading its configuration does not require Windows build tools on macOS.

  Upstream: https://github.com/microsoft/react-native-windows/pull/16430

## 55.83.5

### Patch Changes

- e769c77: Exclude the React Native Windows host package from Expo autolinking. Loading its
  Windows CLI during Apple or Android autolinking can fail on missing Windows
  tooling, preventing CocoaPods installation in freshly created apps. Windows
  continues to use the React Native Windows CLI for autolinking.
- expo-desktop@1.0.3

## 55.83.4

### Patch Changes

- Update Metro config from React Native v0.82 to v0.83

## 55.83.3

### Patch Changes

- expo-desktop@1.0.2

## 55.83.2

### Patch Changes

- Update Metro config to SDK 55

## 55.83.1

### Patch Changes

- Updated dependencies
  - expo-desktop-modules-core@55.0.0

## 54.81.2

### Patch Changes

- Republish post-monorepo restructure
- Updated dependencies
  - expo-desktop@1.0.1
  - expo-desktop-stubs@54.0.15

## 54.81.1

### Patch Changes

- d7461ef: Use expo-desktop-metro-config instead of unmaintained metro.config.js
- c50a351: Stop using workspace references when publishing
- c50a351: Fixed failing Windows release-mode builds by correcting `config.resolver.platforms`.
- 87e2c95: Update templates to simplify dependency tree
- c50a351: Add provenance to templates, to enable Trusted Publishing
- c50a351: Update to latest RNW patch to use VS 2026 without problem
- 457c3b8: Move bare-minimum to devDependencies
- Updated dependencies [c23aaeb]
- Updated dependencies [9b46926]
- Updated dependencies [74d18f7]
- Updated dependencies [6a67a9e]
- Updated dependencies [1e7f940]
- Updated dependencies [9b46926]
- Updated dependencies [69347ea]
- Updated dependencies [c5ccb0e]
- Updated dependencies [87e2c95]
- Updated dependencies [98a6c4a]
- Updated dependencies [a48ce60]
- Updated dependencies [7e02260]
- Updated dependencies [6117a5e]
- Updated dependencies [7bf7f28]
- Updated dependencies [457c3b8]
- Updated dependencies [4a985b1]
- Updated dependencies [74590b5]
- Updated dependencies [3e1987a]
  - expo-desktop@1.0.0
  - expo-desktop-modules-core@54.0.14
  - expo-desktop-stubs@54.0.14

## 54.81.1-beta.7

### Patch Changes

- Stop using workspace references when publishing

## 54.81.1-beta.6

### Patch Changes

- Update templates to simplify dependency tree
- Updated dependencies
  - expo-desktop@1.0.0-beta.7

## 54.81.1-beta.5

### Patch Changes

- Use expo-desktop-metro-config instead of unmaintained metro.config.js

## 54.81.1-beta.4

### Patch Changes

- Fixed failing Windows release-mode builds by correcting `config.resolver.platforms`.

## 54.81.1-beta.3

### Patch Changes

- Update to latest RNW patch to use VS 2026 without problem

## 54.81.1-beta.2

### Patch Changes

- 8b39c1b: Move bare-minimum to devDependencies
- Updated dependencies [8b39c1b]
  - expo-desktop-modules-core@54.0.14-beta.0
  - expo-desktop-stubs@54.0.14-beta.0

## 54.81.1-beta.1

### Patch Changes

- Add provenance to templates, to enable Trusted Publishing
- Updated dependencies
  - expo-desktop-template-bare-minimum@54.81.1-beta.1

## 54.81.1-beta.0

### Patch Changes

- Updated dependencies [98a6c4a]
  - expo-desktop-prebuild-config@1.1.0-beta.0
  - expo-desktop-template-bare-minimum@54.81.1-beta.0
