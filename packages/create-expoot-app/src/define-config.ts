import { type } from "arktype";
import { green, grey, yellow } from "kleur/colors";

import { Questionnaire } from "./validate-questionnaire.ts";

export function defineConfig(config: typeof Questionnaire.infer) {
  const out = Questionnaire(config);

  if (out instanceof type.errors) {
    const summary = new Array<string>();
    for (const [path, error] of Object.entries(out.byPath)) {
      const actualIndex = error.problem.lastIndexOf(" (was ");
      const problem =
        actualIndex === -1
          ? error.problem
          : `${error.problem.startsWith("must be matched by ") ? `must be matched by ${green(error.problem.slice("must be matched by ".length, actualIndex))}` : error.problem.slice(0, actualIndex)}${grey(error.problem.slice(actualIndex))}`;

      summary.push(`${yellow(path)} ${problem}`);
    }

    console.log(summary.join("\n"));
  } else {
    // hover out to see your validated data
    console.log(`Hello`, out.name);
  }
}
