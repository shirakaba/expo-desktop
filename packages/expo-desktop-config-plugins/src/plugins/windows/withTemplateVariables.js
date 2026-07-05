const { withAppxManifest, withWapproj } = require("./windows-plugins");

/**
 * A config plugin to update a React Native Windows /windows folder with
 * template
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName?: string | undefined; filesafeName?: string | undefined; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; }>}
 */
function withTemplateVariables(config, props) {
  config = withWapproj(config, (config) =>
    updateProjTemplateStrings(config, {
      displayName: props.displayName,
      filesafeName: props.filesafeName,
      windowsNamespace: props.windowsNamespace,
      windowsPackageGuid: props.windowsPackageGuid,
      windowsProjectGuid: props.windowsProjectGuid,
    }),
  );

  config = withAppxManifest(config, (config) =>
    updateAppxManifestTemplateStrings(config, {
      displayName: props.displayName,
      filesafeName: props.filesafeName,
      windowsNamespace: props.windowsNamespace,
      windowsPackageGuid: props.windowsPackageGuid,
      windowsProjectGuid: props.windowsProjectGuid,
    }),
  );

  return config;
}
module.exports.withTemplateVariables = withTemplateVariables;

/**
 * Update the ProjectGuid in a .vcxproj or .wapproj.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} config
 * @param {{ displayName?: string | undefined; filesafeName?: string | undefined; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; }} props
 */
function updateProjTemplateStrings(
  config,
  { windowsNamespace, windowsPackageGuid, windowsProjectGuid },
) {
  // 1. Find <Project>
  if (!Array.isArray(config.modResults)) {
    throw new Error("Expected parsed XML to be an array.");
  }
  const projectContainer = config.modResults.find((element) => "Project" in element);
  if (!projectContainer) {
    throw new Error("Expected parsed XML contain a <Project> element.");
  }
  const { Project } = projectContainer;
  if (!Array.isArray(Project)) {
    throw new Error("Expected <Project> element to be an array.");
  }

  const PropertyGroupForProjectGuid = Project.find(({ PropertyGroup }) =>
    PropertyGroup?.find(({ ProjectGuid }) => !!ProjectGuid),
  );
  if (!PropertyGroupForProjectGuid) {
    throw new Error(
      "Expected there to be a <PropertyGroup> element inside the <Project>, with a <ProjectGuid> member.",
    );
  }

  const ChildWithProjectGuid = PropertyGroupForProjectGuid.PropertyGroup?.find(
    ({ ProjectGuid }) => !!ProjectGuid,
  );
  if (!ChildWithProjectGuid) {
    throw new Error("Expected there to be a <ProjectGuid> child within the <PropertyGroup>.");
  }

  ChildWithProjectGuid.ProjectGuid = [{ "#text": windowsProjectGuid.toLowerCase() }];

  return config;
}

/**
 * Update the ProjectGuid in a Package.appxmanifest
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} config
 * @param {{ displayName?: string | undefined; filesafeName?: string | undefined; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; }} props
 */
function updateAppxManifestTemplateStrings(
  config,
  { displayName, filesafeName, windowsNamespace, windowsPackageGuid, windowsProjectGuid },
) {
  // 1. Find <Package>
  if (!Array.isArray(config.modResults)) {
    throw new Error("Expected parsed XML to be an array.");
  }
  const packageContainer = config.modResults.find((element) => "Package" in element);
  if (!packageContainer) {
    throw new Error("Expected parsed XML contain a <Package> element.");
  }
  const { Package } = packageContainer;
  if (!Array.isArray(Package)) {
    throw new Error("Expected <Package> element to be an array.");
  }

  const Identity = Package.find(({ Identity }) => Identity);
  if (!Identity) {
    throw new Error("Expected there to be an <Identity> element inside the <Package>.");
  }
  Identity[":@"]["@_Name"] = filesafeName;

  const Properties = Package.find(({ Properties }) => Properties)?.Properties;
  if (!Properties) {
    throw new Error("Expected there to be a <Properties> element inside the <Package>.");
  }

  let DisplayNameIndex = Properties.findIndex(({ DisplayName }) => !!DisplayName);
  if (DisplayNameIndex === -1) {
    Properties.unshift({ ["#text"]: "\n    " }, { DisplayName: [{ ["#text"]: displayName }] });
  } else {
    Properties[DisplayNameIndex].DisplayName = [{ ["#text"]: displayName }];
  }

  return config;
}
