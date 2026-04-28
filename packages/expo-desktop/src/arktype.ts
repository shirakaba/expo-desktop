import { ArkErrors } from "arktype";
import { green, grey, yellow } from "kleur/colors";

export function makePrettySummary({ byPath }: ArkErrors) {
  const summary = new Array<string>();

  for (const [path, error] of Object.entries(byPath)) {
    const actualIndex = error.problem.lastIndexOf(" (was ");
    const problem =
      actualIndex === -1
        ? error.problem
        : `${error.problem.startsWith("must be matched by ") ? `must be matched by ${green(error.problem.slice("must be matched by ".length, actualIndex))}` : error.problem.slice(0, actualIndex)}${grey(error.problem.slice(actualIndex))}`;

    summary.push(`${yellow(path)} ${problem}`);
  }

  return summary;
}
