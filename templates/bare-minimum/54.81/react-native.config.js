// Prevent the React Native Community CLI from trying to autolink bare-minimum.
// We add it as a dependency to blank-typescript to avoid complicating our build
// procedure (Expo distribute bare-minimum as a tarball inside the "expo"
// package), but when we run `rnc-cli windows`, it gets mistakenly detected as
// a package to be autolinked.
module.exports = {
  dependency: {
    platforms: {
      ios: null,
      android: null,
      macos: null,
      windows: null,
    },
  },
};
