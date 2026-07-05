const { withAppxManifest, withWapproj } = require("./windows-plugins");

/**
 * A config plugin to update a React Native Windows /windows folder with
 * template
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName?: string | undefined; filesafeName?: string | undefined; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; }>}
 */
function withTemplateVariables(config, props) {
  // TODO: fill in template strings for the Vcxproj:
  //       - ProjectGuid
  //       - ProjectName
  //       - RootNamespace

  config = withWapproj(config, (config) =>
    updateWapprojTemplateStrings(config, {
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
function updateWapprojTemplateStrings(
  config,
  { filesafeName, windowsNamespace, windowsPackageGuid, windowsProjectGuid },
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

  // 2. Find <PropertyGroup> ... <ProjectGuid>
  const PropertyGroupForProjectGuid = Project.find(({ PropertyGroup }) =>
    PropertyGroup?.find(({ ProjectGuid }) => !!ProjectGuid),
  );
  if (!PropertyGroupForProjectGuid) {
    throw new Error(
      "Expected there to be a <PropertyGroup> element inside the <Project>, with a <ProjectGuid> member.",
    );
  }

  // 3. Find the <ProjectGuid>
  const ChildWithProjectGuid = PropertyGroupForProjectGuid.PropertyGroup?.find(
    ({ ProjectGuid }) => !!ProjectGuid,
  );
  if (!ChildWithProjectGuid) {
    throw new Error("Expected there to be a <ProjectGuid> child within the <PropertyGroup>.");
  }
  // Although the field is called ProjectGuid, this is the WAP project, so it's
  // the "package" GUID we want in this case.
  ChildWithProjectGuid.ProjectGuid = [{ "#text": windowsPackageGuid.toLowerCase() }];

  // 4. Find <PropertyGroup> ... <EntryPointProjectUniqueName>
  const PropertyGroupForEntryPoint = Project.find(({ PropertyGroup }) =>
    PropertyGroup?.find(({ EntryPointProjectUniqueName }) => !!EntryPointProjectUniqueName),
  );
  if (!PropertyGroupForEntryPoint) {
    throw new Error(
      "Expected there to be a <PropertyGroup> element inside the <Project>, with a <EntryPointProjectUniqueName> member.",
    );
  }

  // 5. Find the <EntryPointProjectUniqueName>
  const ChildWithEntryPoint = PropertyGroupForProjectGuid.PropertyGroup?.find(
    ({ EntryPointProjectUniqueName }) => !!EntryPointProjectUniqueName,
  );
  if (!ChildWithEntryPoint) {
    throw new Error(
      "Expected there to be a <EntryPointProjectUniqueName> child within the <PropertyGroup>.",
    );
  }
  ChildWithEntryPoint.EntryPointProjectUniqueName = [
    { "#text": `..\\${filesafeName}\\${filesafeName}.vcxproj` },
  ];

  // 6. Find <ItemGroup> ... <ProjectReference>
  const ItemGroupForProjectReference = Project.find(({ ItemGroup }) =>
    ItemGroup?.find(({ ProjectReference }) => !!ProjectReference),
  );
  if (!ItemGroupForProjectReference) {
    throw new Error(
      "Expected there to be a <ItemGroup> element inside the <Project>, with a <ProjectReference> member.",
    );
  }

  // 7. Filter all <ProjectReference> elements
  const ChildrenWithProjectReference = ItemGroupForProjectReference.ItemGroup?.filter(
    ({ ProjectReference }) => !!ProjectReference,
  );
  if (!ChildrenWithProjectReference.length) {
    throw new Error(
      "Expected there to be at least one <ProjectReference> child within an <ItemGroup>.",
    );
  }
  for (const child of ChildrenWithProjectReference) {
    child[":@"]["@_Include"] = `..\\${filesafeName}\\${filesafeName}.vcxproj`;
  }

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
