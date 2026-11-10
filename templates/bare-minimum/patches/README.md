# Expo CLI: Device Hub on Xcode 27

`@expo/cli@54.0.27.patch` backports Expo's Device Hub support for
[expo-desktop#41](https://github.com/shirakaba/expo-desktop/issues/41). iOS commands
use the app's Expo CLI, so this is a dependency patch in the app template.
The existing package manager setup registers it for npm, pnpm, Bun, and Yarn.

The upstream changes are:

- [expo/expo#46757](https://github.com/expo/expo/pull/46757), merged as
  [`d8a9b2db574a6fa9d6f4bbc9cd445456c89ee40e`](https://github.com/expo/expo/commit/d8a9b2db574a6fa9d6f4bbc9cd445456c89ee40e):
  detect Device Hub by app ID or Xcode's Info.plist, recognize its running process,
  fall back to launching it, and activate its window.
- [expo/expo#46809](https://github.com/expo/expo/pull/46809), merged as
  [`604fdfe762d004e221ee62d8133935803b0e560a`](https://github.com/expo/expo/commit/604fdfe762d004e221ee62d8133935803b0e560a):
  focus the selected device using `devices://device/open?id=<UDID>`.

The patch changes only the three compiled JavaScript modules affected by those
PRs. `SimulatorAppPrerequisite.js` and `ensureSimulatorAppRunning.js` are copied
verbatim from the published `@expo/cli@57.0.0` package. Their TypeScript sources
in that package's source maps match the respective merged revisions above
line for line. `AppleDeviceManager.js` takes only the import and window activation
changes, including the upstream `isInteractive()` guard (also present in Expo's
[SDK 55 backport proposal](https://github.com/expo/expo/pull/50165)). It keeps the
SDK 54 compiler helpers and omits unrelated SDK 57 changes.

The related [expo/expo#48001](https://github.com/expo/expo/pull/48001) change,
which filters simulated devices out of `devicectl` results and accepts JSON
version 5, is already present in `@expo/cli@54.0.27`.

Expo is pinned to `54.0.37`, whose CLI dependency is exactly `54.0.27`, so updates
cannot silently select an unpatched CLI. When updating Expo, review its CLI
version and update or remove this patch together with the pin. Recreate the patch
against that published CLI package, preserving the upstream implementation.

Existing apps can copy the patch and its `patchedDependencies` entry into their
own project, pin Expo to the same version, and reinstall using their package
manager's native patch support. For pnpm, register the entry in
`pnpm-workspace.yaml`; for Yarn, use its `patch:` resolution. The native template
also needs the separate iOS scene lifecycle support for apps built with Xcode 27.
