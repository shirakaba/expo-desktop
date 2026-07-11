const os = require("node:os");
const { withAppxManifest, withSln, withVcxproj, withWapproj } = require("./windows-plugins");

/**
 * @typedef {{ displayName: string; filesafeName: string; windowsNamespace: string; windowsPackageGuid: string; windowsProjectGuid: string }} CommonTemplateVariables
 * @typedef {CommonTemplateVariables & updateAppxManifestTemplateStringsTemplateVariables} TemplateVariables
 */

/**
 * A config plugin to update a React Native Windows /windows folder with
 * template
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<TemplateVariables>}
 */
function withTemplateVariables(config, props) {
  // We pass "MyApp" as the filesafe name because the template overuses it,
  // renaming files like MyApp.cpp to `${filesafeName}.cpp` for no real benefit.
  // By keeping the names stable as MyApp, we can avoid desyncs between dirty
  // prebuilds (which don't rename files) and clean prebuilds (which do).

  config = withWapproj(config, (config) =>
    updateWapprojTemplateStrings(config, {
      displayName: props.displayName,
      filesafeName: "MyApp",
      windowsNamespace: props.windowsNamespace,
      windowsPackageGuid: props.windowsPackageGuid,
      windowsProjectGuid: props.windowsProjectGuid,
    }),
  );

  config = withVcxproj(config, (config) =>
    updateVcxprojTemplateStrings(config, {
      displayName: props.displayName,
      filesafeName: "MyApp",
      windowsNamespace: props.windowsNamespace,
      windowsPackageGuid: props.windowsPackageGuid,
      windowsProjectGuid: props.windowsProjectGuid,
    }),
  );

  config = withAppxManifest(config, (config) =>
    updateAppxManifestTemplateStrings(config, {
      displayName: props.displayName,
      description: props.description,
      filesafeName: "MyApp",
      executableName: props.executableName
        ? props.executableName
        : props.filesafeName
          ? `${props.filesafeName}.exe`
          : undefined,
      entrypoint: props.entrypoint,
      publisherDisplayName: props.publisherDisplayName,
      version: props.version,
      minVersionUwp: props.minVersionUwp,
      minVersionWin32: props.minVersionWin32,
      maxVersionTestedUwp: props.maxVersionTestedUwp,
      maxVersionTestedWin32: props.maxVersionTestedWin32,
      windowsNamespace: props.windowsNamespace,
      windowsPackageGuid: props.windowsPackageGuid,
      windowsProjectGuid: props.windowsProjectGuid,
    }),
  );

  config = withSln(config, (config) =>
    updateSlnTemplateStrings(config, {
      displayName: props.displayName,
      filesafeName: "MyApp",
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
 * @param {CommonTemplateVariables} props
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
 * @param {CommonTemplateVariables} props
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
 * @typedef {{ description?: string | undefined; executableName?: string | undefined; entrypoint?: string | undefined; publisherDisplayName?: string | undefined; version?: WindowsVersion | undefined; minVersionUwp?: WindowsVersion | undefined; minVersionWin32?: WindowsVersion | undefined; maxVersionTestedUwp?: WindowsVersion | undefined; maxVersionTestedWin32?: WindowsVersion | undefined }} updateAppxManifestTemplateStringsTemplateVariables
 * @typedef {`${number}.${number}.${number}.0`} WindowsVersion
 */

/**
 * Update template strings and other properties in a Package.appxmanifest
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} config
 * @param {CommonTemplateVariables & updateAppxManifestTemplateStringsTemplateVariables} props
 */
function updateAppxManifestTemplateStrings(
  config,
  {
    displayName,
    filesafeName,
    publisherDisplayName,
    description,
    executableName,
    entrypoint,
    version,
    minVersionUwp,
    minVersionWin32,
    maxVersionTestedUwp,
    maxVersionTestedWin32,
    windowsNamespace,
    windowsPackageGuid,
    windowsProjectGuid,
  },
) {
  const resolvedPublisherDisplayName = publisherDisplayName ?? os.userInfo().username;

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
  if (!Identity[":@"]) {
    Identity[":@"] = {};
  }
  Identity[":@"]["@_Name"] = filesafeName;
  Identity[":@"]["@_Publisher"] = `CN=${resolvedPublisherDisplayName}`;
  if (version) {
    Identity[":@"]["@_Version"] = version;
  } else {
    Identity[":@"]["@_Version"] = "1.0.0.0";
  }

  const Properties = Package.find(({ Properties }) => Properties)?.Properties;
  if (!Properties) {
    throw new Error("Expected there to be a <Properties> element inside the <Package>.");
  }

  const DisplayNameIndex = Properties.findIndex(({ DisplayName }) => !!DisplayName);
  if (DisplayNameIndex === -1) {
    Properties.unshift({ ["#text"]: "\n    " }, { DisplayName: [{ ["#text"]: displayName }] });
  } else {
    Properties[DisplayNameIndex].DisplayName = [{ ["#text"]: displayName }];
  }

  const PublisherDisplayNameIndex = Properties.findIndex(
    ({ PublisherDisplayName }) => !!PublisherDisplayName,
  );
  if (PublisherDisplayNameIndex === -1) {
    Properties.unshift(
      { ["#text"]: "\n    " },
      { PublisherDisplayName: [{ ["#text"]: resolvedPublisherDisplayName }] },
    );
  } else {
    Properties[PublisherDisplayNameIndex].PublisherDisplayName = [
      { ["#text"]: resolvedPublisherDisplayName },
    ];
  }

  const Dependencies = Package.find(({ Dependencies }) => Dependencies)?.Dependencies;
  if (!Dependencies) {
    throw new Error("Expected there to be a <Dependencies> element inside the <Package>.");
  }

  const TargetDeviceFamilyUWP = Dependencies.find(
    ({ TargetDeviceFamily, [":@"]: attributes }) =>
      !!TargetDeviceFamily && attributes?.["@_Name"] === "Windows.Universal",
  );
  const TargetDeviceFamilyWin32 = Dependencies.find(
    ({ TargetDeviceFamily, [":@"]: attributes }) =>
      !!TargetDeviceFamily && attributes?.["@_Name"] === "Windows.Desktop",
  );
  if (minVersionUwp) {
    if (!TargetDeviceFamilyUWP[":@"]) {
      TargetDeviceFamilyUWP[":@"] = {};
    }
    TargetDeviceFamilyUWP[":@"]["@_MinVersion"] = minVersionUwp;
  }
  if (maxVersionTestedUwp) {
    if (!TargetDeviceFamilyUWP[":@"]) {
      TargetDeviceFamilyUWP[":@"] = {};
    }
    TargetDeviceFamilyUWP[":@"]["@_MaxVersionTested"] = maxVersionTestedUwp;
  }
  if (minVersionWin32) {
    if (!TargetDeviceFamilyWin32[":@"]) {
      TargetDeviceFamilyWin32[":@"] = {};
    }
    TargetDeviceFamilyWin32[":@"]["@_MinVersion"] = minVersionWin32;
  }
  if (maxVersionTestedWin32) {
    if (!TargetDeviceFamilyWin32[":@"]) {
      TargetDeviceFamilyWin32[":@"] = {};
    }
    TargetDeviceFamilyWin32[":@"]["@_MaxVersionTested"] = maxVersionTestedWin32;
  }

  const Applications = Package.find(({ Applications }) => Applications)?.Applications;
  if (!Applications) {
    throw new Error("Expected there to be a <Applications> element inside the <Package>.");
  }

  const Application = Applications.find(({ Application }) => !!Application)?.Application;
  if (!Application) {
    throw new Error("Expected there to be an <Application> element inside the <Applications>.");
  }
  if (!Application[":@"]) {
    Application[":@"] = {};
  }
  if (executableName) {
    Application[":@"]["@_Executable"] = executableName;
  } else {
    Application[":@"]["@_Executable"] = "$targetnametoken$.exe";
  }
  if (entrypoint) {
    Application[":@"]["@_EntryPoint"] = entrypoint;
  } else {
    Application[":@"]["@_EntryPoint"] = "$targetentrypoint$";
  }

  const VisualElements = Application.find(
    ({ "uap:VisualElements": VisualElements }) => !!VisualElements,
  );
  if (!VisualElements) {
    throw new Error(
      "Expected there to be a <uap:VisualElements> element inside the <Application>.",
    );
  }
  if (!VisualElements[":@"]) {
    VisualElements[":@"] = {};
  }
  VisualElements[":@"]["@_DisplayName"] = displayName;
  VisualElements[":@"]["@_Description"] = description ?? displayName;

  return config;
}

/**
 * Update various fields in a MyApp.sln
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<{ path: string; contents: string; language: "text"; }>} config
 * @param {CommonTemplateVariables} props
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
