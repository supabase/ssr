import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { isBrowser, DEFAULT_COOKIE_OPTIONS, MAX_CHUNK_SIZE } from "./utils";
import { CookieOptions } from "./types";

import { createStorageFromOptions, applyServerStorage } from "./cookies";

describe("createStorageFromOptions in browser without cookie methods", () => {
  beforeEach(() => {
    const cookies: { [name: string]: { value: string; options: string[] } } =
      {};

    const doc = new Proxy<typeof document>({} as any, {
      get: (target, prop) => {
        if (prop === "cookie") {
          return Object.keys(cookies)
            .map((key) => `${key}=${cookies[key].value}`)
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
            cookies[name] = { value, options };
          }

          return true;
        }

        (target as any)[prop] = setValue;

        return true;
      },
    });

    globalThis.window = {
      document: doc,
    } as any;

    (globalThis as any).document = doc;
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).document;
  });

  it("should setup mocks correctly", () => {
    expect(isBrowser()).toEqual(true);
    expect(document.cookie).toEqual("");

    document.cookie = "name-a=value-a; max-age=123";
    document.cookie = "name-b=value-b; max-age=123";

    expect(document.cookie).toEqual("name-a=value-a;name-b=value-b");

    document.cookie = "name-a=delete; Max-Age=0";

    expect(document.cookie).toEqual("name-b=value-b");
  });

  it("should access cookies with various uses of getItem, setItem and removeItem", async () => {
    const { storage } = createStorageFromOptions(
      {
        cookieEncoding: "raw", // to help test readability
      },
      false
    );

    [
      { name: "storage-key.0", value: "val" },
      { name: "storage-key.1", value: "ue" },
      { name: "storage-key.4", value: "leftover" },
      { name: "random-cookie", value: "random" },
    ].forEach(({ name, value }) => {
      document.cookie = `${name}=${value}; Max-Age=123`;
    });

    const value = await storage.getItem("storage-key");
    expect(value).toEqual("value");

    await storage.setItem("storage-key", "value");

    expect(document.cookie).toEqual("random-cookie=random;storage-key=value");

    let newChunkedValue = Array.from(
      { length: MAX_CHUNK_SIZE + 1 },
      () => "x"
    ).join("");

    await storage.setItem("storage-key", newChunkedValue);
    await storage.removeItem("non-existent-item");

    expect(document.cookie).toEqual(
      `random-cookie=random;storage-key.0=${newChunkedValue.substring(0, MAX_CHUNK_SIZE)};storage-key.1=${newChunkedValue.substring(MAX_CHUNK_SIZE)}`
    );

    document.cookie = "storage-key=value; Max-Age=123";

    await storage.removeItem("storage-key");

    expect(document.cookie).toEqual("random-cookie=random");

    newChunkedValue = Array.from(
      { length: 2 * MAX_CHUNK_SIZE + 1 },
      () => "x"
    ).join("");

    await storage.setItem("storage-key", newChunkedValue);

    expect(document.cookie).toEqual(
      `random-cookie=random;storage-key.0=${newChunkedValue.substring(0, MAX_CHUNK_SIZE)};storage-key.1=${newChunkedValue.substring(MAX_CHUNK_SIZE, 2 * MAX_CHUNK_SIZE)};storage-key.2=${newChunkedValue.substring(2 * MAX_CHUNK_SIZE)}`
    );

    newChunkedValue = Array.from(
      { length: MAX_CHUNK_SIZE + 1 },
      () => "x"
    ).join("");

    await storage.setItem("storage-key", newChunkedValue);

    expect(document.cookie).toEqual(
      `random-cookie=random;storage-key.0=${newChunkedValue.substring(0, MAX_CHUNK_SIZE)};storage-key.1=${newChunkedValue.substring(MAX_CHUNK_SIZE)}`
    );
  });
});

describe("createStorageFromOptions for createServerClient", () => {
  describe("storage without setAll or without set / remove cookie methods", () => {
    let warnings: any[][] = [];

    beforeEach(() => {
      (console as any).originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnings.push(args);
      };
    });

    afterEach(() => {
      warnings = [];
      console.warn = (console as any).originalWarn;
      delete (console as any).originalWarn;
    });

    it("should log a warning when only getAll is configured", async () => {
      const { setAll } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [];
            },
          },
        },
        true
      );

      await setAll([
        {
          name: "cookie",
          value: "value",
          options: { ...DEFAULT_COOKIE_OPTIONS },
        },
      ]);

      expect(warnings).toEqual([
        [
          "@supabase/ssr: createServerClient was configured without the setAll cookie method, but the client needs to set cookies. This can lead to issues such as random logouts, early session termination or increased token refresh requests. If in NextJS, check your middleware.ts file, route handlers and server actions for correctness.",
        ],
      ]);
    });
  });

  describe("storage with getAll, setAll", () => {
    it("should not call setAll on setItem", async () => {
      let setAllCalled = false;

      const { storage, setItems, removedItems } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [];
            },

            setAll: async () => {
              setAllCalled = true;
            },
          },
        },
        true
      );

      await storage.setItem("storage-key", "value");

      expect(setAllCalled).toBeFalsy();
      expect(setItems).toEqual({ "storage-key": "value" });
      expect(removedItems).toEqual({});
    });

    it("should not call setAll on removeItem", async () => {
      let setAllCalled = false;

      const { storage, setItems, removedItems } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [];
            },

            setAll: async () => {
              setAllCalled = true;
            },
          },
        },
        true
      );

      await storage.removeItem("storage-key");

      expect(setAllCalled).toBeFalsy();
      expect(setItems).toEqual({});
      expect(removedItems).toEqual({ "storage-key": true });
    });

    it("should not call getAll if item has already been set", async () => {
      let getAllCalled = false;

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              getAllCalled = true;

              return [];
            },

            setAll: async () => {},
          },
        },
        true
      );

      await storage.setItem("storage-key", "value");

      const value = await storage.getItem("storage-key");

      expect(value).toEqual("value");
      expect(getAllCalled).toBeFalsy();
    });

    it("should not call getAll if item has already been removed", async () => {
      let getAllCalled = false;

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              getAllCalled = true;

              return [];
            },

            setAll: async () => {},
          },
        },
        true
      );

      await storage.removeItem("storage-key");

      const value = await storage.getItem("storage-key");

      expect(value).toBeNull();
      expect(getAllCalled).toBeFalsy();
    });

    it("should call getAll each time getItem is called until setItem or removeItem", async () => {
      let getAllCalled = 0;

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              getAllCalled += 1;

              return [];
            },

            setAll: async () => {},
          },
        },
        true
      );

      await storage.getItem("storage-key");

      expect(getAllCalled).toEqual(1);

      await storage.getItem("storage-key");

      expect(getAllCalled).toEqual(2);

      await storage.setItem("storage-key", "value");

      await storage.getItem("storage-key");

      expect(getAllCalled).toEqual(2);
    });

    it("should return item value from getAll without chunks", async () => {
      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [
                {
                  name: "storage-key",
                  value: "value",
                },
                {
                  name: "other-cookie",
                  value: "other-value",
                },
                {
                  name: "storage-key.0",
                  value: "leftover-chunk-value",
                },
              ];
            },

            setAll: async () => {},
          },
        },
        true
      );

      const value = await storage.getItem("storage-key");

      expect(value).toEqual("value");
    });

    it("should return item value from getAll with chunks", async () => {
      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [
                {
                  name: "other-cookie",
                  value: "other-value",
                },
                {
                  name: "storage-key.0",
                  value: "val",
                },
                {
                  name: "storage-key.1",
                  value: "ue",
                },
                {
                  name: "storage-key.2",
                  value: "",
                },
                {
                  name: "storage-key.3",
                  value: "leftover-chunk-value",
                },
              ];
            },

            setAll: async () => {},
          },
        },
        true
      );

      const value = await storage.getItem("storage-key");

      expect(value).toEqual("value");
    });
  });
});

describe("createStorageFromOptions for createBrowserClient", () => {
  describe("storage with getAll, setAll", () => {
    it("should call getAll on each getItem", async () => {
      let getAllCalls = 0;

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              getAllCalls += 1;

              return [
                {
                  name: "random-cookie",
                  value: "random-value",
                },
                { name: "storage-key", value: "value" },
                { name: "storage-key.4", value: "leftover-chunk-value" },
              ];
            },

            setAll: async () => {},
          },
        },
        false
      );

      const value = await storage.getItem("storage-key");

      expect(value).toEqual("value");
      expect(getAllCalls).toEqual(1);

      const nonExistingValue = await storage.getItem("whatever");
      expect(nonExistingValue).toBeNull();
      expect(getAllCalls).toEqual(2);
    });

    it("should call getAll, setAll on each setItem", async () => {
      let getAllCalls = 0;
      let setAllCalls = 0;

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              getAllCalls += 1;

              return [];
            },

            setAll: async () => {
              setAllCalls += 1;
            },
          },
        },
        false
      );

      await storage.setItem("storage-key", "value");

      expect(getAllCalls).toEqual(1);
      expect(setAllCalls).toEqual(1);
    });

    it("should call getAll, setAll on each removeItem", async () => {
      let getAllCalls = 0;
      let setAllCalls = 0;

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              getAllCalls += 1;

              return [
                {
                  name: "storage-key",
                  value: "value",
                },
              ];
            },

            setAll: async () => {
              setAllCalls += 1;
            },
          },
        },
        false
      );

      await storage.removeItem("storage-key");

      expect(getAllCalls).toEqual(1);
      expect(setAllCalls).toEqual(1);
    });

    it("should do chunk management with setAll (non-chunked => chunked case)", async () => {
      const setAllCalls: {
        name: string;
        value: string;
        options: CookieOptions;
      }[] = [];

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [
                {
                  name: "random-cookie",
                  value: "random-value",
                },
                {
                  name: "storage-key",
                  value: "value",
                },
                {
                  name: "storage-key.4",
                  value: "leftover-chunk-value",
                },
              ];
            },

            setAll: async (setCookies) => {
              setAllCalls.push(...setCookies);
            },
          },
        },
        false
      );

      const chunkedValue = Array.from(
        { length: MAX_CHUNK_SIZE + 1 },
        () => "x"
      ).join("");

      await storage.setItem("storage-key", chunkedValue);

      expect(setAllCalls).toEqual([
        {
          name: "storage-key",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.4",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.0",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: chunkedValue.substring(0, MAX_CHUNK_SIZE),
        },
        {
          name: "storage-key.1",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: chunkedValue.substring(MAX_CHUNK_SIZE),
        },
      ]);
    });

    it("should do chunk management with setAll (less chunks => more chunks case)", async () => {
      const setAllCalls: {
        name: string;
        value: string;
        options: CookieOptions;
      }[] = [];

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [
                {
                  name: "random-cookie",
                  value: "random-value",
                },
                {
                  name: "storage-key.0",
                  value: "val",
                },
                {
                  name: "storage-key.1",
                  value: "ue",
                },
                {
                  name: "storage-key.4",
                  value: "leftover-chunk-value",
                },
              ];
            },

            setAll: async (setCookies) => {
              setAllCalls.push(...setCookies);
            },
          },
        },
        false
      );

      const chunkedValue = Array.from(
        { length: 2 * MAX_CHUNK_SIZE + 1 },
        () => "x"
      ).join("");

      await storage.setItem("storage-key", chunkedValue);

      expect(setAllCalls).toEqual([
        {
          name: "storage-key.4",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.0",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: chunkedValue.substring(0, MAX_CHUNK_SIZE),
        },
        {
          name: "storage-key.1",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: chunkedValue.substring(MAX_CHUNK_SIZE, 2 * MAX_CHUNK_SIZE),
        },
        {
          name: "storage-key.2",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: chunkedValue.substring(2 * MAX_CHUNK_SIZE),
        },
      ]);
    });

    it("should do chunk management with setAll (more chunks => less chunks case)", async () => {
      const setAllCalls: {
        name: string;
        value: string;
        options: CookieOptions;
      }[] = [];

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [
                {
                  name: "random-cookie",
                  value: "random-value",
                },
                {
                  name: "storage-key.0",
                  value: "va",
                },
                {
                  name: "storage-key.1",
                  value: "lu",
                },
                {
                  name: "storage-key.2",
                  value: "e",
                },
                {
                  name: "storage-key.4",
                  value: "leftover-chunk-value",
                },
              ];
            },

            setAll: async (setCookies) => {
              setAllCalls.push(...setCookies);
            },
          },
        },
        false
      );

      const chunkedValue = Array.from(
        { length: MAX_CHUNK_SIZE + 1 },
        () => "x"
      ).join("");

      await storage.setItem("storage-key", chunkedValue);

      expect(setAllCalls).toEqual([
        {
          name: "storage-key.2",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.4",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.0",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: chunkedValue.substring(0, MAX_CHUNK_SIZE),
        },
        {
          name: "storage-key.1",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: chunkedValue.substring(MAX_CHUNK_SIZE),
        },
      ]);
    });

    it("should do chunk management with setAll (chunked => non-chunked case)", async () => {
      const setAllCalls: {
        name: string;
        value: string;
        options: CookieOptions;
      }[] = [];

      const { storage } = createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [
                {
                  name: "random-cookie",
                  value: "random-value",
                },
                {
                  name: "storage-key.0",
                  value: "va",
                },
                {
                  name: "storage-key.1",
                  value: "lu",
                },
                {
                  name: "storage-key.2",
                  value: "e",
                },
                {
                  name: "storage-key.4",
                  value: "leftover-chunk-value",
                },
              ];
            },

            setAll: async (setCookies) => {
              setAllCalls.push(...setCookies);
            },
          },
        },
        false
      );

      await storage.setItem("storage-key", "value");

      expect(setAllCalls).toEqual([
        {
          name: "storage-key.0",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.1",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.2",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key.4",
          options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
          value: "",
        },
        {
          name: "storage-key",
          options: { ...DEFAULT_COOKIE_OPTIONS },
          value: "value",
        },
      ]);
    });
  });
});

describe("applyServerStorage", () => {
  it("should call setAll with the correct cookies for a variety of changes to the storage state", async () => {
    const setAllCalls: {
      name: string;
      value: string;
      options: CookieOptions;
    }[] = [];

    const { storage, getAll, setAll, setItems, removedItems } =
      createStorageFromOptions(
        {
          cookieEncoding: "raw", // to help test readability
          cookies: {
            getAll: async () => {
              return [
                {
                  name: "random-cookie",
                  value: "random-value",
                },
                {
                  name: "storage-key.0",
                  value: "va",
                },
                {
                  name: "storage-key.1",
                  value: "lu",
                },
                {
                  name: "storage-key.2",
                  value: "e",
                },
                {
                  name: "storage-key.4",
                  value: "leftover-chunk-value",
                },
                {
                  name: "non-chunked",
                  value: "non-chunked-value",
                },
                {
                  name: "remove-value",
                  value: "remove",
                },
                {
                  name: "remove-value.0",
                  value: "remove",
                },
                {
                  name: "remove-value.2",
                  value: "remove",
                },
              ];
            },

            setAll: async (setCookies) => {
              setAllCalls.push(...setCookies);
            },
          },
        },
        true
      );

    const newChunkedValue = Array.from(
      { length: MAX_CHUNK_SIZE + 1 },
      () => "x"
    ).join("");

    await storage.setItem("storage-key", newChunkedValue);
    await storage.setItem("new-chunked-value", newChunkedValue);
    await storage.setItem("new-value", "value");
    await storage.removeItem("remove-value");
    await storage.removeItem("non-existent-value");

    await applyServerStorage(
      { getAll, setAll, setItems, removedItems },
      {
        cookieEncoding: "raw", // to help test readability
      }
    );

    expect(setAllCalls).toEqual([
      {
        name: "remove-value",
        value: "",
        options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
      },
      {
        name: "remove-value.0",
        value: "",
        options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
      },
      {
        name: "remove-value.2",
        value: "",
        options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
      },
      {
        name: "storage-key.2",
        value: "",
        options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
      },
      {
        name: "storage-key.4",
        value: "",
        options: { ...DEFAULT_COOKIE_OPTIONS, maxAge: 0 },
      },

      {
        name: "storage-key.0",
        value: newChunkedValue.substring(0, MAX_CHUNK_SIZE),
        options: { ...DEFAULT_COOKIE_OPTIONS },
      },
      {
        name: "storage-key.1",
        value: newChunkedValue.substring(MAX_CHUNK_SIZE),
        options: { ...DEFAULT_COOKIE_OPTIONS },
      },
      {
        name: "new-chunked-value.0",
        value: newChunkedValue.substring(0, MAX_CHUNK_SIZE),
        options: { ...DEFAULT_COOKIE_OPTIONS },
      },
      {
        name: "new-chunked-value.1",
        value: newChunkedValue.substring(MAX_CHUNK_SIZE),
        options: { ...DEFAULT_COOKIE_OPTIONS },
      },
      {
        name: "new-value",
        value: "value",
        options: { ...DEFAULT_COOKIE_OPTIONS },
      },
    ]);
  });
});
