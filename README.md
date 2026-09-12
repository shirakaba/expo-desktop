<h1 align="center">Expo Desktop 🖥️</h2>

# About

Best-effort support for using Expo with desktop platforms [react-native-macos](https://github.com/microsoft/react-native-macos) and [react-native-windows](https://github.com/microsoft/react-native-windows).

# Usage

To create a new Expo app that targets iOS, Android, macOS, and Windows, run the following command to use the latest v1 beta (please use that instead of v0):

```sh
npx expo-desktop@beta create-app --template expo-desktop-template-blank-typescript@beta
cd MyApp
npx expo-desktop@beta prebuild --template expo-desktop-template-bare-minimum@beta
```

You can then run your app as follows:

```sh
# Start the Metro bundler
node --run start

# Build and run the iOS, Android, macOS, or Windows targets
node --run ios
node --run android
node --run macos
node --run windows
```
