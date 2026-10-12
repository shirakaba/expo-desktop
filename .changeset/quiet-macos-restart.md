---
"expo-desktop": patch
---

Fix macOS app restarts failing with `MACOS_TERMINATE` when an existing instance is running. Wait for all existing instances to exit before launching the replacement instead of treating the default zero timeout as an immediate timeout.
