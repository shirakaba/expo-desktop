---
"expo-desktop-config-plugins": patch
---

Update the macOS target's bundling phase even when the project also contains an
iOS target, and use the React Native macOS Xcode bundling script. The iOS script
embedded the machine's LAN address in debug apps, which could not connect to
Expo Desktop's localhost Metro server and opened a blank window.
