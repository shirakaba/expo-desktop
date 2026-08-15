import { blue, yellow } from "kleur/colors";

export function previewFileTree({ filesafeName, rdns }: { filesafeName: string; rdns: string }) {
  const colouredFilesafeName = yellow(filesafeName);

  return `
${colouredFilesafeName}
├── …
├── ${blue("android")}
│   ├── …
│   └── app
│       ├── …
│       └── src
│           └── main
│               ├── …
│               └── java
${`${rdns.replaceAll("-", "_")}.…`
  .split(".")
  .map((segment, i, arr) => {
    return `│                  ${new Array(i * 4).fill(" ").join("")} └── ${i === arr.length - 1 ? segment : yellow(segment)}`;
  })
  .join("\n")}
├── ${blue("ios")}
│   ├── …
│   ├── ${colouredFilesafeName}
│   │   └── …
│   ├── ${colouredFilesafeName}.xcodeproj
│   └── ${colouredFilesafeName}.xcworkspace
├── ${blue("macos")}
│   ├── …
│   ├── ${colouredFilesafeName}-macOS
│   │   └── …
│   ├── ${colouredFilesafeName}.xcodeproj
│   └── ${colouredFilesafeName}.xcworkspace
└── ${blue("windows")}
    ├── …
    ├── MyApp
    │   ├── …
    │   ├── MyApp.cpp
    │   ├── MyApp.h
    │   ├── MyApp.ico
    │   ├── MyApp.rc
    │   ├── MyApp.vcxproj
    │   └── MyApp.vcxproj.filters
    ├── MyApp.Package
    │   ├── …
    │   └── MyApp.Package.wapproj
    └── MyApp.sln
`.trim();
}
