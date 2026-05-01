function withSortedGlobResult(glob) {
  return glob.sort((a, b) => a.localeCompare(b));
}

exports.withSortedGlobResult = withSortedGlobResult;
