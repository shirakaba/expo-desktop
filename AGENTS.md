# Expo Desktop

This is a project to bring best-effort support for react-native-macos and react-native-windows to Expo in userland. It includes a CLI (analogous to `@expo/cli`), and ports of the CLI's internal logic like `@expo/config-plugins` and `@expo-prebuild-config` to support desktop platforms.

## Repo layout

```
.
├── .github                     # CI
├── packages
│   ├── expo-desktop            # Analogous to @expo/cli.
│   │   └── src
│   │       ├── add-app         # WIP command to add an app to an existing repo.
│   │       ├── common          # Utils that may be common to each command
│   │       ├── create-app      # The command to create a new app
│   │       ├── fixtures        # Test fixtures
│   │       ├── prebuild        # The command to prebuild an existing app
│   │       └── cli.ts          # The entrypoint into the CLI
│   │
│   ├── expo-desktop-config-plugins  # Analogous to @expo/config-plugins
│   │   └── src
│   │       ├── plugins
│   │       │   ├── android    # packages/@expo/config-plugins/src/android
│   │       │   ├── ios        # packages/@expo/config-plugins/src/ios
│   │       │   ├── macos      # Ports of packages/@expo/config-plugins/src/ios
│   │       │   │   └── _utils # Ports of @expo/config-plugins/src/utils
│   │       │   └── with-expo-desktop.js # A config plugin to add Expo Desktop
│   │       │                            # support to an Expo app that has
│   │       │                            # react-native-macos and/or
│   │       │                            # react-native-windows projects.
│   │       └── typeRoot       # Passed into tsconfig.json typeRoots.
│   │
│   └── expo-desktop-prebuild-config # Analogous to @expo/prebuild-config
├── scripts                    # Scripts that are not workspace-specific.
├── NOTES.md                              # Notes to myself. Don't edit this.
└── RELEASING.md                          # Reminder on how to release the app.
```

`expo-desktop` is written in TS for Node.js v24, using ESM, distributed as JS. `expo-desktop-config-plugins` and `expo-desktop-prebuild-config` are both written in JS, using CommonJS, with types inscribed via JSDoc (but distributed via emitting to `.d.ts` files using `node --run build`).

## Installation

```sh
pnpm install
```

## Development workflow

To run the `create-app` command locally:

```sh
cd packages/expo-desktop

# Run the `create-app` command in local dev mode (which packs the monorepo
# workspaces into tarballs for installation).
node --run start -- create-app --local-dev
```

## Developing

### Validating changes

After any change:

```sh
# 1. From the base of the monorepo, run the formatting:
node --run format

# 2. From the changed project, generate types to typecheck:
node --run build
```

### Philosophy

- Avoid pulling in new deps whenever possible; prefer to use whatever the Node.js v24 SDK includes.
- This is supposed to match the Expo CLI's behaviour as closely as possible, so don't cut corners. Study the latest Expo CLI [source](https://github.com/expo/expo/tree/main/packages/%40expo/cli) to inform changes.
