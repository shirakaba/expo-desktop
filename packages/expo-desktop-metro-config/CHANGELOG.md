# expo-desktop-metro-config

## 54.81.3

### Patch Changes

- 8bd6f7f: Revert the additional Windows build output exclusions and restore the previous Metro configuration.

## 54.81.2

### Patch Changes

- 5a9b0a1: Exclude native Windows project and React Native Windows build outputs from Metro, following the React Native Windows template. This prevents rebuilds from overwhelming Metro's file watcher and stalling subsequent app launches, and avoids locked MSBuild files. Remove RNX Kit's legacy blacklistRE alias so Metro honors the blockList exclusions and subsequent user additions.

## 54.81.1

### Patch Changes

- Republish post-monorepo restructure

## 54.81.0

### Patch Changes

- d7461ef: Use expo-desktop-metro-config instead of unmaintained metro.config.js
- 642bb97: Let rnx-kit define `resolver.platforms`
- 642bb97: Fix export

## 54.81.0-beta.4

### Patch Changes

- Let rnx-kit define `resolver.platforms`

## 54.81.0-beta.3

### Patch Changes

- Fix export

## 54.81.0-beta.2

### Patch Changes

- Use expo-desktop-metro-config instead of unmaintained metro.config.js
