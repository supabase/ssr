import { describe, it, expect } from "vitest";
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
