const { getAutolinkedPackagesAsync } = require("@expo/prebuild-config/build/getAutolinkedPackages");

// Nothing stopping us from using this for macos and windows as-is, as far as I
// can tell, so we just re-export it without modification.
// https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/prebuild-config/src/getAutolinkedPackages.ts#L15
module.exports.getAutolinkedPackagesAsync = getAutolinkedPackagesAsync;
