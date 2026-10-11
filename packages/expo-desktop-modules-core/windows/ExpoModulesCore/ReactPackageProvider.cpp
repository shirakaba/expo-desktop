#include "pch.h"
#include <NativeModules.h>
#include "../EagerTurboModule.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "ExpoModulesCore.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::ExpoModulesCore::implementation {

void ReactPackageProvider::CreatePackage(
    IReactPackageBuilder const& packageBuilder) noexcept {
   expo::windows::AddAttributedModules(packageBuilder, true);
}

}  // namespace winrt::ExpoModulesCore::implementation
