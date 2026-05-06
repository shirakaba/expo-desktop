#include "pch.h"

#include "ExpoDesktopStubs.h"

namespace winrt::ExpoDesktopStubs
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

void ExpoDesktopStubs::Initialize(React::ReactContext const &reactContext) noexcept {
  m_context = reactContext;
}

double ExpoDesktopStubs::multiply(double a, double b) noexcept {
  return a * b;
}

} // namespace winrt::ExpoDesktopStubs