// Check if this package is being used as one of the deprecated auth-helpers packages
if (typeof process !== "undefined" && process.env?.npm_package_name) {
  const packageName = process.env.npm_package_name;
  const deprecatedPackages = [
    "@supabase/auth-helpers-nextjs",
    "@supabase/auth-helpers-react",
    "@supabase/auth-helpers-remix",
    "@supabase/auth-helpers-sveltekit",
  ];

  if (deprecatedPackages.includes(packageName)) {
    console.warn(`
╔════════════════════════════════════════════════════════════════════════════╗
║ ⚠️  IMPORTANT: Package Consolidation Notice                                ║
║                                                                            ║
║ The ${packageName.padEnd(35)} package name is deprecated.  ║
║                                                                            ║
║ You are now using @supabase/ssr - a unified solution for all frameworks.  ║
║                                                                            ║
║ The auth-helpers packages have been consolidated into @supabase/ssr       ║
║ to provide better maintenance and consistent APIs across frameworks.      ║
║                                                                            ║
║ Please update your package.json to use @supabase/ssr directly:            ║
║   npm uninstall ${packageName.padEnd(42)} ║
║   npm install @supabase/ssr                                               ║
║                                                                            ║
║ For more information, visit:                                              ║
║ https://supabase.com/docs/guides/auth/server-side                         ║
╚════════════════════════════════════════════════════════════════════════════╝
    `);
  }
}

export * from "./createBrowserClient";
export * from "./createServerClient";
export * from "./types";
export * from "./utils";
