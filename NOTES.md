# React Native Desktop

My handbook: https://gist.github.com/shirakaba/6ac4f941efe3366ef4e116084282bffb

# React Native Windows

- `init-windows` docs: https://microsoft.github.io/react-native-windows/docs/next/init-windows-cli
- `cpp-app` template: https://github.com/microsoft/react-native-windows/tree/main/vnext/templates/cpp-app
- https://github.com/microsoft/react-native-windows/blob/ea0dd896aa971eae765c50c0f6963e5cefba2237/vnext/templates/cpp-app/template.config.js#L29-L42

## Changes to make to `App.cpp`

```diff
- settings.JavaScriptBundleFile(L"index");
+ settings.JavaScriptBundleFile(L".expo/.virtual-metro-entry");
```

```diff
- viewOptions.ComponentName(L"MyApp123");
+ viewOptions.ComponentName(L"main");
```

## Changes to entrypoint:

The `import { registerRootComponent } from 'expo';` call, pulls in several modules from `expo-modules-core`, one of which (`node_modules\expo-modules-core\src\EventEmitter.ts`) accesses `globalThis.expo.EventEmitter`, only to find that `globalThis.expo` is `undefined` and end up killing app startup.

### Option A: Skipping Expo altogether

We could provide a `index.windows.ts` to skip the `import { registerRootComponent } from 'expo';` call as follows:

```js
import App from "./App";
import { AppRegistry } from "react-native";

AppRegistry.registerComponent("main", () => App);
```

### Option B: Living on the edge

#### JS polyfill

`polyfill.js`:

```js
console.log("CUSTOM POLYFILL");
// @ts-ignore hi
globalThis.expo = {};
```

`metro.config.js`:

```js
const path = require("node:path");
const { getDefaultConfig } = require("@expo/metro-config");
const { makeMetroConfig } = require("@rnx-kit/metro-config");

const config = makeMetroConfig(getDefaultConfig(__dirname));

const oldGetModules = config.serializer.getModulesRunBeforeMainModule;
config.serializer.getModulesRunBeforeMainModule = (entryFilePath) => {
  return [path.resolve(__dirname, "polyfill.js"), ...oldGetModules(entryFilePath)];
};

module.exports = config;
```

#### Native JSI

Add this into `MyApp.cpp`:

```cpp
   reactNativeWin32App.ReactNativeHost().InstanceSettings().InstanceCreated(
       [](const auto& sender,
          const winrt::Microsoft::ReactNative::InstanceCreatedEventArgs& args) {
          winrt::Microsoft::ReactNative::ExecuteJsi(
              args.Context(), [](facebook::jsi::Runtime& runtime) {
                 // Install empty expo object so that expo JS runs enough to
                 // allow expo modules to load using TurboModules
                 auto mainObject =
                     std::make_shared<facebook::jsi::Object>(runtime);
                 auto global = runtime.global();
                 global.setProperty(runtime, "expo", *mainObject);
              });
       });
```

```cpp
winrt::Microsoft::ReactNative::ReactContext(args.Context()).CallInvoker()->invokeSync( [](facebook::jsi::Runtime& runtime)
{
  auto mainObject = std::make_shared<facebook::jsi::Object>(runtime);
  auto global = runtime.global();
  global.setProperty(runtime, "expo", *mainObject);
}
```

## ARM Windows gotchas

### Debug-mode builds

I got this when trying to `node --run windows` on an ARM Windows VM:

> Failed to deploy: ERROR: DEP3308: Deployment target 'Local Machine' does not support projects targetting X64 platform. Supported platforms: X86,ARM64.

The solution is to specify the arch explicitly:

```sh
node --run windows -- --arch=ARM64
```

### Release-mode builds

And when running a release build:

```sh
node --run windows -- --arch=ARM64 --release
```

... I got this message:

> × Build failed with message C:\Users\jamie\Downloads\MyApp123\node_modules\react-native-windows\PropertySheets\Bundle.Common.targets(22,5): error MSB3075: ???? "C:\Users\jamie\.nuget\packages\microsoft.javascript.hermes\0.0.0-2511.7001-d7ca19b3\tools\native\release\x86\hermes.exe -emit-binary -out "C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\Bundle\index.windows.bundle.hbc" "C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\Bundle\index.windows.bundle" -O -output-source-map" ???? 5 ???????????????????????????????????????? [C:\Users\jamie\Downloads\MyApp123\windows\MyApp123\MyApp123.vcxproj]. Check your build configuration.

See how it has selected `x86\hermes.exe`. There's a perfectly good `x64\hermes.exe` beside it, but it's not taking `--arch=ARM64` into account.

#### Workaround

This is pretty rough-and-ready, but I overwrote the architecture-insensitive [HermesCompilerCommand](https://github.com/microsoft/react-native-windows/blob/3d64f71ed8495da6a0dcfc1f97bcb8f761986594/vnext/PropertySheets/Bundle.props#L74) build prop via the first `.props` file I saw, `windows\ExperimentalFeatures.props`. Unfortunately, `$(HermesPackage)` resolves to empty-string there (probably because the `<PropertyGroup>` lacks the `<Import Condition="'$(JsEnginePropsDefined)' == ''" Project="$(ReactNativeWindowsDir)PropertySheets\JSEngine.props" />`), so I ended up just hard-coding the full path for my own system:

```diff
  <?xml version="1.0" encoding="utf-8"?>
  <Project xmlns="http://schemas.microsoft.com/developer/msbuild/2003">

    <PropertyGroup Label="Microsoft.ReactNative Experimental Features">
      <!--
        Required for building a New Architecture project.

        App projects should not change this value.

        See https://microsoft.github.io/react-native-windows/docs/new-architecture
      -->
      <RnwNewArch>true</RnwNewArch>

      <!--
        Changes compilation to assume use of Microsoft.ReactNative NuGet packages
        instead of building the framework from source. Defaults to true.

        This is set during app project creation and should not be changed.

        See https://microsoft.github.io/react-native-windows/docs/nuget
      -->
      <UseExperimentalNuget>true</UseExperimentalNuget>

      <ReactExperimentalFeaturesSet>true</ReactExperimentalFeaturesSet>

+     <!-- <HermesCompilerCommand Condition="'$(HermesCompilerCommand)' == ''">$(HermesPackage)\tools\native\release\x64\hermes.exe</HermesCompilerCommand> -->
+     <HermesCompilerCommand Condition="'$(HermesCompilerCommand)' == ''">C:\Users\jamie\.nuget\packages\microsoft.javascript.hermes\0.0.0-2511.7001-d7ca19b3\tools\native\release\x86\hermes.exe</HermesCompilerCommand>
    </PropertyGroup>

  </Project>
```

# app.json

- Implementation: https://github.com/expo/expo/blob/30bd598fa9e9b7f9412d8308d6abad2a7b7eec82/packages/%40expo/config/src/Config.ts#L468-L472

TODO: Work out what slug is for. I see it's used in `expo-module-template` for `metro.config.js`: https://github.com/expo/expo/blob/2878a2d39325b54c8d10b04c01b40be626ce42e1/packages/expo-module-template/example/metro.config.js#L23

# Dependency management

Not sure how best to proceed. The `expo-desktop` CLI depends on:

- Expo SDK-linked deps:
  - `@expo/config`
  - `@expo/config-plugins`
- Our own forks:
  - `expo-desktop-prebuild-config`
    - `expo-desktop-config-plugins`

If we use dynamic imports, we can resolve the version of the `@expo/*` deps provided by the project itself, but then that means we can only run prebuild after the user has installed `expo` into their deps. I'm not sure whether `@expo/cli` has such a restriction, so it feels a shame.

Not to mention, while dynamic imports may be doable for `expo-desktop` which uses `@expo/*` deps lightly, for `expo-desktop-config-plugins`, it would really turn our implementation upside-down.

While we could do our `dependencies` like this to depend on both and select at runtime:

```json
{
  "@expo/config-plugins-54": "npm:@expo/config-plugins@54",
  "@expo/config-plugins-55": "npm:@expo/config-plugins@55"
}
```

... it feels like a lot of headache compared to just settling on one.

I feel that although config plugins and prebuild-related logic is released in lockstep with the SDK, there's usually nothing wrong with just using the latest implementation. So maybe we just bundle the latest and greatest?
