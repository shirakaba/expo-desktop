---
"expo-desktop-template-blank-typescript": patch
"expo-desktop-template-bare-minimum": patch
---

Exclude the React Native Windows host package from Expo autolinking. Loading its
Windows CLI during Apple or Android autolinking can fail on missing Windows
tooling, preventing CocoaPods installation in freshly created apps. Windows
continues to use the React Native Windows CLI for autolinking.
