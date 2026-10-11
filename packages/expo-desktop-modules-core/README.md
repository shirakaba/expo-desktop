# expo-desktop-modules-core (for SDK 54)

- Living branch: https://github.com/expo/expo/tree/sdk-54/packages/expo-modules-core
- Exact commit copied: https://github.com/expo/expo/tree/dd4e87727c4ef32ac5d8a7b5a42fd80da254140f/packages/expo-modules-core

## Eager TurboModules on Windows

RNW 0.83 lacks `REACT_EAGER_TURBO_MODULE`. `windows/EagerTurboModule.h`
provides a compatibility implementation using the stock RNW NuGet DLL. On RNW
versions that already define the macro, it leaves native eager initialization
in charge.

To declare an eager module, include that header and use the usual annotation:

```cpp
#include <EagerTurboModule.h>

REACT_EAGER_TURBO_MODULE(MyInstaller); // Or (MyInstaller, L"CustomName")
struct MyInstaller {
  REACT_INIT(Initialize)
  void Initialize(
      winrt::Microsoft::ReactNative::ReactContext const &context,
      facebook::jsi::Runtime &runtime) noexcept {
    // Install globals before the application bundle executes.
  }
};
```

Each EXE or native-module DLL containing compatibility eager modules must call
`expo::windows::AddAttributedModules(packageBuilder, true)` in its package
provider instead of RNW's `AddAttributedModules`. Add this package's `windows`
directory to its C++ include path. The Expo Modules Core provider already does
this. Packages containing only ordinary modules need no changes.

The host must call `expo::windows::EnableEagerTurboModules(settings)` after adding
**all** package providers, before starting the host. The bare-minimum Windows
template does this automatically; existing apps should regenerate their Windows
project with prebuild or apply the same include path and startup call manually.

The hook wraps package registration, collects eager names across DLLs through a
private COM interface, and resolves them through `nativeModuleProxy` synchronously
in `InstanceCreated`. RNW runs their existing `REACT_INIT` methods and caches the
modules. Ordinary modules remain lazy. The registry belongs to the host and is
rebuilt on reload; static registration never calls WinRT. Eager initialization
requires a local JSI runtime. Eager names retain registration order (C++ static
registration order itself is not a dependency-order guarantee). As in RNW, a
later replacement provider does not cancel an earlier eager registration. A package
using the compatibility registration helper fails immediately if the host hook
is missing, rather than silently initializing too late.

This reproduces the before-bundle `REACT_INIT` behavior needed by Expo's installer,
but is not a complete backport of RNW's native eager API:

- Native RNW initializes modules before notifying `InstanceCreated` subscribers.
  The shim is itself a subscriber, so it cannot promise that other subscribers
  observe already-initialized modules.
- The shim accesses `nativeModuleProxy`, which also creates a module's JavaScript
  representation. Native eager initialization only resolves the native module.
  The proxy reserves `__esModule`; that is not a supported eager module name.
- Registration requires the helper in every participating DLL and a host hook
  after all providers are added. RNW's plain `TryAddAttributedModule` and manual
  `AddEagerInitTurboModule` API are not backported by this header.

RNW 0.83.2's bundled Hermes `0.0.0-2604.21001-94aa5e1d` has an independent ARM64
teardown crash, including with an empty RNW host. Microsoft fixed the fiber stack
adjustment in [Hermes commit 59b6d152](https://github.com/microsoft/hermes-windows/commit/59b6d152cee1d64f0a6c2a5add0e20c32464676c).
Reload validation passes with Hermes `0.0.0-2608.12001-35d34796` and the unchanged
RNW 0.83.2 DLL. This header does not update the app's Hermes dependency.

Native regression fixtures and instructions are in `windows/tests/README.md`.
