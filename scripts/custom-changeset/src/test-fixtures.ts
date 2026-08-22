import fs from "node:fs/promises";
import path from "node:path";

const templateFixtures = [
  {
    relativeDir: "templates/bare-minimum/54.81",
    packageJson: {
      name: "expo-desktop-template-bare-minimum",
      version: "54.81.0",
      dependencies: {
        "expo-desktop-prebuild-config": "~1.0.0",
      },
    },
  },
  {
    relativeDir: "templates/blank-typescript/54.81",
    packageJson: {
      name: "expo-desktop-template-blank-typescript",
      version: "54.81.0",
      dependencies: {
        "expo-desktop-prebuild-config": "~1.0.0",
        "expo-desktop-template-bare-minimum": "~54.81.0",
      },
    },
  },
  {
    relativeDir: "templates/bare-minimum/55.82",
    packageJson: {
      name: "expo-desktop-template-bare-minimum",
      version: "55.82.0",
      dependencies: {
        "expo-desktop-prebuild-config": "~1.0.0",
      },
    },
  },
  {
    relativeDir: "templates/blank-typescript/55.82",
    packageJson: {
      name: "expo-desktop-template-blank-typescript",
      version: "55.82.0",
      dependencies: {
        "expo-desktop-prebuild-config": "~1.0.0",
        "expo-desktop-template-bare-minimum": "~55.82.0",
      },
    },
  },
] as const;

export async function writeTemplateFixtures(rootDir: string): Promise<void> {
  for (const template of templateFixtures) {
    const dir = path.join(rootDir, template.relativeDir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "package.json"),
      `${JSON.stringify(template.packageJson, undefined, 2)}\n`,
    );
  }
}
