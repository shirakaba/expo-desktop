<h1 align="center">Expo Desktop 🖥️</h2>

# About

Best-effort support for using Expo with desktop platforms [react-native-macos](https://github.com/microsoft/react-native-macos) and [react-native-windows](https://github.com/microsoft/react-native-windows).

# Usage

To create a new Expo app that targets iOS, Android, macOS, and Windows, run the following command:

```sh
npx expo-desktop@latest create-app
cd MyApp

node --run prebuild
```

You can then run your app as follows:

```sh
# Build and run the iOS, Android, macOS, or Windows targets
node --run ios
node --run android
node --run macos
node --run windows
```
