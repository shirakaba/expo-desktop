#pragma once

#include <NativeModules.h>

// RNW 0.83 did not receive the eager TurboModule backport. Keep this entirely in
// userland: do not add methods to RNW's WinRT interfaces or replace its DLL.
#ifndef REACT_EAGER_TURBO_MODULE
#define EXPO_DESKTOP_USERLAND_EAGER_TURBO_MODULES

#include <unknwn.h>
#include <winstring.h>
#include <winrt/Microsoft.ReactNative.Composition.h>
#include <memory>
#include <mutex>
#include <vector>

namespace expo::windows::detail {
namespace RN = winrt::Microsoft::ReactNative;

// Each EXE/DLL has its own attributed-module list, just like RNW. Static
// registration only links nodes; it must not call WinRT before init_apartment.
struct EagerModuleRegistration : RN::ModuleRegistration {
  explicit EagerModuleRegistration(wchar_t const *name) noexcept
      : RN::ModuleRegistration{name}, next{head} {
    head = this;
  }

  bool ShouldRegisterAsTurboModule() const noexcept override { return true; }

  EagerModuleRegistration const *next;
  inline static EagerModuleRegistration const *head{nullptr};
};

// Private, ABI-safe interface between independently compiled native packages and
// the host's builder. No STL objects or JSI runtime pointers cross DLL boundaries.
struct __declspec(uuid("28315e79-863c-43f7-97c6-27ec311fd9e7")) IEagerModuleRegistry : IUnknown {
  virtual HRESULT __stdcall AddEagerModule(HSTRING name) noexcept = 0;
};

struct EagerPackageBuilder : winrt::implements<
    EagerPackageBuilder, RN::IReactPackageBuilder, RN::IReactPackageBuilderFabric, IEagerModuleRegistry> {
  explicit EagerPackageBuilder(RN::IReactPackageBuilder const &builder) : m_builder{builder} {}

  void AddModule(winrt::hstring const &name, RN::ReactModuleProvider const &provider) {
    m_builder.AddModule(name, provider);
  }

  void AddTurboModule(winrt::hstring const &name, RN::ReactModuleProvider const &provider) {
    m_builder.AddTurboModule(name, provider);
  }

  void AddViewComponent(winrt::hstring const &name, RN::ReactViewComponentProvider const &provider) {
    m_builder.as<RN::IReactPackageBuilderFabric>().AddViewComponent(name, provider);
  }

  void AddUriImageProvider(RN::Composition::IUriImageProvider const &provider) {
    m_builder.as<RN::IReactPackageBuilderFabric>().AddUriImageProvider(provider);
  }

  HRESULT __stdcall AddEagerModule(HSTRING name) noexcept override {
    try {
      uint32_t length{};
      auto characters = WindowsGetStringRawBuffer(name, &length);
      // RNW keeps an ordered list of eager registrations. A later provider may
      // replace a module without removing its name from that list.
      m_eagerNames.emplace_back(characters, length);
      return S_OK;
    } catch (...) {
      return winrt::to_hresult();
    }
  }

  std::vector<winrt::hstring> Names() const {
    return m_eagerNames;
  }

 private:
  RN::IReactPackageBuilder m_builder;
  std::vector<winrt::hstring> m_eagerNames;
};

struct EagerRegistry {
  std::mutex mutex;
  std::vector<winrt::hstring> names;
};

// Rebuild the registry on every CreatePackage (including full reloads). It only
// contains modules actually registered with this host, never a process-global list.
struct EagerPackageProvider : winrt::implements<EagerPackageProvider, RN::IReactPackageProvider> {
  EagerPackageProvider(
      std::vector<RN::IReactPackageProvider> providers,
      std::shared_ptr<EagerRegistry> registry)
      : m_providers{std::move(providers)}, m_registry{std::move(registry)} {}

  void CreatePackage(RN::IReactPackageBuilder const &builder) {
    auto eagerBuilder = winrt::make_self<EagerPackageBuilder>(builder);
    for (auto const &provider : m_providers) {
      provider.CreatePackage(eagerBuilder.as<RN::IReactPackageBuilder>());
    }
    std::lock_guard lock{m_registry->mutex};
    m_registry->names = eagerBuilder->Names();
  }

 private:
  std::vector<RN::IReactPackageProvider> m_providers;
  std::shared_ptr<EagerRegistry> m_registry;
};
} // namespace expo::windows::detail

#define EXPO_DESKTOP_EAGER_MODULE_2_ARGS(moduleStruct, moduleName)                             \
  REACT_TURBO_MODULE_NOREG(moduleStruct, moduleName)                                           \
  template <class TDummy>                                                                    \
  struct moduleStruct##_EagerRegistration final : expo::windows::detail::EagerModuleRegistration { \
    moduleStruct##_EagerRegistration() noexcept : EagerModuleRegistration{moduleName} {}       \
    winrt::Microsoft::ReactNative::ReactModuleProvider MakeModuleProvider() const noexcept override { \
      return winrt::Microsoft::ReactNative::MakeModuleProvider<moduleStruct>();               \
    }                                                                                       \
    static const moduleStruct##_EagerRegistration Registration;                              \
  };                                                                                        \
  template <class TDummy>                                                                    \
  const moduleStruct##_EagerRegistration<TDummy> moduleStruct##_EagerRegistration<TDummy>::Registration; \
  template struct moduleStruct##_EagerRegistration<int>;

#define EXPO_DESKTOP_EAGER_MODULE_1_ARG(moduleStruct) \
  EXPO_DESKTOP_EAGER_MODULE_2_ARGS(moduleStruct, L## #moduleStruct)

#define REACT_EAGER_TURBO_MODULE(...) \
  INTERNAL_REACT_RECOMPOSER_3((__VA_ARGS__, EXPO_DESKTOP_EAGER_MODULE_2_ARGS, EXPO_DESKTOP_EAGER_MODULE_1_ARG, ))(__VA_ARGS__)
#endif // !REACT_EAGER_TURBO_MODULE

namespace expo::windows {

// Use this in each package containing compatibility eager modules. Ordinary
// modules keep RNW's normal registration and lazy initialization behavior.
inline void AddAttributedModules(
    winrt::Microsoft::ReactNative::IReactPackageBuilder const &builder,
    bool useTurboModules = false) noexcept {
  winrt::Microsoft::ReactNative::AddAttributedModules(builder, useTurboModules);
#ifdef EXPO_DESKTOP_USERLAND_EAGER_TURBO_MODULES
  if (detail::EagerModuleRegistration::head) {
    auto registry = builder.try_as<detail::IEagerModuleRegistry>();
    if (!registry) {
      // A missing startup hook must not silently turn eager modules into lazy ones.
      winrt::throw_hresult(E_UNEXPECTED);
    }
    for (auto reg = detail::EagerModuleRegistration::head; reg; reg = reg->next) {
      winrt::hstring name{reg->ModuleName()};
      winrt::check_hresult(registry->AddEagerModule(static_cast<HSTRING>(winrt::get_abi(name))));
    }
  }
#endif
}

// Call once, after adding all package providers and before starting the host.
// Versions of RNW with native eager-module support need no compatibility hook.
inline void EnableEagerTurboModules(winrt::Microsoft::ReactNative::ReactInstanceSettings const &settings) {
#ifdef EXPO_DESKTOP_USERLAND_EAGER_TURBO_MODULES
  namespace RN = winrt::Microsoft::ReactNative;
  const RN::ReactPropertyId<bool> enabled{L"ExpoDesktop", L"EagerTurboModulesEnabled"};
  RN::ReactPropertyBag properties{settings.Properties()};
  if (properties.Get(enabled).value_or(false)) {
    return;
  }

  auto registry = std::make_shared<detail::EagerRegistry>();
  auto providers = settings.PackageProviders();
  std::vector<RN::IReactPackageProvider> originalProviders{providers.begin(), providers.end()};
  auto provider = winrt::make<detail::EagerPackageProvider>(std::move(originalProviders), registry);
  settings.InstanceCreated([registry](auto const &, RN::InstanceCreatedEventArgs const &args) {
    std::vector<winrt::hstring> names;
    {
      std::lock_guard lock{registry->mutex};
      names = registry->names;
    }
    if (names.empty()) {
      return;
    }

    // InstanceCreated runs on the JS thread after TurboModule binding is
    // installed and before the bundle loads. Do not dispatch this asynchronously.
    auto runtimeHandle = args.RuntimeHandle();
    if (!runtimeHandle) {
      throw winrt::hresult_error(E_UNEXPECTED, L"Eager TurboModules require a local JSI runtime");
    }
    auto &runtime = RN::GetOrCreateContextRuntime(RN::ReactContext{args.Context()}, runtimeHandle);
    auto proxy = runtime.global().getPropertyAsObject(runtime, "nativeModuleProxy");
    for (auto const &name : names) {
      auto module = proxy.getProperty(runtime, winrt::to_string(name).c_str());
      if (!module.isObject()) {
        throw winrt::hresult_error(E_UNEXPECTED, L"Unable to initialize eager TurboModule: " + name);
      }
    }
  });
  providers.Clear();
  providers.Append(provider);
  properties.Set(enabled, true);
#endif
}
} // namespace expo::windows
