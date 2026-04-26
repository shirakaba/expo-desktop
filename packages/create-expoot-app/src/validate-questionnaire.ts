import { type } from "arktype";

const Questionnaire = type({
  expoot_schema_version: "number",
  react_native_version: "string",
  android: {
    display_name: "string",
    app_id: "string",
  },
  ios: {
    display_name: "string",
    app_id: "string",
  },
  macos: {
    display_name: "string",
    app_id: "string",
  },
  windows: {
    display_name: "string",
    app_id: "string",
  },
});

// extract the type if needed
type User = typeof Questionnaire.infer;
