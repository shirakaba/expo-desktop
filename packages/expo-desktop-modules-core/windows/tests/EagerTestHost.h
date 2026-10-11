#pragma once
#include "EagerTestModules.h"
#include <chrono>
#include <future>
#include <stdexcept>

namespace eager_tests {
// Run on an MTA thread in an app with the Expo native packages autolinked. The
// directory contains the raw .bundle files; no Metro server is needed.
inline void Run(
    winrt::hstring const &directory,
    std::function<void(std::string const &)> log = [](auto const &) {},
    bool baseline = false) {
  log("Creating host");
  RN::ReactNativeHost host;
  auto settings = host.InstanceSettings();
  settings.UIDispatcher(RN::ReactDispatcherHelper::CreateSerialDispatcher());
  if (!baseline) {
    RegisterAutolinkedNativeModulePackages(settings.PackageProviders());
  }
  settings.PackageProviders().Append(winrt::make<AppPackageProvider>(!baseline));
  if (!baseline) {
    expo::windows::EnableEagerTurboModules(settings);
    // Installing the hook twice must not recreate the modules or wrap twice.
    expo::windows::EnableEagerTurboModules(settings);
  }
  settings.UseDeveloperSupport(false);
  settings.UseFastRefresh(false);
  settings.UseDirectDebugger(false);
  settings.BundleRootPath(directory);
  settings.JavaScriptBundleFile(baseline ? L"baseline" : L"startup");
  settings.NativeLogger([log](auto, winrt::hstring const &message) { log(winrt::to_string(message)); });

  auto load = [log](RN::ReactNativeHost const &testHost) {
    auto result = std::make_shared<std::promise<bool>>();
    auto completed = result->get_future();
    auto testSettings = testHost.InstanceSettings();
    auto token = testSettings.InstanceLoaded([result, log](auto const &, RN::InstanceLoadedEventArgs const &args) {
      log("InstanceLoaded");
      if (args.Failed()) {
        result->set_value(false);
        return;
      }
      auto &runtime = RN::GetOrCreateContextRuntime(RN::ReactContext{args.Context()}, args.RuntimeHandle());
      auto passed = runtime.global().getProperty(runtime, "eagerTestBundlePassed");
      result->set_value(passed.isBool() && passed.getBool());
    });
    log("ReloadInstance");
    testHost.ReloadInstance().get();
    log("Waiting for bundle assertions");
    if (completed.wait_for(std::chrono::seconds{30}) != std::future_status::ready || !completed.get()) {
      throw std::runtime_error("Eager TurboModule bundle assertions failed or timed out");
    }
    testSettings.InstanceLoaded(token);
  };

  load(host);
  if (baseline) {
    log("PASS: ordinary RNW lookup without the compatibility hook");
    load(host);
    host.UnloadInstance().get();
    return;
  }
  log("PASS: pre-bundle Expo globals, cross-DLL eager modules, custom names, lazy lookup");

  RN::ReactNativeHost isolatedHost;
  auto isolatedSettings = isolatedHost.InstanceSettings();
  isolatedSettings.UIDispatcher(RN::ReactDispatcherHelper::CreateSerialDispatcher());
  isolatedSettings.PackageProviders().Append(winrt::make<AppPackageProvider>());
  expo::windows::EnableEagerTurboModules(isolatedSettings);
  isolatedSettings.UseDeveloperSupport(false);
  isolatedSettings.UseFastRefresh(false);
  isolatedSettings.UseDirectDebugger(false);
  isolatedSettings.BundleRootPath(directory);
  isolatedSettings.JavaScriptBundleFile(L"isolated");
  isolatedSettings.NativeLogger([log](auto, winrt::hstring const &message) { log(winrt::to_string(message)); });
  load(isolatedHost);
  log("PASS: host isolation");
  for (int i = 0; i < 3; ++i) {
    load(host); // New runtime, new modules, same package providers.
    load(isolatedHost);
  }
  log("PASS: repeated reload of both hosts");
  isolatedHost.UnloadInstance().get();
  host.UnloadInstance().get();
  load(host);
  host.UnloadInstance().get();
  log("PASS: unload and restart");
}
} // namespace eager_tests
