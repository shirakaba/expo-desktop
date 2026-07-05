const { withWapproj } = require("./windows-plugins");

/**
 * A config plugin to update a React Native Windows /windows folder with
 * template
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; filesafeName?: string | undefined; }>}
 */
function withTemplateVariables(config, props) {
  config = withWapproj(config, (config) =>
    updateProjProps(config, {
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
 * @param {{ windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; filesafeName?: string | undefined; }} props
 */
function updateProjProps(config, { windowsNamespace, windowsPackageGuid, windowsProjectGuid }) {
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
