// https://github.com/expo/expo/blob/sdk-52/packages/%40expo/config-plugins/src/plugins/withIosBaseMods.ts

const path = require("node:path");
const {
  default: fs,
  promises: { readFile, writeFile },
} = require("node:fs");
const assert = require("node:assert");
const {
  BaseMods: { withGeneratedBaseMods, provider },
} = require("@expo/config-plugins");
const { getNativeTargets } = require("@expo/config-plugins/build/ios/Target");
const plist = require("@expo/plist");
const { default: JsonFile } = require("@expo/json-file");
const { project: xcodeProject } = require("xcode");
const Entitlements = require("./Entitlements");
const { getInfoPlistPathFromPbxproj } = require("./getInfoPlistPath");
const Paths = require("./Paths");
const { getPbxproj } = require("./Xcodeproj");
const { createFileResolver } = require("./_utils/files");
const { fileExists } = require("./_utils/modules");
const sortObject = require("./_utils/sortObject");
const { addWarningMacOS } = require("./_utils/warnings");

const resolveViewControllerPath = createFileResolver({
  ignoredPaths: [],
  addWarning: addWarningMacOS,
});

function getEntitlementsPlistTemplate() {
  // TODO: Fetch the versioned template file if possible
  return {};
}

function getInfoPlistTemplate() {
  // TODO: Fetch the versioned template file if possible
  return {
    CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
    CFBundleExecutable: "$(EXECUTABLE_NAME)",
    CFBundleIconFile: "",
    CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
    CFBundleName: "$(PRODUCT_NAME)",
    CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
    CFBundleInfoDictionaryVersion: "6.0",
    // CFBundleShortVersionString: '1.0',
    // CFBundleVersion: '1',
    LSMinimumSystemVersion: "$(MACOSX_DEPLOYMENT_TARGET)",
    NSAppTransportSecurity: {
      NSAllowsArbitraryLoads: true,
      NSExceptionDomains: {
        localhost: {
          NSExceptionAllowsInsecureHTTPLoads: true,
        },
      },
    },
    NSMainStoryboardFile: "Main",
    NSPrincipalClass: "NSApplication",
    NSSupportsAutomaticTermination: true,
    NSSupportsSuddenTermination: true,
  };
}

/**
 * @type {Partial<Record<string, import("@expo/config-plugins/build/plugins/createBaseMod").BaseModProviderMethods<any, any>>>}
 */
const defaultProviders = {
  dangerous: provider({
    getFilePath() {
      return "";
    },
    async read() {
      return {};
    },
    async write() {},
  }),
  finalized: provider({
    getFilePath() {
      return "";
    },
    async read() {
      return {};
    },
    async write() {},
  }),
  // Append a rule to supply AppDelegate data to mods on `mods.macos.appDelegate`
  appDelegate: provider({
    getFilePath({ modRequest: { projectRoot } }) {
      return Paths.getAppDelegateFilePath(projectRoot, "macos");
    },
    async read(filePath) {
      return Paths.getFileInfo(filePath);
    },
    async write(filePath, { modResults: { contents } }) {
      await writeFile(filePath, contents);
    },
  }),
  viewController: provider({
    getFilePath({ modRequest: { projectRoot } }) {
      return resolveViewControllerPath({
        tag: "view-controller",
        fileName: "ViewController.m",
        globPattern: "macos/**/ViewController.m",
        projectRoot,
      });
    },
    async read(filePath) {
      return Paths.getFileInfo(filePath);
    },
    async write(filePath, { modResults: { contents } }) {
      await writeFile(filePath, contents);
    },
  }),
  // Append a rule to supply Expo.plist data to mods on `mods.macos.expoPlist`
  expoPlist: provider({
    isIntrospective: true,
    getFilePath({ modRequest: { platformProjectRoot, projectName } }) {
      const supportingDirectory = path.join(platformProjectRoot, projectName, "Supporting");
      return path.resolve(supportingDirectory, "Expo.plist");
    },
    async read(filePath, { modRequest: { introspect } }) {
      try {
        return plist.parse(await readFile(filePath, "utf8"));
      } catch (error) {
        if (introspect) {
          return {};
        }
        throw error;
      }
    },
    async write(filePath, { modResults, modRequest: { introspect } }) {
      if (introspect) {
        return;
      }
      await writeFile(filePath, plist.build(sortObject(modResults)));
    },
  }),
  // Append a rule to supply .xcodeproj data to mods on `mods.macos.xcodeproj`
  xcodeproj: provider({
    getFilePath({ modRequest: { projectRoot } }) {
      return Paths.getPBXProjectPath(projectRoot, "macos");
    },
    async read(filePath) {
      const project = xcodeProject(filePath);
      project.parseSync();
      return project;
    },
    async write(filePath, { modResults }) {
      await writeFile(filePath, modResults.writeSync());
    },
  }),
  // Append a rule to supply Info.plist data to mods on `mods.macos.infoPlist`
  infoPlist: provider({
    isIntrospective: true,
    async getFilePath(config) {
      let project = null;
      try {
        project = getPbxproj(config.modRequest.projectRoot, "macos");
      } catch {
        // noop
      }

      // Only check / warn if a project actually exists, this'll provide
      // more accurate warning messages for users in managed projects.
      if (project) {
        const targetName = getMacOSTargetName(project);
        // FIXME: There's a potential bug in the implementation.
        // "…/macos/AppName-macOS/Info.plist"
        // … gets lowercased to:
        // "…/macos/AppName-macos/Info.plist"
        // This may be of no consequence on case-insensitive file systems, but
        // it depends what's downstream of all this.
        const infoPlistBuildProperty = getInfoPlistPathFromPbxproj(project, "macos", {
          targetName,
        });
        if (infoPlistBuildProperty) {
          //: [root]/myapp/macos/MyApp/Info.plist
          const infoPlistPath = path.join(
            //: myapp/macos
            config.modRequest.platformProjectRoot,
            //: MyApp/Info.plist
            infoPlistBuildProperty,
          );
          if (fileExists(infoPlistPath)) {
            return infoPlistPath;
          }
          addWarningMacOS(
            "mods.macos.infoPlist",
            `Info.plist file linked to Xcode project does not exist: ${infoPlistPath}`,
          );
        } else {
          addWarningMacOS(
            "mods.macos.infoPlist",
            "Failed to find Info.plist linked to Xcode project.",
          );
        }
      }
      try {
        // Fallback on glob...
        return await Paths.getInfoPlistPath(config.modRequest.projectRoot, "macos");
      } catch (error) {
        if (config.modRequest.introspect) {
          // fallback to an empty string in introspection mode.
          return "";
        }
        throw error;
      }
    },
    async read(filePath, config) {
      // Apply all of the Info.plist values to the expo.macos.infoPlist object
      // TODO: Remove this in favor of just overwriting the Info.plist with the Expo object. This will enable people to actually remove values.
      if (!config.macos) config.macos = {};
      if (!config.macos.infoPlist) config.macos.infoPlist = {};
      let modResults;
      try {
        const contents = await readFile(filePath, "utf8");
        assert(contents, "Info.plist is empty");
        modResults = plist.parse(contents);
      } catch (error) {
        // Throw errors in introspection mode.
        if (!config.modRequest.introspect) {
          throw error;
        }
        // Fallback to using the infoPlist object from the Expo config.
        modResults = getInfoPlistTemplate();
      }
      config.macos.infoPlist = {
        ...(modResults || {}),
        ...config.macos.infoPlist,
      };
      return config.macos.infoPlist;
    },
    async write(filePath, config) {
      // Update the contents of the static infoPlist object
      if (!config.macos) {
        config.macos = {};
      }
      config.macos.infoPlist = config.modResults;

      // Return early without writing, in introspection mode.
      if (config.modRequest.introspect) {
        return;
      }
      await writeFile(filePath, plist.build(sortObject(config.modResults)));
    },
  }),
  // Append a rule to supply .entitlements data to mods on `mods.macos.entitlements`
  entitlements: provider({
    isIntrospective: true,
    async getFilePath(config) {
      try {
        const project = getPbxproj(config.modRequest.projectRoot, "macos");
        const targetName = getMacOSTargetName(project);

        // We've forked this function so that it takes a targetName.
        Entitlements.ensureApplicationTargetEntitlementsFileConfigured(
          config.modRequest.projectRoot,
          "macos",
          { targetName },
        );

        return (
          Entitlements.getEntitlementsPath(config.modRequest.projectRoot, "macos", {
            targetName,
          }) ?? ""
        );
      } catch (error) {
        if (config.modRequest.introspect) {
          // fallback to an empty string in introspection mode.
          return "";
        }
        throw error;
      }
    },
    async read(filePath, config) {
      let modResults;
      try {
        if (!config.modRequest.ignoreExistingNativeFiles && fs.existsSync(filePath)) {
          const contents = await readFile(filePath, "utf8");
          assert(contents, "Entitlements plist is empty");
          modResults = plist.parse(contents);
        } else {
          modResults = getEntitlementsPlistTemplate();
        }
      } catch (error) {
        // Throw errors in introspection mode.
        if (!config.modRequest.introspect) {
          throw error;
        }
        // Fallback to using the template file.
        modResults = getEntitlementsPlistTemplate();
      }

      // Apply all of the .entitlements values to the expo.macos.entitlements object
      // TODO: Remove this in favor of just overwriting the .entitlements with the Expo object. This will enable people to actually remove values.
      if (!config.macos) config.macos = {};
      if (!config.macos.entitlements) config.macos.entitlements = {};
      config.macos.entitlements = {
        ...(modResults || {}),
        ...config.macos.entitlements,
      };
      return config.macos.entitlements;
    },
    async write(filePath, config) {
      // Update the contents of the static entitlements object
      if (!config.macos) {
        config.macos = {};
      }
      config.macos.entitlements = config.modResults;

      // Return early without writing, in introspection mode.
      if (config.modRequest.introspect) {
        return;
      }
      await writeFile(filePath, plist.build(sortObject(config.modResults)));
    },
  }),
  podfile: provider({
    getFilePath({ modRequest: { projectRoot } }) {
      return Paths.getPodfilePath(projectRoot, "macos");
    },
    // @ts-expect-error
    async read(filePath) {
      // Note(cedric): this file is ruby, which is a 1-value subset of AppleLanguage and fails the type check
      return Paths.getFileInfo(filePath);
    },
    async write(filePath, { modResults: { contents } }) {
      await writeFile(filePath, contents);
    },
  }),
  // Append a rule to supply Podfile.properties.json data to mods on `mods.macos.podfileProperties`
  podfileProperties: provider({
    isIntrospective: true,
    getFilePath({ modRequest: { platformProjectRoot } }) {
      return path.resolve(platformProjectRoot, "Podfile.properties.json");
    },
    async read(filePath) {
      let results = {};
      try {
        results = await JsonFile.readAsync(filePath);
      } catch {}
      return results;
    },
    async write(filePath, { modResults, modRequest: { introspect } }) {
      if (introspect) {
        return;
      }
      await JsonFile.writeAsync(filePath, modResults);
    },
  }),
};

/**
 * @param {Parameters<typeof getNativeTargets>[0]} project
 */
function getMacOSTargetName(project) {
  // react-native-macos projects begin with "-iOS" and "-macOS" targets.
  // Unfortunately, the "-iOS" target is the first (and thus the default
  // one picked up by getInfoPlistPathFromPbxproj). Here, we narrow down
  // to the target whose name ends with "-macOS" as a best-of-a-bad-job.
  // In future, it would be nice to find some feature of the target that
  // definitively indicates an AppKit app to be less fragile to custom
  // projects.

  /** @type {Array<string>} */
  const nativeTargetNames = getNativeTargets(project).map(([, { name }]) => JSON.parse(name));
  return nativeTargetNames.find((name) => name.endsWith("-macOS"));
}

/**
 * A port of withIosBaseMods() to macOS.
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/config-plugins/src/plugins/withIosBaseMods.ts#L321
 *
 * Used by the Expo CLI to get the ProjectConfig (the top level of the app.json)
 * @see https://github.com/expo/expo/blob/b7362a90eb6a28eb56ab4880248690c61bac01ed/packages/%40expo/cli/src/config/configAsync.ts#L58
 *
 * This unit test shows that it, being a base mod, should be added after plugins
 * like withEntitlementsPlist(), and then evalModsAsync() should be called on
 * it:
 * @see https://github.com/expo/expo/blob/b7362a90eb6a28eb56ab4880248690c61bac01ed/packages/%40expo/config-plugins/src/plugins/__tests__/withIosBaseMods-test.ts#L28
 *
 * It should be possible to run `npx expo config` to trigger configAsync() which
 * calls getPrebuildConfigAsync() under-the-hood.
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/cli/src/config/index.ts#L44
 *
 * The actual entrypoint for `npx expo prebuild` is here:
 * [@expo/cli/src/prebuild/configureProjectAsync.ts] configureProjectAsync() >
 * [@expo/prebuild-config/src/getPrebuildConfig.ts] getPrebuildConfigAsync() >
 * [@expo/prebuild-config/src/getPrebuildConfig.ts] getPrebuildConfig() >
 * [@expo/prebuild-config/src/plugins/withDefaultPlugins.ts] withIosExpoPlugins()
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/cli/src/prebuild/configureProjectAsync.ts#L37
 *
 * After getting the prebuildConfig via getPrebuildConfig() as described above,
 * the next step of `npx expo prebuild` is to run compileModsSync(), which then
 * runs withDefaultBaseMods() > withIosBaseMods() to update the config, then
 * runs evalModsAsync().
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/cli/src/prebuild/configureProjectAsync.ts#L50
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/config-plugins/src/plugins/mod-compiler.ts#L69
 */
function withMacosBaseMods(config, { providers, ...props } = {}) {
  return withGeneratedBaseMods(config, {
    ...props,
    platform: "macos",
    providers: providers ?? getMacosModFileProviders(),
  });
}

function getMacosModFileProviders() {
  return defaultProviders;
}

exports.withMacosBaseMods = withMacosBaseMods;
exports.getMacosModFileProviders = getMacosModFileProviders;
