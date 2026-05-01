import { log } from "@clack/prompts";
import { yellow } from "kleur/colors";
import { spawn, type StdioOptions } from "node:child_process";
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

  console.log(`└  ⏳ Running: ${yellow(`${command} ${args.join(" ")}`)}\n`);

  const stdio: StdioOptions = "inherit";
  const cp = spawn(command, args, {
    env,
    stdio,
  });

  if (stdio !== "inherit") {
    const { stdout, stderr } = cp;
    if (stdout) {
      readline
        .createInterface({ input: stdout })
        .on("line", (line) => log.message(line, { spacing: 0 }));
    }
    if (stderr) {
      readline
        .createInterface({ input: stderr })
        .on("line", (line) => log.message(line, { spacing: 0 }));
    }
  }

  let cpError: Error | null = null;
  cp.on("error", (error) => {
    if (!cpError) {
      cpError = error;
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  cp.on("close", (code, signal) => {
    if (cpError || code !== 0) {
      reject(
        new Error(`Exited with code ${code} (signal ${signal})`, cpError ? { cause: cpError } : {}),
      );
      return;
    }

    resolve();
  });

  try {
    await promise;
  } catch (error) {
    log.error(
      `Error running ${yellow("create expo-app")}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  log.message(`⏳ Ran: ${yellow(`${command} ${args.join(" ")}`)}`);
}
