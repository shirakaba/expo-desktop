---
"expo-desktop": patch
---

Detect IPv6 TCP listeners on Windows so subsequent runs reuse Metro bound to localhost instead of failing with EADDRINUSE.
