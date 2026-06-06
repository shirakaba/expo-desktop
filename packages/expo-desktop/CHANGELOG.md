# expo-desktop

## 0.1.36

### Patch Changes

- Declare @expo/\* dependencies as direct dependencies rather than peerDependencies
- Updated dependencies
  - expo-desktop-config-plugins@1.1.33
  - expo-desktop-prebuild-config@1.0.19

## 0.1.35

### Patch Changes

- Fix dark mode styling in starter template on macOS; commit changes upon app creation; suppress library version warnings upon expo start.
- Updated dependencies
  - expo-desktop-config-plugins@1.1.32
  - expo-desktop-prebuild-config@1.0.18

## 0.1.34

### Patch Changes

- aceb2c8: adds support for yarn
- Fix react and react-native versions in the 0.81 starter project
- Updated dependencies
  - expo-desktop-config-plugins@1.1.31
  - expo-desktop-prebuild-config@1.0.17

## 0.1.33

### Patch Changes

- Improve handling of entrypoint in Windows projects, and stop create-expo-app jamming on nested git projects
- Updated dependencies
  - expo-desktop-config-plugins@1.1.30
  - expo-desktop-prebuild-config@1.0.16

## 0.1.32

### Patch Changes

- Fix ReactNativeWindowsDir resolution order
- Updated dependencies
  - expo-desktop-config-plugins@1.1.29
  - expo-desktop-prebuild-config@1.0.15

## 0.1.31

### Patch Changes

- Remove the need for expo-polyfill.windows.js
- Updated dependencies
  - expo-desktop-config-plugins@1.1.28
  - expo-desktop-prebuild-config@1.0.14

## 0.1.30

### Patch Changes

- Fix template strings in NuGet config

## 0.1.29

### Patch Changes

- Fix polyfill and resolution of ReactNativeDir and ReactNativeWindowsDir
- Updated dependencies
  - expo-desktop-config-plugins@1.1.27
  - expo-desktop-prebuild-config@1.0.13

## 0.1.28

### Patch Changes

- Re-release all
- Updated dependencies
  - expo-desktop-config-plugins@1.1.25
  - expo-desktop-prebuild-config@1.0.12

## 0.1.27

### Patch Changes

- Populate ReactNativeDir and ReactNativeWindowsDir correctly
- Updated dependencies
  - expo-desktop-config-plugins@1.1.24

## 0.1.26

### Patch Changes

- various fixes for creating a Windows project
- Updated dependencies
  - expo-desktop-config-plugins@1.1.23

## 0.1.25

### Patch Changes

- create-app now running to completion on Windows (tested with --local-dev using npm and app named "MyApp")

## 0.1.24

### Patch Changes

- Support naming app as MyApp and fix shell behaviour

## 0.1.23

### Patch Changes

- regenerate lockfile
- Updated dependencies
  - expo-desktop-config-plugins@1.1.22
  - expo-desktop-prebuild-config@1.0.11

## 0.1.22

### Patch Changes

- Use `shell: true` when spawning child processes

## 0.1.21

### Patch Changes

- republish all to check CI
- Updated dependencies
  - expo-desktop-config-plugins@1.1.21
  - expo-desktop-prebuild-config@1.0.10

## 0.1.20

### Patch Changes

- First publish with stubs and modules-core
- Updated dependencies
  - expo-desktop-config-plugins@1.1.20
  - expo-desktop-prebuild-config@1.0.9

## 0.1.19

### Patch Changes

- Support pnpm and Windows Config Plugins
- Updated dependencies
  - expo-desktop-config-plugins@1.1.19
  - expo-desktop-prebuild-config@1.0.8

## 0.1.18

### Patch Changes

- Iron out template support
- Updated dependencies
  - expo-desktop-config-plugins@1.1.18
  - expo-desktop-prebuild-config@1.0.7

## 0.1.17

### Patch Changes

- forgot createRequire()

## 0.1.16

### Patch Changes

- CJS -> MJS

## 0.1.15

### Patch Changes

- Fix import of sanitizedName()

## 0.1.14

### Patch Changes

- Release with WIP --template support
- Updated dependencies
  - expo-desktop-config-plugins@1.1.17
  - expo-desktop-prebuild-config@1.0.6

## 0.1.13

### Patch Changes

- Recommend pnpm for Windows

## 0.1.12

### Patch Changes

- npm dlx -> npx --yes

## 0.1.11

### Patch Changes

- Add dependency overrides

## 0.1.10

### Patch Changes

- Fix expo-tempalte-blank-typescript version lookup

## 0.1.9

### Patch Changes

- Skip interactive prompts

## 0.1.8

### Patch Changes

- Forward args correctly to npm

## 0.1.7

### Patch Changes

- Stop auto-skipping and stop recommending Bun on Windows

## 0.1.6

### Patch Changes

- Republish with pnpm to resolve workspaces/catalogs
- Updated dependencies
  - expo-desktop-config-plugins@1.1.16
  - expo-desktop-prebuild-config@1.0.5

## 0.1.5

### Patch Changes

- Republish after CI changes

## 0.1.4

### Patch Changes

- Make JS build.

## 0.1.3

### Patch Changes

- (CI-only change): Try again to push git tags when publishing packages.
- Updated dependencies
  - expo-desktop-prebuild-config@1.0.4

## 0.1.2

### Patch Changes

- (CI-only change): Try pushing git tags along with package publishes.
- Updated dependencies
  - expo-desktop-prebuild-config@1.0.3

## 0.1.1

### Patch Changes

- 006f7eb: Config plugins that involve Xcode mods hopefully working now.
- Updated dependencies [006f7eb]
  - expo-desktop-prebuild-config@1.0.1
