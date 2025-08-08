import type { SerializeOptions } from "cookie";
import { parse as cookieParse, serialize as cookieSerialize } from "cookie";

/**
 * Parses the `Cookie` HTTP header into an array of cookie name-value objects.
 *
 * @param header The `Cookie` HTTP header. Decodes cookie names and values from
 * URI encoding first.
 */
export function parseCookieHeader(
  header: string
): { name: string; value?: string }[] {
  const parsed = cookieParse(header);

  return Object.keys(parsed ?? {}).map((name) => ({
    name,
    value: parsed[name],
  }));
}

/**
 * Converts the arguments to a valid `Set-Cookie` header. Non US-ASCII chars
 * and other forbidden cookie chars will be URI encoded.
 *
 * @param name Name of cookie.
 * @param value Value of cookie.
 */
export function serializeCookieHeader(
  name: string,
  value: string,
  options: SerializeOptions
): string {
  return cookieSerialize(name, value, options);
}

export function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined"
  );
}
