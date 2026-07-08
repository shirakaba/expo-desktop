const { withAppxManifest, withSln, withVcxproj, withWapproj } = require("./windows-plugins");

/**
 * @typedef {{ displayName: string; filesafeName: string; windowsNamespace: string; windowsPackageGuid: string; windowsProjectGuid: string }} TemplateVariables
 */

/**
 * A config plugin to update a React Native Windows /windows folder with
 * template
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<TemplateVariables>}
 */
function withTemplateVariables(config, props) {
  // TODO: fill in template strings for the Vcxproj:
  //       - ProjectGuid
  //       - ProjectName
  //       - RootNamespace

  console.log("sanity!");

  config = withWapproj(config, (config) =>
    updateWapprojTemplateStrings(config, {
      displayName: props.displayName,
      filesafeName: props.filesafeName,
      windowsNamespace: props.windowsNamespace,
      windowsPackageGuid: props.windowsPackageGuid,
      windowsProjectGuid: props.windowsProjectGuid,
    }),
  );

  config = withVcxproj(config, (config) =>
    updateVcxprojTemplateStrings(config, {
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

  config = withSln(config, (config) =>
    updateSlnTemplateStrings(config, {
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
 * Update the template variables in a .wapproj.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} config
 * @param {TemplateVariables} props
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
 * Update the template variables in a .vcxproj.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} config
 * @param {TemplateVariables} props
 */
function updateVcxprojTemplateStrings(
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

  // 2. Find <PropertyGroup Label="Globals">
  const PropertyGroupGlobals = Project.find(
    ({ PropertyGroup, [":@"]: attributes }) =>
      !!PropertyGroup && attributes?.["@_Label"] === "Globals",
  )?.PropertyGroup;
  if (!PropertyGroupGlobals) {
    throw new Error(
      'Expected there to be a <PropertyGroup Label="Globals"> element inside the <Project>.',
    );
  }

  // 3. Find the <ProjectGuid>
  const ProjectGuid = PropertyGroupGlobals.find(({ ProjectGuid }) => !!ProjectGuid);
  if (!ProjectGuid) {
    throw new Error(
      'Expected there to be a <ProjectGuid> element inside the <PropertyGroup Label="Globals">.',
    );
  }
  ProjectGuid.ProjectGuid = [{ "#text": `{${windowsProjectGuid.toUpperCase()}}` }];

  // 4. Find the <ProjectName>
  const ProjectName = PropertyGroupGlobals.find(({ ProjectName }) => !!ProjectName);
  if (!ProjectName) {
    throw new Error(
      'Expected there to be a <ProjectName> element inside the <PropertyGroup Label="Globals">.',
    );
  }
  ProjectName.ProjectName = [{ "#text": filesafeName }];

  // 5. Find the <RootNamespace>
  const RootNamespace = PropertyGroupGlobals.find(({ RootNamespace }) => !!RootNamespace);
  if (!RootNamespace) {
    throw new Error(
      'Expected there to be a <RootNamespace> element inside the <PropertyGroup Label="Globals">.',
    );
  }
  RootNamespace.RootNamespace = [{ "#text": windowsNamespace }];

  // 6. Find the <ItemGroup> ... <ResourceCompile>
  const ItemGroupForResourceCompile = Project.find(({ ItemGroup }) =>
    ItemGroup?.find(({ ResourceCompile }) => !!ResourceCompile),
  )?.ItemGroup;
  if (!ItemGroupForResourceCompile) {
    throw new Error(
      "Expected there to be a <ItemGroup> element inside the <Project>, with a <ResourceCompile> member.",
    );
  }

  // 7. Set the <ResourceCompile> "Include" attribute
  const ResourceCompile = ItemGroupForResourceCompile.find(
    ({ ResourceCompile, ":@": attributes }) =>
      !!ResourceCompile && attributes["@_Include"]?.endsWith(".rc"),
  );
  if (!ResourceCompile) {
    throw new Error(
      "Expected there to be at least one <ResourceCompile> child within an <ItemGroup>.",
    );
  }
  ResourceCompile[":@"]["@_Include"] = `${filesafeName}.rc`;

  // 8. Find the <ItemGroup> ... <Image>
  const ItemGroupForImage = Project.find(({ ItemGroup }) =>
    ItemGroup?.find(({ Image }) => !!Image),
  )?.ItemGroup;
  if (!ItemGroupForImage) {
    throw new Error(
      "Expected there to be a <ItemGroup> element inside the <Project>, with a <Image> member.",
    );
  }

  // 8. Find the <Image Include="MyApp.ico">
  const Image = ItemGroupForImage.filter(
    ({ Image, ":@": attributes }) =>
      !!Image &&
      attributes["@_Include"]?.endsWith(".ico") &&
      attributes["@_Include"] !== "small.ico",
  );
  if (Image.length !== 1) {
    throw new Error(
      `Expected there to be exactly two <Image> members - one which includes small.ico, and the other with a variable name based on your app. Instead, got: ${JSON.stringify(Image.map(({ ":@": attributes }) => attributes?.["@_Include"]))}`,
    );
  }
  Image[0][":@"]["@_Include"] = `${filesafeName}.ico`;

  return config;
}

/**
 * Update the ProjectGuid in a Package.appxmanifest
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} config
 * @param {TemplateVariables} props
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

/**
 * Update various fields in a MyApp.sln
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<{ path: string; contents: string; language: "text"; }>} config
 * @param {TemplateVariables} props
 */
function updateSlnTemplateStrings(
  config,
  { displayName, filesafeName, windowsNamespace, windowsPackageGuid, windowsProjectGuid },
) {
  config.modResults.contents = config.modResults.contents.replace(
    wapprojPattern,
    `Project("{C7167F0D-BC9F-4E6E-AFE1-012C56B48DB5}") = "${filesafeName}.Package", "${filesafeName}.Package\\${filesafeName}.Package.wapproj", "{${windowsPackageGuid.toUpperCase()}}"`,
  );

  config.modResults.contents = config.modResults.contents.replace(
    vcxprojPattern,
    `Project("{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}") = "${filesafeName}", "${filesafeName}\\${filesafeName}.vcxproj", "{${windowsProjectGuid.toUpperCase()}}"`,
  );

  return config;
}

const wapprojPattern =
  /Project\("{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}}"\)\s*=\s*"[a-zA-Z0-9]+\.Package",\s*"[a-zA-Z0-9]+\.Package\\[a-zA-Z0-9]+\.Package\.wapproj",\s*"{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}}"/;

const vcxprojPattern =
  /Project\("{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}}"\)\s*=\s*"[a-zA-Z0-9]+",\s*"[a-zA-Z0-9]+\\[a-zA-Z0-9]+\.vcxproj",\s*"{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}}"/;
