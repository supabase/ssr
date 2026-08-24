# Supabase clients for use in SSR frameworks

> **Package Consolidation Notice**: This package replaces the deprecated `@supabase/auth-helpers-*` packages. All framework-specific auth-helpers packages have been consolidated into `@supabase/ssr` for better maintenance and consistency.

## Overview

This package provides a framework-agnostic way to use the [Supabase JavaScript library](https://supabase.com/docs/reference/javascript/introduction) in server-side rendering (SSR) frameworks.

## Installation

```bash
npm i @supabase/ssr
# or
pnpm add @supabase/ssr
# or
yarn add @supabase/ssr
# or
bun add @supabase/ssr
```

## Deprecated Packages

The following packages have been deprecated and consolidated into `@supabase/ssr`:

- `@supabase/auth-helpers-nextjs` → Use `@supabase/ssr`
- `@supabase/auth-helpers-react` → Use `@supabase/ssr`
- `@supabase/auth-helpers-remix` → Use `@supabase/ssr`
- `@supabase/auth-helpers-sveltekit` → Use `@supabase/ssr`

If you're currently using any of these packages, please update your dependencies to use `@supabase/ssr` directly.

## Documentation

Please refer to the [official server-side rendering guides](https://supabase.com/docs/guides/auth/server-side) for the latest best practices on using this package in your SSR framework of choice.

## Known patterns and limitations

For guidance on choosing between `getSession()`, `getUser()`, and `getClaims()`,
see the [official server-side rendering guides](https://supabase.com/docs/guides/auth/server-side).

### The `auth.storage` option is ignored

`createBrowserClient` and `createServerClient` always store the session in
cookies — this is the entire point of the package, since it lets a
server-rendered request read the same session the browser wrote. Passing
`auth.storage` has no effect; a one-time console warning is logged if you do. (`auth.userStorage` is different and is still respected when `cookies.encode` is set to `"tokens-only"`.) If you
don't need server-side access to the session, use `@supabase/supabase-js`'s
`createClient` directly with your own `storage` (e.g. `localStorage`) —
there's no reason to use `@supabase/ssr` in that case.

### Concurrent requests with the same expired session

Supabase refresh tokens are single-use. If two requests arrive simultaneously
with the same expired session cookie (e.g. from two browser tabs opening at
the same time), both will attempt a token refresh. The second request's
refresh will fail because the token was already consumed by the first. The
second request will receive `session: null` until the browser syncs the
updated cookie from the first response.

The **middleware pattern** mitigates this for the common case: middleware runs
once per navigation and refreshes the session before the page renders, so
subsequent requests within the same navigation see a valid token. For parallel
requests (e.g. parallel `fetch()` calls from the client), handle `null`
sessions gracefully and retry or re-authenticate as needed.

### React Router middleware

[React Router middleware](https://reactrouter.com/how-to/middleware) is stable
and is a good place to create a server Supabase client, refresh the session once
per request, and write updated auth cookies back onto the response.

```ts
// app/context.ts
import { createContext } from "react-router";
import type { SupabaseClient } from "@supabase/supabase-js";

export const supabaseContext = createContext<SupabaseClient | null>(null);
```

```ts
// app/middleware/supabase.ts
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { MiddlewareFunction } from "react-router";
import { supabaseContext } from "~/context";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Framework-mode server middleware: refresh the session before loaders/actions
 * run, then attach any Set-Cookie / cache headers to the Response.
 */
export const supabaseMiddleware: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet, headers) {
          pendingCookies.push(...cookiesToSet);
          Object.assign(pendingHeaders, headers);
        },
      },
    },
  );

  // Trigger lazy session init / refresh before any route code runs.
  await supabase.auth.getClaims();
  context.set(supabaseContext, supabase);

  const response = await next();

  for (const { name, value, options } of pendingCookies) {
    response.headers.append(
      "Set-Cookie",
      serializeCookieHeader(name, value, options),
    );
  }
  for (const [key, value] of Object.entries(pendingHeaders)) {
    response.headers.set(key, value);
  }

  return response;
};
```

Attach it on a parent route (Framework mode) so child loaders can read the client
from context:

```ts
// app/routes/home.tsx
import type { Route } from "./+types/home";
import { supabaseMiddleware } from "~/middleware/supabase";
import { supabaseContext } from "~/context";

export const middleware: Route.MiddlewareFunction[] = [supabaseMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
  const supabase = context.get(supabaseContext);
  const { data } = await supabase!.auth.getClaims();
  return { claims: data?.claims ?? null };
}
```

See also the [React Router creating-a-client examples](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
in the official SSR guides for `loader` / `action` patterns when you are not
using middleware.
