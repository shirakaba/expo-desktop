---
"expo-desktop-template-bare-minimum": patch
"expo-desktop-template-blank-typescript": patch
---

Provide the missing @react-native-windows/find-dotnet-tools dependency required
by react-native-windows@0.83.2 in both templates.

In blank-typescript, apply React Native Windows PR #16430 during postinstall
using patch-package. Backport lazy PowerShell discovery to the
@react-native-windows/cli@0.83.2 dependency of react-native-windows@0.83.2, so
loading its configuration does not require Windows build tools on macOS.

Upstream: https://github.com/microsoft/react-native-windows/pull/16430
