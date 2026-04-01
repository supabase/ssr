import {
  AuthChangeEvent,
  createClient,
  SupabaseClient,
  SupabaseClientOptions,
} from "@supabase/supabase-js";

import { VERSION } from "./version";
import { createStorageFromOptions, applyServerStorage } from "./cookies";
import type {
  CookieOptionsWithName,
  CookieMethodsServer,
  CookieMethodsServerDeprecated,
} from "./types";
import { memoryLocalStorageAdapter } from "./utils/helpers";

/**
 * @deprecated Please specify `getAll` and `setAll` cookie methods instead of
 * the `get`, `set` and `remove`. These will not be supported in the next major
 * version.
 */
export function createServerClient<
  Database = any,
  SchemaName extends string &
    keyof Omit<Database, "__InternalSupabase"> = "public" extends keyof Omit<
    Database,
    "__InternalSupabase"
  >
    ? "public"
    : string & keyof Omit<Database, "__InternalSupabase">,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options: SupabaseClientOptions<SchemaName> & {
    cookieOptions?: CookieOptionsWithName;
    cookies: CookieMethodsServerDeprecated;
    cookieEncoding?: "raw" | "base64url";
  },
): SupabaseClient<Database, SchemaName>;

/**
 * Creates a Supabase Client for use on the server-side of a server-side
 * rendering (SSR) framework.
 *
 * **Use in middlewares.**
 *
 * Middlewares are functions that run before any rendering logic and can
 * inspect and modify both the incoming request and the outgoing response. In
 * most SSR frameworks you *must set up a middleware* and call this function
 * in it. The `cookies` option must implement both `getAll` **and** `setAll`
 * so that token refreshes can be written back to the response. The deprecated
 * `get`, `set`, and `remove` methods are not recommended — they miss
 * important edge cases and will be removed in a future major version.
 *
 * **IMPORTANT:** Failing to implement `getAll` and `setAll` correctly **will
 * cause significant and difficult to debug authentication issues**: random
 * logouts, early session termination, JSON parsing errors, increased refresh
 * token requests, or relying on garbage state.
 *
 * **Use in pages, routes or components.**
 *
 * *Always* create a new client with this function for each server render —
 * never share a client across requests. Not all frameworks allow setting
 * cookies or response headers from pages, routes or components — in those
 * cases `setAll` can be omitted, but configure it if you can.
 *
 * **IMPORTANT:** If cookies cannot be set from pages or components,
 * middleware *must* handle session updates — omitting it will cause
 * significant and difficult to debug authentication issues.
 *
 * If `setAll` is not configured, the client emits a warning when it needs to
 * write cookies. This usually means one of:
 *
 * - A middleware client was not configured.
 * - There is a bug in your middleware.
 * - You are calling `supabase.auth.updateUser()` server-side.
 *
 * Please consult the [Supabase SSR guides](https://supabase.com/docs/guides/auth/server-side)
 * for your framework.
 *
 * **Session initialization.**
 *
 * This client uses lazy session initialization (`skipAutoInitialize: true`).
 * The session is not loaded until the first call to `getSession()` or
 * `getUser()`. Token refreshes write the updated session back to cookies via
 * the `setAll` handler.
 *
 * @param supabaseUrl The URL of the Supabase project.
 * @param supabaseKey The `anon` API key of the Supabase project.
 * @param options Various configuration options.
 */
export function createServerClient<
  Database = any,
  SchemaName extends string &
    keyof Omit<Database, "__InternalSupabase"> = "public" extends keyof Omit<
    Database,
    "__InternalSupabase"
  >
    ? "public"
    : string & keyof Omit<Database, "__InternalSupabase">,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options: SupabaseClientOptions<SchemaName> & {
    cookieOptions?: CookieOptionsWithName;
    cookies: CookieMethodsServer;
    cookieEncoding?: "raw" | "base64url";
  },
): SupabaseClient<Database, SchemaName>;

export function createServerClient<
  Database = any,
  SchemaName extends string &
    keyof Omit<Database, "__InternalSupabase"> = "public" extends keyof Omit<
    Database,
    "__InternalSupabase"
  >
    ? "public"
    : string & keyof Omit<Database, "__InternalSupabase">,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options: SupabaseClientOptions<SchemaName> & {
    cookieOptions?: CookieOptionsWithName;
    cookies: CookieMethodsServer | CookieMethodsServerDeprecated;
    cookieEncoding?: "raw" | "base64url";
  },
): SupabaseClient<Database, SchemaName> {
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

  const client = createClient<Database, SchemaName>(supabaseUrl, supabaseKey, {
    // TODO: resolve type error
    ...(options as any),
    global: {
      ...options?.global,
      headers: {
        ...options?.global?.headers,
        "X-Client-Info": `supabase-ssr/${VERSION} createServerClient`,
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
      skipAutoInitialize: true,
      storage,
      ...(options?.cookies &&
      "encode" in options.cookies &&
      options.cookies.encode === "tokens-only"
        ? {
            userStorage:
              options?.auth?.userStorage ?? memoryLocalStorageAdapter(),
          }
        : null),
    },
  });

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
