import type { SerializeOptions } from "cookie";

export type CookieOptions = Partial<SerializeOptions>;
export type CookieOptionsWithName = { name?: string } & CookieOptions;

export type GetCookie = (
  name: string,
) => Promise<string | null | undefined> | string | null | undefined;

export type SetCookie = (
  name: string,
  value: string,
  options: CookieOptions,
) => Promise<void> | void;
export type RemoveCookie = (
  name: string,
  options: CookieOptions,
) => Promise<void> | void;

export type GetAllCookies = () =>
  | Promise<{ name: string; value: string }[] | null>
  | { name: string; value: string }[]
  | null;

export type SetAllCookies = (
  cookies: { name: string; value: string; options: CookieOptions }[],
  /**
   * Headers that must be set on the HTTP response alongside the cookies.
   * Responses that set auth cookies must not be cached by CDNs or
   * reverse proxies, otherwise one user's session token can be served
   * to a different user.
   *
   * The library passes the following headers when auth cookies are set:
   * - `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`
   * - `Expires: 0`
   * - `Pragma: no-cache`
   *
   * @example
   * ```ts
   * // Next.js middleware
   * setAll(cookiesToSet, headers) {
   *   cookiesToSet.forEach(({ name, value, options }) =>
   *     response.cookies.set(name, value, options)
   *   )
   *   Object.entries(headers).forEach(([key, value]) =>
   *     response.headers.set(key, value)
   *   )
   * }
   * ```
   */
  headers: Record<string, string>,
) => Promise<void> | void;

export type CookieMethodsBrowserDeprecated = {
  get: GetCookie;
  set: SetCookie;
  remove: RemoveCookie;
};

export type CookieMethodsBrowser = {
  /**
   * If set to true, only the user's session (access and refresh tokens) will be encoded in cookies. The user object will be encoded in local storage if the `userStorage` option is not provided when creating the client.
   *
   * You should keep this option the same between `createBrowserClient()` and `createServerClient()`. When set to `tokens-only` accessing the `user` property on the data returned from `getSession()` will only be possible if the user has already been stored in the separate storage. It's best to use `getClaims()` instead to avoid surprizes.
   *
   * @experimental
   */
  encode?: "user-and-tokens" | "tokens-only";

  getAll: GetAllCookies;
  setAll: SetAllCookies;
};

export type CookieMethodsServerDeprecated = {
  get: GetCookie;
  set?: SetCookie;
  remove?: RemoveCookie;
};

export type CookieMethodsServer = {
  /**
   * If set to `tokens-only`, only the user's access and refresh tokens will be encoded in cookies. The user object will be encoded in memory if the `userStorage` option is not provided when creating the client. Unset value defaults to `user-and-tokens`.
   *
   * You should keep this option the same between `createBrowserClient()` and `createServerClient()`. When set to `tokens-only` accessing the `user` property on the data returned from `getSession()` will not be possible. Use `getUser()` or preferably `getClaims()` instead.
   *
   * @experimental
   */
  encode?: "user-and-tokens" | "tokens-only";

  getAll: GetAllCookies;
  setAll?: SetAllCookies;
};
