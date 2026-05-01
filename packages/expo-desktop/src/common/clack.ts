import { log, type LogMessageOptions } from "@clack/prompts";
import kleur from "kleur";

export function title(text: string, opts?: LogMessageOptions) {
  const { spacing, ...rest } = opts ?? {};

  log.info(kleur.bold(kleur.inverse(`  ${text}  `)), { withGuide: false, ...rest });
  if (opts?.spacing) {
    log.message("", { withGuide: false, spacing: Math.max(0, opts.spacing - 1) });
  }
}
