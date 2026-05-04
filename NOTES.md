# React Native Desktop

My handbook: https://gist.github.com/shirakaba/6ac4f941efe3366ef4e116084282bffb

# React Native Windows

- `init-windows` docs: https://microsoft.github.io/react-native-windows/docs/next/init-windows-cli
- `cpp-app` template: https://github.com/microsoft/react-native-windows/tree/main/vnext/templates/cpp-app
- https://github.com/microsoft/react-native-windows/blob/ea0dd896aa971eae765c50c0f6963e5cefba2237/vnext/templates/cpp-app/template.config.js#L29-L42

# app.json

- Implementation: https://github.com/expo/expo/blob/30bd598fa9e9b7f9412d8308d6abad2a7b7eec82/packages/%40expo/config/src/Config.ts#L468-L472

TODO: Work out what slug is for. I see it's used in `expo-module-template` for `metro.config.js`: https://github.com/expo/expo/blob/2878a2d39325b54c8d10b04c01b40be626ce42e1/packages/expo-module-template/example/metro.config.js#L23

# Dependency management

Not sure how best to proceed. The `expo-desktop` CLI depends on:

- Expo SDK-linked deps:
  - `@expo/config`
  - `@expo/config-plugins`
- Our own forks:
  - `expo-desktop-prebuild-config`
    - `expo-desktop-config-plugins`

If we use dynamic imports, we can resolve the version of the `@expo/*` deps provided by the project itself, but then that means we can only run prebuild after the user has installed `expo` into their deps. I'm not sure whether `@expo/cli` has such a restriction, so it feels a shame.

Not to mention, while dynamic imports may be doable for `expo-desktop` which uses `@expo/*` deps lightly, for `expo-desktop-config-plugins`, it would really turn our implementation upside-down.

While we could do our `dependencies` like this to depend on both and select at runtime:

```json
{
  "@expo/config-plugins-54": "npm:@expo/config-plugins@54",
  "@expo/config-plugins-55": "npm:@expo/config-plugins@55"
}
```

... it feels like a lot of headache compared to just settling on one.

I feel that although config plugins and prebuild-related logic is released in lockstep with the SDK, there's usually nothing wrong with just using the latest implementation. So maybe we just bundle the latest and greatest?
