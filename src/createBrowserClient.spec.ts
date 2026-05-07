import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { MAX_CHUNK_SIZE, stringToBase64URL } from "./utils";
import { CookieOptions } from "./types";
import { createBrowserClient } from "./createBrowserClient";

// Spy on createClient to capture auth options passed through
const createClientSpy = vi.fn().mockReturnValue({
  auth: {},
  realtime: {},
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientSpy(...args),
}));

describe("createBrowserClient", () => {
  beforeEach(() => {
    createClientSpy.mockClear();
  });

  describe("validation", () => {
    it("should throw an error on empty URL and anon key", async () => {
      expect(() => {
        createBrowserClient("URL", "");
      }).toThrow();

      expect(() => {
        createBrowserClient("", "anon key");
      }).toThrow();
    });
  });

  describe("auth options passthrough", () => {
    it("should respect autoRefreshToken when explicitly set to false", () => {
      createBrowserClient("http://localhost", "anon-key", {
        isSingleton: false,
        auth: { autoRefreshToken: false },
      });

      const passedOptions = createClientSpy.mock.calls[0][2];
      expect(passedOptions.auth.autoRefreshToken).toBe(false);
    });

    it("should respect detectSessionInUrl when explicitly set to false", () => {
      createBrowserClient("http://localhost", "anon-key", {
        isSingleton: false,
        auth: { detectSessionInUrl: false },
      });

      const passedOptions = createClientSpy.mock.calls[0][2];
      expect(passedOptions.auth.detectSessionInUrl).toBe(false);
    });

    it("should respect persistSession when explicitly set to false", () => {
      createBrowserClient("http://localhost", "anon-key", {
        isSingleton: false,
        auth: { persistSession: false },
      });

      const passedOptions = createClientSpy.mock.calls[0][2];
      expect(passedOptions.auth.persistSession).toBe(false);
    });

    it("should use defaults when auth options are not provided", () => {
      createBrowserClient("http://localhost", "anon-key", {
        isSingleton: false,
      });

      const passedOptions = createClientSpy.mock.calls[0][2];
      // defaults come from isBrowser() for autoRefreshToken/detectSessionInUrl, true for persistSession
      expect(passedOptions.auth.persistSession).toBe(true);
    });
  });

  describe("encode option without explicit getAll/setAll", () => {
    beforeEach(() => {
      const cookies: { [name: string]: string } = {};

      const doc = new Proxy<typeof document>({} as any, {
        get: (target, prop) => {
          if (prop === "cookie") {
            return Object.keys(cookies)
              .map((key) => `${key}=${cookies[key]}`)
              .join(";");
          }
          return (target as any)[prop];
        },
        set: (target, prop, setValue) => {
          if (prop === "cookie") {
            const [cookie, ...options] = setValue.split(/\s*;\s*/);
            const [name, value] = cookie.split("=");
            if (options.indexOf("Max-Age=0") > -1) {
              delete cookies[name];
            } else {
              cookies[name] = value;
            }
            return true;
          }
          (target as any)[prop] = setValue;
          return true;
        },
      });

      const localStorageStub = {
        getItem: (_key: string) => null,
        setItem: (_key: string, _value: string) => {},
        removeItem: (_key: string) => {},
      };

      globalThis.window = {
        document: doc,
        localStorage: localStorageStub,
      } as any;
      (globalThis as any).document = doc;
    });

    afterEach(() => {
      delete (globalThis as any).window;
      delete (globalThis as any).document;
    });

    it("accepts cookies: { encode: 'tokens-only' } without getAll/setAll and routes user storage to userStorage", () => {
      expect(() =>
        createBrowserClient("http://localhost", "anon-key", {
          isSingleton: false,
          cookies: { encode: "tokens-only" },
        }),
      ).not.toThrow();

      const passedOptions = createClientSpy.mock.calls[0][2];
      expect(passedOptions.auth.userStorage).toBeDefined();
    });

    it("accepts cookies: { encode: 'user-and-tokens' } without getAll/setAll and does not set userStorage", () => {
      expect(() =>
        createBrowserClient("http://localhost", "anon-key", {
          isSingleton: false,
          cookies: { encode: "user-and-tokens" },
        }),
      ).not.toThrow();

      const passedOptions = createClientSpy.mock.calls[0][2];
      expect(passedOptions.auth.userStorage).toBeUndefined();
    });

    it("still works when full getAll/setAll are provided", () => {
      expect(() =>
        createBrowserClient("http://localhost", "anon-key", {
          isSingleton: false,
          cookies: {
            encode: "tokens-only",
            getAll: () => [],
            setAll: () => {},
          },
        }),
      ).not.toThrow();
    });
  });
});
