# Native eager-module regression test

These fixtures exercise the actual RNW runtime, including its precompiled NuGet
DLL. Run them in a disposable generated SDK 55 Windows app with Expo Modules Core
and Expo Desktop Stubs autolinked and the compatibility changes installed.

1. Include `EagerTestHost.h` from the app's C++ entry point, after
   `AutolinkedNativeModules.g.h`. Include `EagerTestModules.h` in the Stubs DLL's
   package provider with `EXPO_EAGER_TEST_DLL` defined, and change that provider to
   call `expo::windows::AddAttributedModules(packageBuilder, true)`.
2. Build the app normally, retaining `UseExperimentalNuget=true`.
3. From an MTA thread in the app, before starting any React views, call
   `eager_tests::Run(L"file://<absolute path to this directory>/")`. An exception
   indicates failure; normal return indicates success. Run under the app's
   package identity so its WinRT native modules can be activated.

The host loads `startup.bundle`, then `isolated.bundle` in a separate host, then
reloads both hosts three times, unloads them, and restarts the original host.
Assertions are the first statements of raw JavaScript bundles, before any
React or Expo imports. They check:

- Eager modules in both the EXE and another DLL initialize exactly once.
- Both the default module name and an explicit exported name work.
- Expo's real installer has installed globals before the bundle starts.
- Normal modules remain lazy and initialize on their first lookup.
- Repeated lookups and repeated hook installation do not repeat initialization.
- Eager initialization follows RNW's attributed registration order.
- Replacing an eager module with an ordinary provider still eagerly initializes
  the final provider, as in native RNW.
- Full reloads and a restart after unload create and initialize fresh modules.
- A host without the native packages does not inherit another host's registry.

For a control run, call `eager_tests::Run(directory, log, true)`. This loads
`baseline.bundle` using ordinary RNW module lookup, with no Expo packages and
without installing the compatibility hook.

For stronger controls, include `ReloadControl.h` and call
`reload_control::Run(directory, mode, log)` in a separate process for each of:

- `reload_control::Mode::Empty`: no package providers and no native JSI access.
- `reload_control::Mode::RuntimeWrapper`: only a JSI wrapper/global write.
- `reload_control::Mode::LazyModule`: a manually registered, ordinary RNW module
  loaded by JavaScript; no attributed registrations or JSI initializer.

These controls do not include the compatibility header or register Expo packages.
They test three loads followed by unload. Run them before attributing any runtime
failure to the eager hook. A non-crashing cold start alone is insufficient.

## ARM64 validation (2026-10-12)

RNW was the stock `Microsoft.ReactNative` 0.83.2 NuGet DLL throughout. Its deployed
SHA-256 was `5CB724B39B306BEF1628EE2BD65B21CFB6412E3443FBE43E5078CB0C36E45111`.
The app used Expo 55.0.31 and React Native 0.83.10, built ARM64 Debug with NuGet
enabled. Tests used local bundles with developer support and direct debugging off.

| Hermes                                                                         | Empty/wrapper/lazy controls | Eager suite                                        | Full Expo app                                            |
| ------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| Bundled `0.0.0-2604.21001-94aa5e1d`                                            | Abort on first reload       | Startup/isolation pass; reload aborts              | Startup passes; reload aborts                            |
| Same DLL with only the upstream ARM64 stack instruction corrected (diagnostic) | Empty passes                | Both hosts reload three times; unload/restart pass | Initial load plus three reloads pass                     |
| Published `0.0.0-2608.12001-35d34796`                                          | All pass                    | Both hosts reload three times; unload/restart pass | Four successful bundle loads (`InstanceLoaded failed=0`) |

The published fixed Hermes DLL SHA-256 was
`EBD33ECA55229153FA3F7AAF7453037E80E88ED2E5730866B40AF5C6EDE347C6`.
The expanded suite was also run against the original shim at `2632062`. It failed,
and native logging confirmed both regressions: order `AOrderModule;ZOrderModule;`
instead of RNW's `ZOrderModule;AOrderModule;`, and `replacementInitCount` undefined.
The corrected shim passes these assertions before the first bundle statement
that looks up a module, including after each reload and restart.

The original Hermes DLL SHA-256 was
`547625E5A941267D0BC262795DCEF147EF6C43DA055563002C587FA279962C72`.
Its matching PDB comes from `Microsoft.JavaScript.Hermes.Fat` at the same version.
The exception was `0xc0000409`, parameter 0 = 2
(`FAST_FAIL_STACK_COOKIE_CHECK_FAILURE`), with these symbolicated frames:

```text
hermes!__report_gsfailure+0xc
hermes!__gsfailure+0x28
hermes!std::_Ref_count_obj2<hermes::StackExecutor>::_Destroy+0x44
```

The faulting RVA was `0x4a209c`. `hoost_ontop_fcontext` starts at RVA `0x23b4e0`;
its epilog at RVA `0x23b56c` restores `0xc0` bytes after allocating `0xd0`.
The 16-byte stack skew triggers the cookie failure during fiber destruction.
[Upstream fix 59b6d152 / PR #345](https://github.com/microsoft/hermes-windows/commit/59b6d152cee1d64f0a6c2a5add0e20c32464676c)
changes that epilog to restore `0xd0`. Applying just that instruction correction
to a private diagnostic DLL made the empty-host control, expanded eager suite,
and real Expo reload pass. No compatibility-code change was necessary to remove
this crash. Precompiling the test bundles to Hermes bytecode did not avoid it.

The diagnostic DLL was not shipped or added to the repository. The application's
original files and deployed binaries were restored after testing. The shim does
not fix the old Hermes binary; applications using it still have this ARM64 bug.

## Equivalence boundaries

The tests establish before-bundle initialization, caching, cross-DLL registration,
registration order, replacement-provider behavior, runtime recreation, and host
isolation for this WinRT TurboModule path. They do not establish complete API or
lifecycle equivalence. Native RNW calls `TurboModuleManager::getModule` before
`InstanceCreated`; the shim runs inside that notification and also materializes
the JavaScript wrapper through `TurboModuleBinding::getModule`. See the package
README for registration restrictions. The native reference is
[RNW PR #16093](https://github.com/microsoft/react-native-windows/pull/16093).

Also launch the normal generated Expo app after removing the test entry point.
The raw bundles deliberately isolate startup ordering; a normal launch verifies
that Expo's JavaScript consumes the installed globals successfully.
