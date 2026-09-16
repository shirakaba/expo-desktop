import chalk from "chalk";

import { isInteractive } from "./interactive.ts";

export function logProjectLogsLocation() {
  console.log(
    chalk`\n› Logs for your project will appear below.${isInteractive() ? chalk.dim(" Press Ctrl+C to exit.") : ""}`,
  );
}
