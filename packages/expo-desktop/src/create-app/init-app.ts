import { log, tasks } from "@clack/prompts";
import { cyan, red, yellow } from "kleur/colors";
import { spawn } from "node:child_process";
import { env } from "node:process";
import readline from "node:readline";

export async function initApp({
  name,
  packageManager,
  versions,
}: {
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  const command = packageManager;
  const args = [
    "create",
    "expo-app",
    name.filesafeName,
    "--template",
    `blank-typescript@${versions.expoBlankTypeScript}`,
    "--no-install",
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
            .on("line", (line) => log.message(`${cyan("[stdout]")} ${line}`));
        }
        if (stderr) {
          readline
            .createInterface({ input: stderr })
            .on("line", (line) => log.message(`${red("[stderr]")} ${line}`));
        }

        let cpError: Error | null = null;
        cp.on("error", (error) => {
          if (!cpError) {
            cpError = error;
          }
        });

        cp.on("close", (code, signal) => {
          if (cpError || code !== 0) {
            reject(
              new Error(`Child process exited with code ${code} and signal ${signal}`, {
                cause: cpError,
              }),
            );
            return;
          }

          resolve();
        });

        await promise;

        return `⏳ Ran: ${yellow(`${command} ${args.join(" ")}`)}`;
      },
    },
  ]);
}
