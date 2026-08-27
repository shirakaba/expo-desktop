---
"expo-desktop-config-plugins": minor
"expo-desktop-prebuild-config": minor
---

Implemented all the necessary prebuild config and config plugins for (re)generating React Native Windows apps from `app.json`, so the project and package GUIDs are now stable. The project files in the `windows` folder are now all based on the name `MyApp` (rather than the `"name"` field in `app.json`). Required fields in `app.json` are now enforced.
