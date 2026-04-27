import { taskLog, text, log } from "@clack/prompts";

export async function newExpoDesktopProject() {
  // taskLog({ title: "Configuring app name" });

  log.step("Configuring app name");

  const alphanumeric = await text({
    message: "Please provide the name for the app in alphanumeric format.",
    placeholder: "MyApp123",
    initialValue: "MyApp",
    validate(value) {
      if (!value?.length) {
        return "Must be at least one character long.";
      }
    },
  });
}
