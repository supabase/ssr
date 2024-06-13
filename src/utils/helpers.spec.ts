import { describe, it, expect } from "vitest";

import {
  serialize,
  parse,
  // intentionally importing ^ to make sure they're exported, remove in v1.0.0
  parseCookieHeader,
  serializeCookieHeader,
} from "./helpers";

describe("helpers", () => {
  describe("parseCookieHeader", () => {
    it("should parse a Cookie header", () => {
      expect(parseCookieHeader("")).toMatchSnapshot();
      expect(
        parseCookieHeader(`a=b;c=${encodeURIComponent(" hello ")};e=f`),
      ).toMatchSnapshot();
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
