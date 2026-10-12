---
"expo-desktop": patch
---

Detect existing Metro listeners on macOS and other platforms even when a wildcard bind succeeds on the same port. Reuse the project's running server instead of attempting to start another one, and avoid DNS lookups when checking Unix TCP listeners.
