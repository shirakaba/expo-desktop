import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { MacOSConfig } =
  require("expo-desktop-config-plugins") as typeof import("expo-desktop-config-plugins");

export interface InlineModulesXcodeParams {
  platform: "ios" | "macos";
  watchedDirectories: Array<string>;
}

/**
 * Add watched directories as PBXFileSystemSynchronizedRootGroups to pbxproj file in the project and save the changes.
 * @see https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/inline-modules/src/xcodeProjectUpdates.ts#L12
 */
export async function updateXcodeProject({
  projectRoot,
  inlineModulesXcodeParams: { watchedDirectories: swiftWatchedDirectories, platform },
}: {
  projectRoot: string;
  inlineModulesXcodeParams: InlineModulesXcodeParams;
}): Promise<void> {
  // Only perform changes to pbxproj if necessary
  if (swiftWatchedDirectories.length === 0) {
    return;
  }

  const pbxProject = MacOSConfig.XcodeUtils.getPbxproj(projectRoot, platform);
  const mainGroupUUID = pbxProject.getFirstProject().firstProject.mainGroup;
  const mainTarget = pbxProject.getFirstProject().firstProject.targets[0];
  const objects = pbxProject.hash.project.objects;
  const projectRootRelativeToPlatform = "..";

  const fsSynchronizedRootGroups: Set<string> = new Set<string>();
  if (objects.PBXFileSystemSynchronizedRootGroup) {
    for (const key of Object.keys(objects.PBXFileSystemSynchronizedRootGroup)) {
      if (key.endsWith("_comment")) {
        continue;
      }
      fsSynchronizedRootGroups.add(objects.PBXFileSystemSynchronizedRootGroup[key].path);
    }
  } else {
    objects.PBXFileSystemSynchronizedRootGroup = {};
  }

  let projectHasChanged = false;
  for (const dir of swiftWatchedDirectories) {
    const dirRelativeToPlatform = path.join(projectRootRelativeToPlatform, dir);
    if (fsSynchronizedRootGroups.has(dirRelativeToPlatform)) {
      continue;
    }

    projectHasChanged = true;

    const newUUID = pbxProject.generateUuid();
    objects.PBXGroup[mainGroupUUID].children.push({
      value: newUUID,
      comment: dir,
    });

    objects.PBXFileSystemSynchronizedRootGroup[newUUID] = {
      isa: "PBXFileSystemSynchronizedRootGroup",
      explicitFileTypes: {},
      explicitFolders: [],
      name: dir,
      path: dirRelativeToPlatform,
      sourceTree: "SOURCE_ROOT",
    };

    if (mainTarget) {
      const nativeTargetGroup = objects.PBXNativeTarget[mainTarget.value];
      if (!nativeTargetGroup.fileSystemSynchronizedGroups) {
        nativeTargetGroup.fileSystemSynchronizedGroups = [];
      }
      nativeTargetGroup.fileSystemSynchronizedGroups.push({ value: newUUID, comment: dir });
    }
  }

  if (projectHasChanged) {
    await fs.promises.writeFile(pbxProject.filepath, pbxProject.writeSync());
  }
}
