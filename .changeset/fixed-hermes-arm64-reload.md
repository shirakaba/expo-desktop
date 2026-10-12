---
"expo-desktop-template-bare-minimum": patch
"expo-desktop-template-blank-typescript": patch
---

Pin the Windows template to Hermes 0.0.0-2608.12001-35d34796 to fix ARM64 reload and runtime teardown crashes with RNW 0.83.2, retaining the precompiled RNW NuGet DLL. Existing apps should regenerate their Windows project or set HermesVersion in windows/ExperimentalFeatures.props, then restore NuGet dependencies and rebuild.
