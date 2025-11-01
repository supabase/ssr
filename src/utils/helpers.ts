import type { SerializeOptions } from "cookie";
import * as cookie from "cookie";

/**
 * @deprecated Since v0.4.0: Please use {@link parseCookieHeader}. `parse` will
 * not be available for import starting v1.0.0 of `@supabase/ssr`.
 */
export const parse = cookie.parse;

/**
 * @deprecated Since v0.4.0: Please use {@link serializeCookieHeader}.
 * `serialize` will not be available for import starting v1.0.0 of
 * `@supabase/ssr`.
 */
export const serialize = cookie.serialize;

/**
 * Parses the `Cookie` HTTP header into an array of cookie name-value objects.
 *
 * @param header The `Cookie` HTTP header. Decodes cookie names and values from
 * URI encoding first.
 */
export function parseCookieHeader(
  header: string,
): { name: string; value?: string }[] {
  const parsed = cookie.parse(header);

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
  options: SerializeOptions,
): string {
  return cookie.serialize(name, value, options);
}

export function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined"
  );
}

/**
 * Returns a localStorage-like object that stores the key-value pairs in
 * memory.
 */
export function memoryLocalStorageAdapter(
  store: { [key: string]: string } = {},
) {
  return {
    getItem: (key: string) => {
      return store[key] || null;
    },

    setItem: (key: string, value: string) => {
      store[key] = value;
    },

    removeItem: (key: string) => {
      delete store[key];
    },
  };
}
