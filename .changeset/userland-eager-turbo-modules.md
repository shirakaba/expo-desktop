---
"expo-desktop-modules-core": patch
"expo-desktop-template-bare-minimum": patch
"expo-desktop-template-blank-typescript": patch
---

Support REACT_EAGER_TURBO_MODULE on React Native Windows 0.83 using the stock NuGet DLL. Collect eager modules across native packages and initialize them synchronously before the application bundle, including on reload, so Expo's existing REACT_INIT runtime installer can run without a JavaScript installModules workaround. Regenerate the Windows project with prebuild to install the startup hook.
