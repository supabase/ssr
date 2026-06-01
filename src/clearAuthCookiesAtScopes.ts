import { DEFAULT_COOKIE_OPTIONS, isChunkLike } from "./utils";
import type { CookieOptions, GetAllCookies, SetAllCookies } from "./types";

/**
 * One-shot helper to clear Supabase auth cookies at one or more explicit
 * scopes. Use after a deploy that changes cookie `Domain`, `Path`, or other
 * scope-affecting options, to remove stale cookies that the runtime `signOut`
 * cannot reach because they live at a different scope.
 *
 * The helper issues a `Set-Cookie` with `Max-Age=0` for every known chunk of
 * the given `storageKey` at each scope. The browser silently ignores
 * `Set-Cookie` attempts for scopes the current host doesn't own, so passing
 * more scopes than necessary is safe — only the ones that actually held
 * stale cookies will have any observable effect.
 *
 * For the common host-only -> parent-domain migration, this helper is not
 * required: `signOut` already clears the host-only counterpart automatically
 * when `cookieOptions.domain` is set on the current client.
 *
 * @example
 *   // After migrating from `.foo.com` to `.bar.com`:
 *   await clearAuthCookiesAtScopes({
 *     getAll,
 *     setAll,
 *     storageKey: 'sb-<project-ref>-auth-token',
 *     scopes: [{ domain: '.foo.com' }],
 *   });
 *
 * @example
 *   // Path migration from `/app` to `/`:
 *   await clearAuthCookiesAtScopes({
 *     getAll,
 *     setAll,
 *     storageKey: 'sb-<project-ref>-auth-token',
 *     scopes: [{ path: '/app' }],
 *   });
 */
export async function clearAuthCookiesAtScopes(input: {
  getAll: (keyHints: string[]) => ReturnType<GetAllCookies>;
  setAll: SetAllCookies;
  storageKey: string;
  scopes: Array<Partial<CookieOptions>>;
}): Promise<void> {
  const { getAll, setAll, storageKey, scopes } = input;

  if (scopes.length === 0) {
    return;
  }

  const allCookies = (await getAll([storageKey])) ?? [];
  const chunkNames = allCookies
    .map(({ name }) => name)
    .filter((name) => isChunkLike(name, storageKey));

  if (chunkNames.length === 0) {
    return;
  }

  const toSet = scopes.flatMap((scope) => {
    const cookieOptions = {
      ...DEFAULT_COOKIE_OPTIONS,
      ...scope,
      maxAge: 0,
    };

    // Same NextJS cookieStore guard as createStorageFromOptions.
    delete (cookieOptions as { name?: string }).name;

    return chunkNames.map((name) => ({
      name,
      value: "",
      options: cookieOptions,
    }));
  });

  await setAll(toSet, {});
}
