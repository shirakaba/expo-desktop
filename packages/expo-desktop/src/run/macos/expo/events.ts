import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const debug = require("debug") as (namespace: string) => typeof console.log;

export const debugEvent = debug("expo-desktop:export");
