# Supabase clients for use in SSR frameworks

> **Package Consolidation Notice**: This package replaces the deprecated `@supabase/auth-helpers-*` packages. All framework-specific auth-helpers packages have been consolidated into `@supabase/ssr` for better maintenance and consistency.

## Overview

This package provides a framework-agnostic way to use the [Supabase JavaScript library](https://supabase.com/docs/reference/javascript/introduction) in server-side rendering (SSR) frameworks.

## Installation

```bash
npm i @supabase/ssr
```

## Deprecated Packages

The following packages have been deprecated and consolidated into `@supabase/ssr`:

- `@supabase/auth-helpers-nextjs` → Use `@supabase/ssr`
- `@supabase/auth-helpers-react` → Use `@supabase/ssr`
- `@supabase/auth-helpers-remix` → Use `@supabase/ssr`
- `@supabase/auth-helpers-sveltekit` → Use `@supabase/ssr`

If you're currently using any of these packages, please update your dependencies to use `@supabase/ssr` directly.

## Preventing Race Conditions with Session Initialization

To prevent race conditions where token refresh completes after the HTTP response has been sent, explicitly initialize the session early in your request handler:

```typescript
import { createServerClient } from "@supabase/ssr";

// Create the client
const supabase = createServerClient(url, key, {
  cookies: { getAll, setAll },
});

// Explicitly initialize to ensure token refresh completes before response
await supabase.auth.initialize();
```

This prevents the common error:

```
Error: Cannot use `cookies.set(...)` after the response has been generated
```

### Framework Examples

**SvelteKit** (`hooks.server.ts`):

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(url, key, {
    cookies: { getAll: () => event.cookies.getAll(), setAll: (cookies) => { ... } }
  });

  // Initialize before processing request
  await event.locals.supabase.auth.initialize();

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    },
  });
};
```

**Next.js** (middleware or route handlers):

```typescript
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => { ... } }
  });

  // Initialize before continuing
  await supabase.auth.initialize();

  // ... rest of middleware
}
```

**OAuth Callback Routes:**

For OAuth callback routes, skip initialization in your global middleware and only call `initialize()` or handle `exchangeCodeForSession()` in the callback route itself to avoid double initialization:

```typescript
// In hooks/middleware - skip callback routes
if (!event.url.pathname.startsWith("/auth/callback")) {
  await event.locals.supabase.auth.initialize();
}

// In /auth/callback route
export async function GET({ url, locals: { supabase } }) {
  const code = url.searchParams.get("code");
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
  return redirect(303, "/dashboard");
}
```

### When to Use `initialize()`

Call `await supabase.auth.initialize()`:

- **Early in request handlers** (middleware, hooks, server-side route handlers) before the response is generated
- **For authenticated routes** where token refresh might be needed
- **Skip for OAuth callback routes** that use `exchangeCodeForSession()` to avoid double initialization

You can check initialization status:

```typescript
const isInitialized = supabase.auth.isInitialized();
```

### How It Works

The `@supabase/ssr` package prevents race conditions by:

1. **Setting `skipAutoInitialize: true`** on the underlying auth client to prevent automatic initialization in the constructor
2. **Providing controlled initialization** through the `initialize()` method that you can call at the right time in your request lifecycle
3. **Ensuring token refresh completes** before your HTTP response is sent, preventing "cookies.set() after response" errors

This approach gives you full control over when session initialization occurs, which is critical in SSR environments where timing matters.

## Documentation

Please refer to the [official server-side rendering guides](https://supabase.com/docs/guides/auth/server-side) for the latest best practices on using this package in your SSR framework of choice.
