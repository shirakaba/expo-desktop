#pragma once
#include "../EagerTurboModule.h"

// Compile this header in the app and in a second native-module DLL. Use distinct
// names so that an accidental EXE-local registry cannot pass the test.
namespace eager_tests {
namespace RN = winrt::Microsoft::ReactNative;

inline void Increment(facebook::jsi::Runtime &runtime, char const *name) {
  auto value = runtime.global().getProperty(runtime, name);
  runtime.global().setProperty(runtime, name, value.isNumber() ? value.asNumber() + 1 : 1);
}

#ifdef EXPO_EAGER_TEST_DLL
REACT_EAGER_TURBO_MODULE(DllModule, L"EagerTestRenamedDllModule");
struct DllModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &, facebook::jsi::Runtime &runtime) noexcept {
    Increment(runtime, "eagerDllInitCount");
  }
};
#else
inline void RecordOrder(facebook::jsi::Runtime &runtime, char const *name) {
  std::string expected;
  // Compare against RNW's actual attributed registration order, not C++ static
  // initialization order or alphabetical order chosen by the test.
  for (auto reg = RN::ModuleRegistration::Head(); reg; reg = reg->Next()) {
    std::wstring moduleName{reg->ModuleName()};
    if (moduleName == L"ZOrderModule" || moduleName == L"AOrderModule") {
      expected += winrt::to_string(moduleName) + ";";
    }
  }
  auto previous = runtime.global().getProperty(runtime, "eagerOrder");
  auto order = previous.isString() ? previous.asString(runtime).utf8(runtime) : std::string{};
  runtime.global().setProperty(runtime, "eagerOrder", order + name + ";");
  runtime.global().setProperty(runtime, "expectedEagerOrder", expected);
}

REACT_EAGER_TURBO_MODULE(AOrderModule);
struct AOrderModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &, facebook::jsi::Runtime &runtime) noexcept {
    RecordOrder(runtime, "AOrderModule");
  }
};

REACT_EAGER_TURBO_MODULE(ZOrderModule);
struct ZOrderModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &, facebook::jsi::Runtime &runtime) noexcept {
    RecordOrder(runtime, "ZOrderModule");
  }
};

REACT_EAGER_TURBO_MODULE(ReplacedModule);
struct ReplacedModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &, facebook::jsi::Runtime &runtime) noexcept {
    Increment(runtime, "replacedOriginalInitCount");
  }
};

REACT_TURBO_MODULE_NOREG(ReplacementModule);
struct ReplacementModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &, facebook::jsi::Runtime &runtime) noexcept {
    Increment(runtime, "replacementInitCount");
  }
};

REACT_EAGER_TURBO_MODULE(EagerTestAppModule);
struct EagerTestAppModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &, facebook::jsi::Runtime &runtime) noexcept {
    Increment(runtime, "eagerAppInitCount");
  }
};

REACT_TURBO_MODULE(EagerTestLazyModule);
struct EagerTestLazyModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &, facebook::jsi::Runtime &runtime) noexcept {
    Increment(runtime, "lazyInitCount");
  }
};

struct AppPackageProvider : winrt::implements<AppPackageProvider, RN::IReactPackageProvider> {
  explicit AppPackageProvider(bool compatibility = true) : m_compatibility{compatibility} {}

  void CreatePackage(RN::IReactPackageBuilder const &builder) noexcept {
    if (m_compatibility) {
      expo::windows::AddAttributedModules(builder, true);
    } else {
      RN::AddAttributedModules(builder, true);
    }
    // Native RNW retains an eager name when a later, ordinary provider replaces
    // its implementation. The final provider must initialize before the bundle.
    builder.AddTurboModule(L"ReplacedModule", RN::MakeModuleProvider<ReplacementModule>());
  }

 private:
  bool m_compatibility;
};
#endif
} // namespace eager_tests
