import { describe, it, expect } from "vitest";

import {
  serialize,
  parse,
  // intentionally importing ^ to make sure they're exported, remove in v1.0.0
  parseCookieHeader,
  serializeCookieHeader,
} from "./helpers";
import type { GetAllCookies } from "../types";

describe("helpers", () => {
  describe("parseCookieHeader", () => {
    it("should parse a Cookie header", () => {
      expect(parseCookieHeader("")).toMatchSnapshot();
      expect(
        parseCookieHeader(`a=b;c=${encodeURIComponent(" hello ")};e=f`),
      ).toMatchSnapshot();
    });

    it("returns string values usable directly as a getAll() method (issue #115)", () => {
      // Every value is a string (never undefined), including valueless cookies.
      parseCookieHeader("a=b;c=").forEach(({ value }) =>
        expect(typeof value).toBe("string"),
      );

      // Compile-time regression guard: the return type must satisfy the
      // CookieMethodsServer `getAll` contract, so parseCookieHeader can be
      // returned directly, e.g.
      // `getAll() { return parseCookieHeader(headers.get("cookie") ?? "") }`.
      const getAll: GetAllCookies = () => parseCookieHeader("a=b");
      expect(getAll()).toBeInstanceOf(Array);
    });
  });

  describe("serializeCookieHeader", () => {
    it("should serialize a cookie to a Set-Cookie header", () => {
      expect(
        serializeCookieHeader("a", "", {
          path: "/",
          maxAge: 123,
          httpOnly: true,
          secure: true,
        }),
      ).toMatchSnapshot();
      expect(
        serializeCookieHeader("b", " weird value", { maxAge: 345 }),
      ).toMatchSnapshot();
    });
  });
});
