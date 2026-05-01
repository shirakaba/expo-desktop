const fs = require("node:fs");
const path = require("node:path");
const slash = require("slash");
const Target = require("@expo/config-plugins/build/ios/Target");
const string = require("@expo/config-plugins/build/ios/utils/string");
const Xcodeproj = require("./Xcodeproj");
const macosPlugins = require("./macos-plugins");

const withAssociatedDomains = macosPlugins.createEntitlementsPlugin(
  setAssociatedDomains,
  "withAssociatedDomains",
);

function setAssociatedDomains(
  config,
  { "com.apple.developer.associated-domains": _, ...entitlementsPlist },
) {
  if (config.macos?.associatedDomains) {
    return {
      ...entitlementsPlist,
      "com.apple.developer.associated-domains": config.macos.associatedDomains,
    };
  }
  return entitlementsPlist;
}

function getEntitlementsPath(
  projectRoot,
  platform,
  { targetName, buildConfiguration = "Release" } = {},
) {
  const project = Xcodeproj.getPbxproj(projectRoot, platform);
  const xcBuildConfiguration = Target.getXCBuildConfigurationFromPbxproj(project, {
    targetName,
    buildConfiguration,
  });
  if (!xcBuildConfiguration) {
    return null;
  }
  const entitlementsPath = getEntitlementsPathFromBuildConfiguration(
    projectRoot,
    platform,
    xcBuildConfiguration,
  );
  return entitlementsPath && fs.existsSync(entitlementsPath) ? entitlementsPath : null;
}

function getEntitlementsPathFromBuildConfiguration(projectRoot, platform, xcBuildConfiguration) {
  const entitlementsPathRaw = xcBuildConfiguration?.buildSettings?.CODE_SIGN_ENTITLEMENTS;
  if (entitlementsPathRaw) {
    return path.normalize(path.join(projectRoot, platform, string.trimQuotes(entitlementsPathRaw)));
  }
  return null;
}

function ensureApplicationTargetEntitlementsFileConfigured(
  projectRoot,
  platform,
  { targetName } = {},
) {
  const project = Xcodeproj.getPbxproj(projectRoot, platform);
  const projectName = Xcodeproj.getProjectName(projectRoot, platform);
  const productName = Xcodeproj.getProductName(project);
  const [, applicationTarget] = targetName
    ? Target.findNativeTargetByName(project, targetName)
    : Target.findFirstNativeTarget(project);

  const buildConfigurations = Xcodeproj.getBuildConfigurationsForListId(
    project,
    applicationTarget.buildConfigurationList,
  );
  let hasChangesToWrite = false;
  for (const [, xcBuildConfiguration] of buildConfigurations) {
    const oldEntitlementPath = getEntitlementsPathFromBuildConfiguration(
      projectRoot,
      platform,
      xcBuildConfiguration,
    );
    if (oldEntitlementPath && fs.existsSync(oldEntitlementPath)) {
      return;
    }
    hasChangesToWrite = true;
    const entitlementsRelativePath = slash(path.join(projectName, `${productName}.entitlements`));
    const entitlementsPath = path.normalize(
      path.join(projectRoot, platform, entitlementsRelativePath),
    );
    fs.mkdirSync(path.dirname(entitlementsPath), {
      recursive: true,
    });
    if (!fs.existsSync(entitlementsPath)) {
      fs.writeFileSync(entitlementsPath, ENTITLEMENTS_TEMPLATE);
    }
    xcBuildConfiguration.buildSettings.CODE_SIGN_ENTITLEMENTS = entitlementsRelativePath;
  }
  if (hasChangesToWrite) {
    fs.writeFileSync(project.filepath, project.writeSync());
  }
}

const ENTITLEMENTS_TEMPLATE = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`;

exports.ensureApplicationTargetEntitlementsFileConfigured =
  ensureApplicationTargetEntitlementsFileConfigured;
exports.getEntitlementsPath = getEntitlementsPath;
exports.setAssociatedDomains = setAssociatedDomains;
exports.withAssociatedDomains = withAssociatedDomains;
