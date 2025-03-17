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
) => Promise<void> | void;


export type CookieMethodsBrowser = {
  getAll: GetAllCookies;
  setAll: SetAllCookies;
  /**
   * @deprecated Please specify `getAll` methods instead of `get`. This will
   * not be supported in the next major version.
   */
  get?: GetCookie;
  /**
   * @deprecated Please specify `setAll` methods instead of `set`. This will
   * not be supported in the next major version.
   */
  set?: SetCookie;
  /**
   * @deprecated Please specify `setAll` methods instead of `remove`. This will
   * not be supported in the next major version.
   */
  remove?: RemoveCookie;
};

export type CookieMethodsServer = {
  getAll: GetAllCookies;
  setAll?: SetAllCookies;
  /**
   * @deprecated Please specify `getAll` methods instead of `get`. This will
   * not be supported in the next major version.
   */
  get?: GetCookie;
  /**
   * @deprecated Please specify `setAll` methods instead of `set`. This will
   * not be supported in the next major version.
   */
  set?: SetCookie;
  /**
   * @deprecated Please specify `setAll` methods instead of `remove`. This will
   * not be supported in the next major version.
   */
  remove?: RemoveCookie;
};
