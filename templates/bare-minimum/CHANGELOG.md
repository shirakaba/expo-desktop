# expo-desktop-template-bare-minimum

## 54.81.7

### Patch Changes

- 4b80a16: Adopt the iOS scene lifecycle so apps built with the iOS 27 SDK can launch. Create the React Native window from the scene, preserve cold-start links, and forward scene events to AppDelegate overrides and Expo subscribers. Preserve upstream link delivery fallbacks and prevent duplicate React Native URL events.

  The standard SDK 54 templates do not depend on expo-dev-client or expo-dev-launcher. This backport adds no dependency patches or patch-registration requirements.

- f19cd7c: Skip dependency and CocoaPods installation when creating an app inside a monorepo, and link to the manual integration guide. Configure only the created app, and use native dependency patches with npm 12+, pnpm, Yarn 2+, and Bun.

## 54.81.6

### Patch Changes

- Use real node module resolution to get react-native-macos path in Podfile
- expo-desktop@1.0.6

## 54.81.5

### Patch Changes

- Updated dependencies [814a5c7]
- Updated dependencies [e767f5f]
  - expo-desktop@1.0.5

## 54.81.4

### Patch Changes

- Updated dependencies [c7cf09b]
- Updated dependencies [cfba0ef]
  - expo-desktop@1.0.4

## 54.81.3

### Patch Changes

- expo-desktop@1.0.3

## 54.81.2

### Patch Changes

- Republish post-monorepo restructure
- Updated dependencies
  - expo-desktop@1.0.1
  - expo-desktop-stubs@54.0.15

## 54.81.1

### Patch Changes

- d7461ef: Use expo-desktop-metro-config instead of unmaintained metro.config.js
- 457c3b8: Prevent rnc-cli from trying to autolink bare-minimum
- c50a351: Stop using workspace references when publishing
- c50a351: Fixed failing Windows release-mode builds by correcting `config.resolver.platforms`.
- 87e2c95: Update templates to simplify dependency tree
- 3e1987a: Update the Podfile to raise the the minimum deployment target to support Xcode 27 (required for macOS 27).
- c50a351: Add provenance to templates, to enable Trusted Publishing
- c50a351: Update to latest RNW patch to use VS 2026 without problem
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

## 54.81.1-beta.8

### Patch Changes

- Stop using workspace references when publishing

## 54.81.1-beta.7

### Patch Changes

- Update templates to simplify dependency tree
- Updated dependencies
  - expo-desktop@1.0.0-beta.7

## 54.81.1-beta.6

### Patch Changes

- Update the Podfile to raise the the minimum deployment target to support Xcode 27 (required for macOS 27).

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

- 8b39c1b: Prevent rnc-cli from trying to autolink bare-minimum
- Updated dependencies [8b39c1b]
  - expo-desktop-modules-core@54.0.14-beta.0
  - expo-desktop-stubs@54.0.14-beta.0

## 54.81.1-beta.1

### Patch Changes

- Add provenance to templates, to enable Trusted Publishing

## 54.81.1-beta.0

### Patch Changes

- Updated dependencies [98a6c4a]
  - expo-desktop-prebuild-config@1.1.0-beta.0
