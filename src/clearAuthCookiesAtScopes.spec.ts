import { describe, expect, it } from "vitest";

import { DEFAULT_COOKIE_OPTIONS } from "./utils";
import { CookieOptions } from "./types";

import { clearAuthCookiesAtScopes } from "./clearAuthCookiesAtScopes";

describe("clearAuthCookiesAtScopes", () => {
  it("is a no-op when no scopes are provided", async () => {
    const setAllCalls: unknown[] = [];

    await clearAuthCookiesAtScopes({
      getAll: async () => [{ name: "storage-key", value: "value" }],
      setAll: async (setCookies) => {
        setAllCalls.push(...setCookies);
      },
      storageKey: "storage-key",
      scopes: [],
    });

    expect(setAllCalls).toEqual([]);
  });

  it("is a no-op when no chunks match the storage key", async () => {
    const setAllCalls: unknown[] = [];

    await clearAuthCookiesAtScopes({
      getAll: async () => [{ name: "unrelated-cookie", value: "ignored" }],
      setAll: async (setCookies) => {
        setAllCalls.push(...setCookies);
      },
      storageKey: "storage-key",
      scopes: [{ domain: ".example.com" }],
    });

    expect(setAllCalls).toEqual([]);
  });

  it("emits one Set-Cookie per chunk × scope", async () => {
    const setAllCalls: {
      name: string;
      value: string;
      options: CookieOptions;
    }[] = [];

    await clearAuthCookiesAtScopes({
      getAll: async () => [
        { name: "storage-key", value: "value" },
        { name: "storage-key.0", value: "chunk-0" },
        { name: "storage-key.1", value: "chunk-1" },
        { name: "unrelated", value: "ignored" },
      ],
      setAll: async (setCookies) => {
        setAllCalls.push(...setCookies);
      },
      storageKey: "storage-key",
      scopes: [{ domain: ".foo.com" }, { domain: ".bar.com" }],
    });

    const fooOptions = {
      ...DEFAULT_COOKIE_OPTIONS,
      domain: ".foo.com",
      maxAge: 0,
    };
    const barOptions = {
      ...DEFAULT_COOKIE_OPTIONS,
      domain: ".bar.com",
      maxAge: 0,
    };

    expect(setAllCalls).toEqual([
      { name: "storage-key", value: "", options: fooOptions },
      { name: "storage-key.0", value: "", options: fooOptions },
      { name: "storage-key.1", value: "", options: fooOptions },
      { name: "storage-key", value: "", options: barOptions },
      { name: "storage-key.0", value: "", options: barOptions },
      { name: "storage-key.1", value: "", options: barOptions },
    ]);
  });

  it("supports path-only scopes (no domain)", async () => {
    const setAllCalls: {
      name: string;
      value: string;
      options: CookieOptions;
    }[] = [];

    await clearAuthCookiesAtScopes({
      getAll: async () => [{ name: "storage-key", value: "value" }],
      setAll: async (setCookies) => {
        setAllCalls.push(...setCookies);
      },
      storageKey: "storage-key",
      scopes: [{ path: "/app" }],
    });

    expect(setAllCalls).toEqual([
      {
        name: "storage-key",
        value: "",
        options: { ...DEFAULT_COOKIE_OPTIONS, path: "/app", maxAge: 0 },
      },
    ]);
  });

  it("strips name from cookieOptions to avoid NextJS cookieStore confusion", async () => {
    const setAllCalls: {
      name: string;
      value: string;
      options: CookieOptions & { name?: string };
    }[] = [];

    await clearAuthCookiesAtScopes({
      getAll: async () => [{ name: "storage-key", value: "value" }],
      setAll: async (setCookies) => {
        setAllCalls.push(...setCookies);
      },
      storageKey: "storage-key",
      scopes: [
        // @ts-expect-error simulating a scope object that includes `name`
        { domain: ".example.com", name: "leaked-name" },
      ],
    });

    expect(setAllCalls).toHaveLength(1);
    expect(setAllCalls[0].options.name).toBeUndefined();
  });
});
