import SwiftUI
internal import Expo
import React
import ReactAppDependencyProvider

// Keep these constants on separate lines for config plugins.
private let windowTitle = "HelloWorld"
private let bundleRoot = "index"
private let moduleName = "HelloWorld"

@main
struct HelloWorldApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

  var body: some Scene {
    Window(windowTitle, id: "main") {
      ReactNativeView(factory: appDelegate.reactNativeFactory)
    }
    .defaultSize(width: 1280, height: 720)
  }
}

// MARK: - App Delegate

class AppDelegate: ExpoAppDelegate {
  private let reactNative: (delegate: ReactNativeDelegate, factory: RCTReactNativeFactory) = {
    let delegate = ReactNativeDelegate()
    delegate.dependencyProvider = RCTAppDependencyProvider()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    return (delegate, factory)
  }()

  @objc var reactNativeFactory: RCTReactNativeFactory {
    reactNative.factory
  }
}

// MARK: - React Native Delegate

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // Needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: bundleRoot)
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// MARK: - React Native SwiftUI View

struct ReactNativeView: NSViewRepresentable {
  let factory: RCTReactNativeFactory

  func makeNSView(context: Context) -> NSView {
    factory.rootViewFactory.view(withModuleName: moduleName)
  }

  func updateNSView(_ nsView: NSView, context: Context) {}
}
