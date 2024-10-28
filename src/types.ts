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

export type CookieMethodsBrowserDeprecated = {
  get: GetCookie;
  set: SetCookie;
  remove: RemoveCookie;
};

export type CookieMethodsBrowser = {
  getAll: GetAllCookies;
  setAll: SetAllCookies;
};

export type CookieMethodsServerDeprecated = {
  get: GetCookie;
  set?: SetCookie;
  remove?: RemoveCookie;
};

export type CookieMethodsServer = {
  getAll: GetAllCookies;
  setAll?: SetAllCookies;
};
