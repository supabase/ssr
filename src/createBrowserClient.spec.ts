import { describe, it, expect, vi, beforeEach } from "vitest";

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
});
