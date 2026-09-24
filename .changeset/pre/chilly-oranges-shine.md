---
"expo-desktop-config-plugins": patch
"expo-desktop-prebuild-config": patch
---

Fix inconsistency between `expo-desktop prebuild` and the prebuild in `expo-desktop run macos` (actually the difference between prebuilding for all platforms vs. one) - the "HelloWorld" string in AppDelegate.mm wasn't getting renamed to "main", but is fixed by this change.
