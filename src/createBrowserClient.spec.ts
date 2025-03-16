import { describe, it, expect } from "vitest";

import { MAX_CHUNK_SIZE, stringToBase64URL } from "./utils";
import { CookieOptions } from "./types";
import { createBrowserClient } from "./createBrowserClient";

describe("createServerClient", () => {
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
});
