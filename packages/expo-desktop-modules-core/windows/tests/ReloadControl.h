#pragma once
// Independent controls: no compatibility header, attributed registry, Expo
// packages, or eager hook. Empty also avoids JSI in all native callbacks.
#include <NativeModules.h>
#include <chrono>
#include <future>
#include <stdexcept>

namespace reload_control {
namespace RN = winrt::Microsoft::ReactNative;
enum class Mode { Empty, RuntimeWrapper, LazyModule };

REACT_TURBO_MODULE_NOREG(ControlModule);
struct ControlModule {
  REACT_INIT(Initialize)
  void Initialize(RN::ReactContext const &) noexcept {}
};

struct PackageProvider : winrt::implements<PackageProvider, RN::IReactPackageProvider> {
  void CreatePackage(RN::IReactPackageBuilder const &builder) noexcept {
    builder.AddTurboModule(L"ControlModule", RN::MakeModuleProvider<ControlModule>());
  }
};

inline void Run(
    winrt::hstring const &directory,
    Mode mode = Mode::Empty,
    std::function<void(std::string const &)> log = [](auto const &) {}) {
  RN::ReactNativeHost host;
  auto settings = host.InstanceSettings();
  settings.UIDispatcher(RN::ReactDispatcherHelper::CreateSerialDispatcher());
  settings.UseDeveloperSupport(false);
  settings.UseFastRefresh(false);
  settings.UseDirectDebugger(false);
  settings.BundleRootPath(directory);
  settings.JavaScriptBundleFile(mode == Mode::LazyModule ? L"control-module" : L"control-empty");
  if (mode == Mode::LazyModule) {
    settings.PackageProviders().Append(winrt::make<PackageProvider>());
  }
  settings.NativeLogger([log](auto, winrt::hstring const &message) { log(winrt::to_string(message)); });
  settings.InstanceCreated([mode](auto const &, RN::InstanceCreatedEventArgs const &args) {
    if (mode == Mode::RuntimeWrapper) {
      auto &runtime = RN::GetOrCreateContextRuntime(RN::ReactContext{args.Context()}, args.RuntimeHandle());
      runtime.global().setProperty(runtime, "controlWrapper", true);
    }
  });
  for (int i = 0; i < 3; ++i) {
    auto result = std::make_shared<std::promise<bool>>();
    auto completed = result->get_future();
    auto token = settings.InstanceLoaded([result](auto const &, RN::InstanceLoadedEventArgs const &args) {
      result->set_value(!args.Failed());
    });
    log("Reload " + std::to_string(i));
    host.ReloadInstance().get();
    if (completed.wait_for(std::chrono::seconds{30}) != std::future_status::ready || !completed.get()) {
      throw std::runtime_error("Control bundle failed or timed out");
    }
    settings.InstanceLoaded(token);
  }
  host.UnloadInstance().get();
  log("PASS: control reload and unload");
}
} // namespace reload_control
