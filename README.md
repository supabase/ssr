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

## Session Initialization

By default, `createServerClient` automatically initializes the session to prevent race conditions where token refresh completes after the HTTP response has been sent. You can control this behavior with the `sessionInitialization` option:

### Auto Mode (Default - Recommended)

```typescript
import { createServerClient } from "@supabase/ssr";

const supabase = createServerClient(url, key, {
  cookies: { getAll, setAll },
  // sessionInitialization: 'auto' is the default
});
// Session automatically initialized - ready to use
```

Automatically triggers session initialization on client creation. This prevents the common error:

```
Error: Cannot use `cookies.set(...)` after the response has been generated
```

### Manual Mode (Explicit Control)

```typescript
const supabase = createServerClient(url, key, {
  cookies: { getAll, setAll },
  sessionInitialization: "manual",
});

// Only initialize when needed (e.g., for authenticated routes)
if (requiresAuth) {
  await(supabase.auth as any).initialize();
}
```

Use this mode when you want to:

- Skip initialization for public routes (better performance)
- Control exactly when initialization happens
- Conditionally initialize based on your application logic

### Disabled Mode (No Initialization)

```typescript
const supabase = createServerClient(url, key, {
  cookies: { getAll }, // Note: no setAll
  sessionInitialization: false,
});
// No initialization, read-only usage
```

Use this mode when:

- Using in read-only contexts (e.g., Next.js Server Components without `setAll`)
- Testing scenarios where you want complete control
- You're certain no token refresh is needed

### Checking Initialization Status

```typescript
// Check if initialization has completed
const isReady = (supabase.auth as any).isInitialized();
```

## Documentation

Please refer to the [official server-side rendering guides](https://supabase.com/docs/guides/auth/server-side) for the latest best practices on using this package in your SSR framework of choice.
