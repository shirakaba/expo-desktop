---
"expo-desktop-metro-config": patch
---

Exclude native Windows project and React Native Windows build outputs from Metro, following the React Native Windows template. This prevents rebuilds from overwhelming Metro's file watcher and stalling subsequent app launches, and avoids locked MSBuild files. Remove RNX Kit's legacy blacklistRE alias so Metro honors the blockList exclusions and subsequent user additions.
