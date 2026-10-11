#pragma once

#include "pch.h"
#include "resource.h"

#if __has_include("codegen/ExpoMainRuntimeInstallerDataTypes.g.h")
#include "codegen/NativeExpoMainRuntimeInstallerDataTypes.g.h"
#endif
#include "codegen/NativeExpoMainRuntimeInstallerSpec.g.h"

#include "JSValue.h"
#include "NativeModules.h"
#include "../EagerTurboModule.h"

#include "JavaScriptObject.h"
#include "JSIUtils.h"
#include "EventEmitter.h"
#include "SharedRef.h"
#include "NativeModule.h"

#include <string>

namespace jsi = facebook::jsi;

namespace winrt::ExpoDesktopModulesCore {

REACT_EAGER_TURBO_MODULE(ExpoMainRuntimeInstaller);
struct ExpoMainRuntimeInstaller {
  using ModuleSpec = ExpoDesktopModulesCoreCodegen::ExpoMainRuntimeInstallerSpec;

 public:
  // https://github.com/microsoft/react-native-windows/blob/2c3604ceaf073de3aec7e3e56c2286ea1b15287d/vnext/Shared/Modules/BlobModule.cpp#L31
  REACT_INIT(Initialize)
  // https://github.com/expo/expo/blob/95684e9c673859cd1a6ba1243d4ee00e0f09591d/packages/expo-modules-core/android/src/main/cpp/installers/MainRuntimeInstaller.cpp#L123
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &reactContext, facebook::jsi::Runtime &runtime) noexcept {
    jsi::Object global = runtime.global();

    // All of this work below is to set up just enough of the global.expo object such that the React Native Windows app can
    // survive the `require("expo").registerRootComponent(App)` call at app startup, as the latter triggers various side-effects
    // from Expo.fx.tsx, such as accessing global.expo.modules.NativeModulesProxy, global.nativeModuleProxy.EventEmitter, and
    // global.nativeModuleProxy.ExpoAsset:
    // https://github.com/expo/expo/blob/sdk-54/packages/expo/src/Expo.fx.tsx
    //
    // Concretely, without this stub, the following warning messages will be logged at app launch:
    // >  WARN  The "EXNativeModulesProxy" native module is not exported through NativeModules; verify that expo-modules-core's native code is linked properly
    // >  WARN  No native ExponentConstants module found, are you sure the expo-constants's module is linked properly?

    // We need to set up global.expo.modules in just the right shape for expo-modules-core to build its NativeModulesProxy, as follows:
    // - expo-modules-core builds up a fileprivate `const NativeModulesProxy: Record<string, ProxyNativeModule> = {}`.
    // - It does so by iterating over `global.expo?.modules?.NativeModulesProxy ?? global.nativeModuleProxy.NativeUnimoduleProxy`.
    //   - In other words, it iterates over the new JSI proxy, falling back to the (deprecated) legacy proxy if necessary.
    // - It's still necessary for the legacy proxy to exist, as it doesn't even check for a JSI proxy if the legacy one is missing.
    // - Thus, we init an empty NativeUnimoduleProxy to satisfy that check.
    // https://github.com/expo/expo/blob/sdk-54/packages/expo-modules-core/src/NativeModulesProxy.native.ts

    // /* Lazy-init these modules: */
    // global.nativeModuleProxy.ExpoMainRuntimeInstaller;
    // global.nativeModuleProxy.NativeUnimoduleProxy;
    // global.nativeModuleProxy.ExpoAsset;
    jsi::Object nativeModuleProxy = global.getPropertyAsObject(runtime, "nativeModuleProxy");
    jsi::Object NativeUnimoduleProxy = nativeModuleProxy.getPropertyAsObject(runtime, "NativeUnimoduleProxy");
    jsi::Object ExpoAsset = nativeModuleProxy.getPropertyAsObject(runtime, "ExpoAsset");

    // Stub this module:
    jsi::Object ExponentConstants = jsi::Object(runtime);

    // /*
    //  * Build this stub. Reference implementations for NativeModulesProxy:
    //  * - iOS:
    //  *   - NativeUnimoduleProxy: https://github.com/expo/expo/blob/sdk-54/packages/expo-modules-core/ios/Legacy/NativeModulesProxy/NativeModulesProxyModule.swift
    //  *   - NativeModulesProxy: https://github.com/expo/expo/blob/sdk-54/packages/expo-modules-core/ios/Legacy/NativeModulesProxy/EXNativeModulesProxy.mm
    //  * - Android:
    //  *   - NativeUnimoduleProxy: https://github.com/expo/expo/blob/sdk-54/packages/expo-modules-core/android/src/main/java/expo/modules/adapters/react/NativeModulesProxy.java
    //  *   - NativeModulesProxy: https://github.com/expo/expo/blob/sdk-54/packages/expo-modules-core/android/src/main/java/expo/modules/kotlin/defaultmodules/NativeModulesProxyModule.kt
    //  */
    // globalThis.expo.modules = {
    //   ExpoAsset,
    //   ExponentConstants,
    //   NativeModulesProxy: {
    //     exportedMethods: {
    //       ExpoAsset: [],
    //       ExponentConstants: [],
    //     },
    //     modulesConstants: {
    //       ExpoAsset: [],
    //       ExponentConstants: [],
    //     },
    //   },
    // };
    jsi::Object expoModules = jsi::Object(runtime);
    jsi::Object NativeModulesProxy = jsi::Object(runtime);
    jsi::Object exportedMethods = jsi::Object(runtime);
    jsi::Object modulesConstants = jsi::Object(runtime);
    exportedMethods.setProperty(runtime, "ExpoAsset", jsi::Array(runtime, 0));
    exportedMethods.setProperty(runtime, "ExponentConstants", jsi::Array(runtime, 0));
    modulesConstants.setProperty(runtime, "ExpoAsset", jsi::Array(runtime, 0));
    modulesConstants.setProperty(runtime, "ExponentConstants", jsi::Array(runtime, 0));
    NativeModulesProxy.setProperty(runtime, "exportedMethods", exportedMethods);
    NativeModulesProxy.setProperty(runtime, "modulesConstants", modulesConstants);
    expoModules.setProperty(runtime, "ExpoAsset", ExpoAsset);
    expoModules.setProperty(runtime, "ExponentConstants", ExponentConstants);
    expoModules.setProperty(runtime, "NativeModulesProxy", NativeModulesProxy);

    std::shared_ptr<jsi::Object> descriptorValue = std::make_shared<facebook::jsi::Object>(runtime);
    descriptorValue.get()->setProperty(runtime, "modules", expoModules);
    jsi::Object descriptor = expo::JavaScriptObject::preparePropertyDescriptor(runtime, 1 << 1);
    descriptor.setProperty(runtime, "value", jsi::Value(runtime, *descriptorValue));
    expo::common::defineProperty(
      runtime,
      &global,
      "expo",
      std::move(descriptor)
    );

    installClasses(runtime);
  }

  private:
    // // https://github.com/expo/expo/blob/95684e9c673859cd1a6ba1243d4ee00e0f09591d/packages/expo-modules-core/android/src/main/cpp/installers/MainRuntimeInstaller.cpp#L50
    // jni::local_ref<JSIContext::javaobject> MainRuntimeInstaller::install(
    //   jni::alias_ref<MainRuntimeInstaller::javaobject> self,
    //   jni::alias_ref<jni::JWeakReference<jobject>::javaobject> runtimeContextHolder,
    //   jlong jsRuntimePointer,
    //   jni::alias_ref<JNIDeallocator::javaobject> jniDeallocator,
    //   jni::alias_ref<react::JRuntimeExecutor::javaobject> runtimeExecutor
    // ) noexcept {
    //   auto *runtime = reinterpret_cast<jsi::Runtime *>(jsRuntimePointer);
    //
    //   std::shared_ptr<react::CallInvoker> callInvoker;
    //   std::shared_ptr<react::RuntimeScheduler> runtimeScheduler;
    //
    //   if (auto binding = react::RuntimeSchedulerBinding::getBinding(*runtime)) {
    //     runtimeScheduler = binding->getRuntimeScheduler();
    //     callInvoker = std::make_shared<react::RuntimeSchedulerCallInvoker>(runtimeScheduler);
    //   } else {
    //     callInvoker = std::make_shared<BridgelessJSCallInvoker>(runtimeExecutor->cthis()->get());
    //   }
    //
    //   auto jsiContext = createJSIContext(
    //     runtimeContextHolder,
    //     jsRuntimePointer,
    //     jniDeallocator,
    //     callInvoker
    //   );
    //
    //   prepareRuntime(
    //     self,
    //     jsiContext
    //   );
    //
    //   return jsiContext;
    // }

    // // https://github.com/expo/expo/blob/95684e9c673859cd1a6ba1243d4ee00e0f09591d/packages/expo-modules-core/android/src/main/cpp/installers/MainRuntimeInstaller.cpp#L96
    // void MainRuntimeInstaller::prepareRuntime(
    //   jni::alias_ref<MainRuntimeInstaller::javaobject> self,
    //   jni::local_ref<JSIContext::javaobject> jsiContext
    // ) noexcept {
    //   auto cxxPart = jsiContext->cthis();
    //   auto runtimeHolder = cxxPart->runtimeHolder;
    //   jsi::Runtime &runtime = runtimeHolder->get();
    //
    //   bindJSIContext(runtime, cxxPart);
    //
    //   std::shared_ptr<jsi::Object> mainObject = installMainObject(
    //     runtime, MainRuntimeInstaller::getCoreModule(self)->cthis()->decorators
    //   );
    //
    //   installClasses(
    //     runtime,
    //     cxxPart
    //   );
    //
    //   installModules(
    //     runtime,
    //     cxxPart,
    //     mainObject
    //   );
    // }

    // https://github.com/expo/expo/blob/95684e9c673859cd1a6ba1243d4ee00e0f09591d/packages/expo-modules-core/android/src/main/cpp/installers/MainRuntimeInstaller.cpp#L150
    void installClasses(jsi::Runtime &runtime) noexcept {
      // We can't predict the order of deallocation of the JSIContext and the SharedObject.
      // So we need to pass a new ref to retain the JSIContext to make sure it's not deallocated before the SharedObject.
      // const auto releaser = [threadSafeRef = jsiContext->threadSafeJThis](
      //   const SharedObject::ObjectId objectId) {
      //   threadSafeRef->use([objectId](jni::alias_ref<JSIContext::javaobject> globalRef) {
      //     JSIContext::deleteSharedObject(globalRef, objectId);
      //   });
      // };

      const auto releaser = [](const expo::SharedObject::ObjectId objectId) {
        // No-op, as we haven't implemented JSIContext
      };

      expo::EventEmitter::installClass(runtime);
      expo::SharedObject::installBaseClass(runtime, releaser);
      expo::SharedRef::installBaseClass(runtime);
      expo::NativeModule::installClass(runtime);
    }
};

} // namespace ExpoDesktopModulesCore
