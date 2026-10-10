# expo-desktop-template-bare-minimum

## 55.83.5

### Patch Changes

- 09d3912: Exclude the React Native Windows host package from Expo autolinking. Loading its
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
