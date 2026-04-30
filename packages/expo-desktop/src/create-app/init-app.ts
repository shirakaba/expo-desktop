import { tasks } from "@clack/prompts";
import { cyan, red, yellow } from "kleur/colors";
import { spawn } from "node:child_process";
import { env } from "node:process";
import readline from "node:readline";

export async function initApp({
  name: { displayName, filesafeName, rdns },
  packageManager,
  versions: { expo, minor, mobile, windows, macos },
}: {
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
  versions: {
    minor: number;
    expo: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  const command = packageManager;
  const args = [
    "create",
    "expo-app",
    "--template",
    "blank-typescript",
    "--no-install",
    "--version",
  ];

  await tasks([
    {
      title: `⏳ Running: ${yellow(`${command} ${args.join(" ")}`)}`,
      task: async (text) => {
        const cp = spawn(command, args, { env });
        const { promise, resolve, reject } = Promise.withResolvers<void>();

        const { stdout, stderr } = cp;
        if (stdout) {
          readline
            .createInterface({ input: stdout })
            .on("line", (line) => text(`${cyan("[stdout]")} ${line}`));
        }
        if (stderr) {
          readline
            .createInterface({ input: stderr })
            .on("line", (line) => text(`${red("[stderr]")} ${line}`));
        }

        let error: Error | null = null;
        cp.on("error", (e) => {
          if (!error) {
            error = e;
          }
        });

        cp.on("close", (code, signal) => {
          if (error) {
            reject(error);
            return;
          }

          if (code !== 0) {
            reject(new Error(`Child process exited with code ${code} and signal ${signal}`));
            return;
          }

          resolve();
        });

        await promise;

        return "⌛️ Ran command.";
      },
    },
  ]);
}
