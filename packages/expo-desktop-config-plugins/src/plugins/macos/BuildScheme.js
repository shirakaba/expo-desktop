/**
 * Based on `@expo/config-plugins` BuildScheme.ts (extended for `platform: "macos"`).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/BuildScheme.ts
 */

const Paths = require("./Paths");
const Target = require("./Target");
const Xcodeproj = require("./Xcodeproj");
const { readXMLAsync } = require("@expo/config-plugins/build/utils/XML");

/**
 * @typedef {{
 *   Scheme?: {
 *     BuildAction?: Array<{
 *       BuildActionEntries?: Array<{
 *         BuildActionEntry?: BuildActionEntryType[];
 *       }>;
 *     }>;
 *     ArchiveAction?: Array<{
 *       $?: {
 *         buildConfiguration?: string;
 *       };
 *     }>;
 *   };
 * }} SchemeXML
 */

/**
 * @typedef {{
 *   BuildableReference?: Array<{
 *     $?: {
 *       BlueprintName?: string;
 *       BuildableName?: string;
 *     };
 *   }>;
 * }} BuildActionEntryType
 */

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @returns {string[]}
 */
function getSchemesFromXcodeproj(projectRoot, platform) {
  return Paths.findSchemeNames(projectRoot, platform);
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @param {{ configuration?: 'Debug' | 'Release' }} [options]
 * @returns {{ name: string; osType: string; type: string }[]}
 */
function getRunnableSchemesFromXcodeproj(projectRoot, platform, { configuration = "Debug" } = {}) {
  const project = Xcodeproj.getPbxproj(projectRoot, platform);

  return Target.findSignableTargets(project).map(([, tgt]) => {
    let osType = "iOS";
    const type = Xcodeproj.unquote(tgt.productType);

    if (type === Target.TargetType.WATCH) {
      osType = "watchOS";
    } else if (
      // (apps) com.apple.product-type.application
      // (app clips) com.apple.product-type.application.on-demand-install-capable
      // NOTE(EvanBacon): This matches against `watchOS` as well so we check for watch first.
      type.startsWith(Target.TargetType.APPLICATION)
    ) {
      // Attempt to resolve the platform SDK for each target so we can filter devices.
      const xcConfigurationList =
        project.hash.project.objects.XCConfigurationList[tgt.buildConfigurationList];

      if (xcConfigurationList) {
        const buildConfiguration =
          xcConfigurationList.buildConfigurations.find(
            /** @param {{ comment: string; value: string }} value */
            (value) => value.comment === configuration,
          ) || xcConfigurationList.buildConfigurations[0];
        if (buildConfiguration?.value) {
          const xcBuildConfiguration =
            project.hash.project.objects.XCBuildConfiguration?.[buildConfiguration.value];

          const buildSdkRoot = xcBuildConfiguration?.buildSettings.SDKROOT;
          if (
            buildSdkRoot === "appletvos" ||
            "TVOS_DEPLOYMENT_TARGET" in (xcBuildConfiguration?.buildSettings ?? {})
          ) {
            // Is a TV app...
            osType = "tvOS";
          } else if (
            buildSdkRoot === "macosx" ||
            "MACOSX_DEPLOYMENT_TARGET" in (xcBuildConfiguration?.buildSettings ?? {})
          ) {
            osType = "macOS";
          } else if (buildSdkRoot === "iphoneos") {
            osType = "iOS";
          }
        }
      }
    }

    return {
      name: Xcodeproj.unquote(tgt.name),
      osType,
      type: Xcodeproj.unquote(tgt.productType),
    };
  });
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @param {string} scheme
 * @returns {Promise<SchemeXML | undefined>}
 */
async function readSchemeAsync(projectRoot, platform, scheme) {
  const allSchemePaths = Paths.findSchemePaths(projectRoot, platform);
  // NOTE(cedric): test on POSIX or UNIX separators, where UNIX needs to be double-escaped in the template literal and regex
  const re = new RegExp(`[\\\\/]${scheme}.xcscheme`, "i");
  const schemePath = allSchemePaths.find((i) => re.exec(i));
  if (schemePath) {
    return /** @type {SchemeXML | undefined} */ (await readXMLAsync({ path: schemePath }));
  } else {
    throw new Error(`scheme '${scheme}' does not exist, make sure it's marked as shared`);
  }
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @param {string} scheme
 * @returns {Promise<string>}
 */
async function getApplicationTargetNameForSchemeAsync(projectRoot, platform, scheme) {
  const schemeXML = await readSchemeAsync(projectRoot, platform, scheme);
  const buildActionEntry =
    schemeXML?.Scheme?.BuildAction?.[0]?.BuildActionEntries?.[0]?.BuildActionEntry;
  const targetName =
    buildActionEntry?.length === 1
      ? getBlueprintName(buildActionEntry[0])
      : getBlueprintName(
          buildActionEntry?.find((entry) => {
            return entry.BuildableReference?.[0]?.["$"]?.BuildableName?.endsWith(".app");
          }),
        );
  if (!targetName) {
    throw new Error(`${scheme}.xcscheme seems to be corrupted`);
  }
  return targetName;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @param {string} scheme
 * @returns {Promise<string>}
 */
async function getArchiveBuildConfigurationForSchemeAsync(projectRoot, platform, scheme) {
  const schemeXML = await readSchemeAsync(projectRoot, platform, scheme);
  const buildConfiguration = schemeXML?.Scheme?.ArchiveAction?.[0]?.["$"]?.buildConfiguration;
  if (!buildConfiguration) {
    throw new Error(`${scheme}.xcscheme seems to be corrupted`);
  }
  return buildConfiguration;
}

/** @param {BuildActionEntryType | undefined} entry */
function getBlueprintName(entry) {
  return entry?.BuildableReference?.[0]?.["$"]?.BlueprintName;
}

exports.getApplicationTargetNameForSchemeAsync = getApplicationTargetNameForSchemeAsync;
exports.getArchiveBuildConfigurationForSchemeAsync = getArchiveBuildConfigurationForSchemeAsync;
exports.getRunnableSchemesFromXcodeproj = getRunnableSchemesFromXcodeproj;
exports.getSchemesFromXcodeproj = getSchemesFromXcodeproj;
