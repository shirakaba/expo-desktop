# expo-desktop-prebuild-config

## 1.1.0-beta.0

### Minor Changes

- 98a6c4a: Implemented all the necessary prebuild config and config plugins for (re)generating React Native Windows apps from `app.json`, so the project and package GUIDs are now stable. The project files in the `windows` folder are now all based on the name `MyApp` (rather than the `"name"` field in `app.json`). Required fields in `app.json` are now enforced.

### Patch Changes

- Updated dependencies [98a6c4a]
  - expo-desktop-config-plugins@1.2.0-beta.0

## 1.0.20

### Patch Changes

- change devDev to dep
- Updated dependencies
  - expo-desktop-config-plugins@1.1.34

## 1.0.19

### Patch Changes

- Declare @expo/\* dependencies as direct dependencies rather than peerDependencies
- Updated dependencies
  - expo-desktop-config-plugins@1.1.33

## 1.0.18

### Patch Changes

- Fix dark mode styling in starter template on macOS; commit changes upon app creation; suppress library version warnings upon expo start.
- Updated dependencies
  - expo-desktop-config-plugins@1.1.32

## 1.0.17

### Patch Changes

- Fix react and react-native versions in the 0.81 starter project
- Updated dependencies
  - expo-desktop-config-plugins@1.1.31

## 1.0.16

### Patch Changes

- Improve handling of entrypoint in Windows projects, and stop create-expo-app jamming on nested git projects
- Updated dependencies
  - expo-desktop-config-plugins@1.1.30

## 1.0.15

### Patch Changes

- Fix ReactNativeWindowsDir resolution order
- Updated dependencies
  - expo-desktop-config-plugins@1.1.29

## 1.0.14

### Patch Changes

- Remove the need for expo-polyfill.windows.js
- Updated dependencies
  - expo-desktop-config-plugins@1.1.28

## 1.0.13

### Patch Changes

- Fix polyfill and resolution of ReactNativeDir and ReactNativeWindowsDir
- Updated dependencies
  - expo-desktop-config-plugins@1.1.27

## 1.0.12

### Patch Changes

- Re-release all
- Updated dependencies
  - expo-desktop-config-plugins@1.1.25

## 1.0.11

### Patch Changes

- regenerate lockfile
- Updated dependencies
  - expo-desktop-config-plugins@1.1.22

## 1.0.10

### Patch Changes

- republish all to check CI
- Updated dependencies
  - expo-desktop-config-plugins@1.1.21

## 1.0.9

### Patch Changes

- First publish with stubs and modules-core
- Updated dependencies
  - expo-desktop-config-plugins@1.1.20

## 1.0.8

### Patch Changes

- Support pnpm and Windows Config Plugins
- Updated dependencies
  - expo-desktop-config-plugins@1.1.19

## 1.0.7

### Patch Changes

- Iron out template support
- Updated dependencies
  - expo-desktop-config-plugins@1.1.18

## 1.0.6

### Patch Changes

- Release with WIP --template support
- Updated dependencies
  - expo-desktop-config-plugins@1.1.17

## 1.0.5

### Patch Changes

- Republish with pnpm to resolve workspaces/catalogs
- Updated dependencies
  - expo-desktop-config-plugins@1.1.16

## 1.0.4

### Patch Changes

- (CI-only change): Try again to push git tags when publishing packages.
- Updated dependencies
  - expo-desktop-config-plugins@1.1.15

## 1.0.3

### Patch Changes

- (CI-only change): Try pushing git tags along with package publishes.
- Updated dependencies
  - expo-desktop-config-plugins@1.1.14

## 1.0.2

### Patch Changes

- Fix publishing config (npm side) and republish

## 1.0.1

### Patch Changes

- 006f7eb: Config plugins that involve Xcode mods hopefully working now.
- Updated dependencies [006f7eb]
  - expo-desktop-config-plugins@1.1.13
