/** Determine if a string is a valid URL, can optionally ensure certain protocols (like `https` or `exp`) are adhered to. */
export function validateUrl(
  urlString: string,
  {
    protocols,
    requireProtocol,
  }: {
    /** Set of allowed protocols for the string to adhere to. @example ['exp', 'https'] */
    protocols?: string[];
    /** Ensure the URL has a protocol component (prefix before `://`). */
    requireProtocol?: boolean;
  } = {},
) {
  try {
    const results = new URL(urlString);
    if (!results.protocol && !requireProtocol) {
      return true;
    }
    return protocols
      ? results.protocol
        ? protocols.map((x) => `${x.toLowerCase()}:`).includes(results.protocol)
        : false
      : true;
  } catch {
    return false;
  }
}
