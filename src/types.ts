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

  /**
   * Called by the Supabase Client to write cookies to the response after a
   * token refresh or auth state change.
   *
   * **IMPORTANT:** Call `await supabase.auth.getSession()` (or `getUser()`)
   * early in your request handler — before any response is generated. If a
   * token refresh completes after the HTTP response has already been committed,
   * the updated session cannot be written here and will be lost, causing the
   * next request to refresh again.
   *
   * **CDN and reverse proxy caching.**
   *
   * Token refreshes write `Set-Cookie` headers to the response. If your app is
   * behind a CDN or reverse proxy (e.g. CloudFront, Vercel Edge, Cloudflare),
   * set `Cache-Control: private, no-store` on routes that handle authentication
   * (typically your middleware) to prevent these responses from being cached.
   *
   * **`getSession()` vs `getUser()`.**
   *
   * `getSession()` returns the session directly from cookies without contacting
   * the Supabase Auth server. The user object it contains is therefore
   * **not verified** and should not be used for authorization decisions.
   * Use `getUser()` when you need a verified user identity — it contacts the
   * Auth server on every call to validate the token.
   */
  setAll?: SetAllCookies;
};
