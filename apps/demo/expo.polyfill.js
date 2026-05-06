import { TurboModuleRegistry } from "react-native";

console.log("Running expo.polyfill.js! Before: ", globalThis.expo);

// Trigger the Initialize() method on the TurboModule.
// One day they'll support eagerInit so we can avoid this JS-land workaround.
TurboModuleRegistry.get < any > "DataMarshallingExamples";

// globalThis.expo = {};

console.log("Ran expo.polyfill.js! After: ", globalThis.expo);
