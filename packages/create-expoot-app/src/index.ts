import fs from "node:fs/promises";
import path from "node:path";
import toml from "toml";

const questionnaire = await fs.readFile(
  path.resolve(import.meta.dirname, "questionnaire.toml"),
  "utf-8",
);

const parsed = toml.parse(questionnaire);
console.log(parsed);
