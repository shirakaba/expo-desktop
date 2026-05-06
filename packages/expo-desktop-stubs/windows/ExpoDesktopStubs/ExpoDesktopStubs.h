#pragma once

#include "pch.h"
#include "resource.h"

#if __has_include("codegen/NativeExpoDesktopStubsDataTypes.g.h")
  #include "codegen/NativeExpoDesktopStubsDataTypes.g.h"
#endif
// Note: The following lines use Mustache template syntax which will be processed during
// project generation to produce standard C++ code. If existing codegen spec files are found,
// use the actual filename; otherwise use conditional includes.
#if __has_include("codegen/NativeExpoDesktopStubsSpec.g.h")
  #include "codegen/NativeExpoDesktopStubsSpec.g.h"
#endif

#include "NativeModules.h"

namespace winrt::ExpoDesktopStubs
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

REACT_MODULE(ExpoDesktopStubs)
struct ExpoDesktopStubs
{
  // Note: Mustache template syntax below will be processed during project generation
  // to produce standard C++ code based on detected codegen files.
#if __has_include("codegen/NativeExpoDesktopStubsSpec.g.h")
  using ModuleSpec = ExpoDesktopStubsCodegen::ExpoDesktopStubsSpec;
#endif

  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &reactContext) noexcept;

  REACT_SYNC_METHOD(multiply)
  double multiply(double a, double b) noexcept;

private:
  React::ReactContext m_context;
};

} // namespace winrt::ExpoDesktopStubs