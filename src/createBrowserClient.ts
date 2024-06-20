import { parse, serialize } from "cookie";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  GenericSchema,
  SupabaseClientOptions,
} from "@supabase/supabase-js/dist/module/lib/types";

import { VERSION } from "./version";
import {
  DEFAULT_COOKIE_OPTIONS,
  combineChunks,
  createChunks,
  deleteChunks,
  isBrowser,
  isChunkLike,
} from "./utils";

import type {
  CookieMethodsBrowser,
  CookieMethodsBrowserDeprecated,
  CookieOptions,
  CookieOptionsWithName,
  GetAllCookies,
  SetAllCookies,
} from "./types";

import { createStorageFromOptions } from "./cookies";

let cachedBrowserClient: SupabaseClient<any, any, any> | undefined;

/**
 * Creates a Supabase Client for use in a browser environment.
 *
 * In most cases you should not configure the `options.cookies` object, as this
 * is automatically handled for you. If you do customize this, prefer using the
 * `getAll` and `setAll` functions over `get`, `set` and `remove`. The latter
 * are deprecated due to being difficult to correctly implement and not
 * supporting some edge-cases. Both `getAll` and `setAll` (or both `get`, `set`
 * and `remove`) must be provided. Failing to provide the methods for setting
 * will throw an exception, and in previous versions of the library will result
 * in difficult to debug authentication issues such as random logouts, early
 * session termination or problems with inconsistent state.
 *
 * @param supabaseUrl The URL of the Supabase project.
 * @param supabaseKey The `anon` API key of the Supabase project.
 * @param options Various configuration options.
 */
export function createBrowserClient<
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<SchemaName> & {
    cookies?: CookieMethodsBrowser;
    cookieOptions?: CookieOptionsWithName;
    cookieEncoding?: "raw" | "base64url";
    isSingleton?: boolean;
  },
): SupabaseClient<Database, SchemaName, Schema>;

/**
 * @deprecated Please specify `getAll` and `setAll` cookie methods instead of
 * the `get`, `set` and `remove`. These will not be supported in the next major
 * version.
 */
export function createBrowserClient<
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<SchemaName> & {
    cookies: CookieMethodsBrowserDeprecated;
    cookieOptions?: CookieOptionsWithName;
    cookieEncoding?: "raw" | "base64url";
    isSingleton?: boolean;
  },
): SupabaseClient<Database, SchemaName, Schema>;

export function createBrowserClient<
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<SchemaName> & {
    cookies?: CookieMethodsBrowser | CookieMethodsBrowserDeprecated;
    cookieOptions?: CookieOptionsWithName;
    cookieEncoding?: "raw" | "base64url";
    isSingleton?: boolean;
  },
): SupabaseClient<Database, SchemaName, Schema> {
  // singleton client is created only if isSingleton is set to true, or if isSingleton is not defined and we detect a browser
  const shouldUseSingleton =
    options?.isSingleton === true ||
    ((!options || !("isSingleton" in options)) && isBrowser());

  if (shouldUseSingleton && cachedBrowserClient) {
    return cachedBrowserClient;
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\nCheck your Supabase project's API settings to find these values\n\nhttps://supabase.com/dashboard/project/_/settings/api`,
    );
  }

  const { storage } = createStorageFromOptions(
    {
      ...options,
      cookieEncoding: options?.cookieEncoding ?? "base64url",
    },
    false,
  );

  const client = createClient<Database, SchemaName, Schema>(
    supabaseUrl,
    supabaseKey,
    {
      ...options,
      global: {
        ...options?.global,
        headers: {
          ...options?.global?.headers,
          "X-Client-Info": `supabase-ssr/${VERSION}`,
        },
      },
      auth: {
        ...options?.auth,
        ...(options?.cookieOptions?.name
          ? { storageKey: options.cookieOptions.name }
          : null),
        flowType: "pkce",
        autoRefreshToken: isBrowser(),
        detectSessionInUrl: isBrowser(),
        persistSession: true,
        storage,
      },
    },
  );

  if (shouldUseSingleton) {
    cachedBrowserClient = client;
  }

  return client;
}
