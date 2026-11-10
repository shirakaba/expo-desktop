---
"expo-desktop-template-bare-minimum": patch
---

Adopt the iOS scene lifecycle so apps built with the iOS 27 SDK can launch. Create the React Native window from the scene, preserve cold-start links, and forward scene events to AppDelegate overrides and Expo subscribers. Preserve upstream link delivery fallbacks and prevent duplicate React Native URL events.
