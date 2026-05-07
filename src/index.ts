// IMPORTANT: this file MUST stay free of top-level side effects so the
// package can advertise `"sideEffects": false` in package.json. Any new
// runtime initialization belongs inside a function called explicitly by a
// consumer entry point (createBrowserClient / createServerClient), not at
// module load time.

export * from "./createBrowserClient";
export * from "./createServerClient";
export * from "./types";
export * from "./utils";
export { warnIfUsingDeprecatedAuthHelpersPackage } from "./warnDeprecatedPackage";
