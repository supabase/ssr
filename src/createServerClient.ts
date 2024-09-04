import {
  AuthChangeEvent,
  createClient,
  SupabaseClient,
} from "@supabase/supabase-js";
import type {
  GenericSchema,
  SupabaseClientOptions,
} from "@supabase/supabase-js/dist/module/lib/types";

import { VERSION } from "./version";
import { createStorageFromOptions, applyServerStorage } from "./cookies";
import type {
  CookieOptionsWithName,
  CookieMethodsServer,
  CookieMethodsServerDeprecated,
} from "./types";

/**
 * @deprecated Please specify `getAll` and `setAll` cookie methods instead of
 * the `get`, `set` and `remove`. These will not be supported in the next major
 * version.
 */
export function createServerClient<
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
  options: SupabaseClientOptions<SchemaName> & {
    cookieOptions?: CookieOptionsWithName;
    cookies: CookieMethodsServerDeprecated;
    cookieEncoding?: "raw" | "base64url";
  },
): SupabaseClient<Database, SchemaName, Schema>;

/**
 * Creates a Supabase Client for use on the server-side of a server-side
 * rendering (SSR) framework.
 *
 * There are two categories of uses for this function: use in middlewares and
 * use in pages, components or routes.
 *
 * **Use in middlewares.**
 *
 * Middlewares are functions that run before any rendering logic is executed on
 * the server-side. They typically have access to request headers (cookies) and
 * can modify both the request and response headers.
 *
 * In most SSR frameworks, to use Supabase correctly you *must set up a
 * middleware* and use this function in it.
 *
 * When using this in a middleware, the `cookie` option must be configured to
 * use both `getAll` and `setAll`. Alternatively you can use the `get`, `set`
 * and `remove` functions. The latter are deprecated **and not recommended**
 * for most use cases due to being difficult to use properly and they do not
 * cover important edge cases. In future major versions of the library, the
 * option to configure `get`, `set` and `remove` will be removed.
 *
 * **IMPORTANT:** Failing to implement `getAll` and `setAll` correctly (or the
 * deprecated `get`, `set` and `remove`) including omitting them **will cause
 * significant and difficult to debug authentication issues**. They will
 * manifest as: random logouts, early session termination, JSON parsing errors,
 * increased number of refresh token requests, or relying on garbage state.
 *
 * **Use in pages, components or routes.**
 *
 * To use Supabase features server-side rendered in pages, components or routes
 * (a.k.a. actions / APIs) you must create a client with this function. Not all
 * frameworks allow the ability to set cookies or response headers when pages
 * or components are rendered. In those cases you _can omit `setAll` (or the
 * deprecated `set`, `remove`) cookie option methods_. **It is strongly
 * recommended that if the ability to set cookies and response headers is
 * present, you should configure the `setAll` (or the deprecated `set` and
 * `remove`) cookie access methods.**
 *
 * **IMPORTANT:** If the ability to set cookies or response headers is not
 * available **middleware or an equivalent must be used.** Failing to do this
 * will cause significant and difficult to debug authentication issues.
 *
 * When `setAll` (or the deprecated `set`, `remove`) cookie methods are not
 * configured, the Supabase Client will emit a warning if it is used in a way
 * that requires setting cookies. If you see this warning, it usually means
 * that you are using the Supabase Client in a wrong way:
 *
 * - You should have, but did not configure a middleware client.
 * - There is a bug in your middleware function.
 * - You are using features of the Supabase Client that change the User, e.g.
 *   by calling `supabase.auth.updateUser()` on the server.
 *
 * Please consult the latest Supabase guides for advice on how to avoid common
 * pitfalls depending on SSR framework.
 *
 * @param supabaseUrl The URL of the Supabase project.
 * @param supabaseKey The `anon` API key of the Supabase project.
 * @param options Various configuration options.
 */
export function createServerClient<
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
  options: SupabaseClientOptions<SchemaName> & {
    cookieOptions?: CookieOptionsWithName;
    cookies: CookieMethodsServer;
    cookieEncoding?: "raw" | "base64url";
  },
): SupabaseClient<Database, SchemaName, Schema>;

export function createServerClient<
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
  options: SupabaseClientOptions<SchemaName> & {
    cookieOptions?: CookieOptionsWithName;
    cookies: CookieMethodsServer | CookieMethodsServerDeprecated;
    cookieEncoding?: "raw" | "base64url";
  },
): SupabaseClient<Database, SchemaName, Schema> {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `Your project's URL and Key are required to create a Supabase client!\n\nCheck your Supabase project's API settings to find these values\n\nhttps://supabase.com/dashboard/project/_/settings/api`,
    );
  }

  const { storage, getAll, setAll, setItems, removedItems } =
    createStorageFromOptions(
      {
        ...options,
        cookieEncoding: options?.cookieEncoding ?? "base64url",
      },
      true,
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
        ...(options?.cookieOptions?.name
          ? { storageKey: options.cookieOptions.name }
          : null),
        ...options?.auth,
        flowType: "pkce",
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
        storage,
      },
    },
  );

  client.auth.onAuthStateChange(async (event: AuthChangeEvent) => {
    // The SIGNED_IN event is fired very often, but we don't need to
    // apply the storage each time it fires, only if there are changes
    // that need to be set -- which is if setItems / removeItems have
    // data.
    const hasStorageChanges =
      Object.keys(setItems).length > 0 || Object.keys(removedItems).length > 0;

    if (
      hasStorageChanges &&
      (event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_OUT" ||
        event === "MFA_CHALLENGE_VERIFIED")
    ) {
      await applyServerStorage(
        { getAll, setAll, setItems, removedItems },
        {
          cookieOptions: options?.cookieOptions ?? null,
          cookieEncoding: options?.cookieEncoding ?? "base64url",
        },
      );
    }
  });

  return client;
}
