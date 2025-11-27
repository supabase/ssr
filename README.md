# ⚠️ DEPRECATED - DO NOT USE

**This package is deprecated and no longer maintained.**

This is the **FINAL version (0.15.0)**. No further updates will be published.

## Please migrate to `@supabase/ssr`

```bash
npm uninstall @supabase/auth-helpers-nextjs
npm install @supabase/ssr
```

📚 **Migration guide:** https://supabase.com/docs/guides/auth/server-side/overview

---

# Supabase clients for use in SSR frameworks

> **Package Consolidation Notice**: The `@supabase/ssr` package replaces the deprecated `@supabase/auth-helpers-*` packages. All framework-specific auth-helpers packages have been consolidated into `@supabase/ssr` for better maintenance and consistency.

## Overview

The `@supabase/ssr` package provides a framework-agnostic way to use the [Supabase JavaScript library](https://supabase.com/docs/reference/javascript/introduction) in server-side rendering (SSR) frameworks.

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
