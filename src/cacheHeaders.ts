/** Prevent shared caches from storing responses that change auth cookies. */
export function getAuthCookieCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    Expires: "0",
    Pragma: "no-cache",
  };
}
