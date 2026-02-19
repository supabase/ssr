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

## Documentation

Please refer to the [official server-side rendering guides](https://supabase.com/docs/guides/auth/server-side) for the latest best practices on using this package in your SSR framework of choice.

## Known patterns and limitations

### `getSession()` vs `getUser()` vs `getClaims()`

`getSession()` returns the session directly from cookies — no network call is
made. The user object it contains is **not verified by the Auth server** and
must not be used for authorization decisions; a malicious client could craft a
cookie with a spoofed user ID. **Do not use `getSession()` for authorization decisions.**

`getClaims()` validates the access token either locally (using the project's
JWKS endpoint for asymmetric keys) or by calling the Auth server, and returns
the verified JWT claims. Use it when you need to gate access to resources but
don't need a fresh user record from the database.

`getUser()` contacts the Supabase Auth server on every call and returns the
most up-to-date user record, including any changes made since the token was
issued. Use it when you need fresh user data (e.g. checking current roles,
email, or whether the session is still active server-side).

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
