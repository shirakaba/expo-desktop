<h1 align="center">Expo Desktop 🖥️</h2>

# About

Best-effort support for using Expo with desktop platforms [react-native-macos](https://github.com/microsoft/react-native-macos) and [react-native-windows](https://github.com/microsoft/react-native-windows).

# Usage

To create a new Expo app that targets iOS, Android, macOS, and Windows, run the following command:

```sh
# This long --template-macos arg will be needed until expo-desktop v1 comes out.
# https://github.com/shirakaba/expo-desktop/issues/17
npx expo-desktop@latest create-app --template-macos "microsoft/react-native-macos#0.81-stable:packages/react-native/local-cli/generator-macos/templates"
```

While `npx expo prebuild` will work as expected for iOS and Android platforms, the equivalent `npx expo-desktop prebuild` command needed for macOS and Windows platforms is not yet implemented, so it is best to commit the `macos` and `windows` directories to source for now. In other words, [CNG](https://docs.expo.dev/workflow/continuous-native-generation/) is not yet supported in Expo Desktop.

You can then run your app as follows:

```sh
# Start the Metro bundler
npm run start

# Build and run the iOS, Android, macOS, or Windows targets
npm run ios
npm run android
npm run macos
npm run windows
```
