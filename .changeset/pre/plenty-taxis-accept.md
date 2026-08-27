---
"expo-desktop": major
---

Fully implement Expo Prebuild, including the template system, for Expo Desktop. The Expo Desktop CLI no longer relies on multiple CLIs (`create-expo-app`, `react-native-macos-init`, and `react-native init-windows`), nor multiple templates (for mobile, macOS, and Windows). Instead, we duplicate (where possible) and fork (where necessary) all the logic for creating apps from `create-expo-app`, and all the logic for prebuilding apps from `@expo/cli`.
