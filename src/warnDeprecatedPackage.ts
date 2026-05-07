let warned = false;

const DEPRECATED_PACKAGES = [
  "@supabase/auth-helpers-nextjs",
  "@supabase/auth-helpers-react",
  "@supabase/auth-helpers-remix",
  "@supabase/auth-helpers-sveltekit",
];

export function warnIfUsingDeprecatedAuthHelpersPackage(): void {
  if (warned) {
    return;
  }

  if (typeof process === "undefined" || !process.env?.npm_package_name) {
    return;
  }

  const packageName = process.env.npm_package_name;
  if (!DEPRECATED_PACKAGES.includes(packageName)) {
    return;
  }

  warned = true;
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
