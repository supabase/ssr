import { parse, serialize } from "cookie";

import {
  DEFAULT_COOKIE_OPTIONS,
  combineChunks,
  createChunks,
  isBrowser,
  isChunkLike,
  stringFromBase64URL,
  stringToBase64URL,
} from "./utils";

import type {
  CookieMethodsServer,
  CookieMethodsServerDeprecated,
  CookieMethodsBrowser,
  CookieMethodsBrowserDeprecated,
  CookieOptions,
  CookieOptionsWithName,
  GetAllCookies,
  SetAllCookies,
} from "./types";

const BASE64_PREFIX = "base64-";

/**
 * Creates a storage client that handles cookies correctly for browser and
 * server clients with or without properly provided cookie methods.
 *
 * @param options The options passed to createBrowserClient or createServer client.
 *
 * @param isServerClient Whether it's called from createServerClient.
 */
export function createStorageFromOptions(
  options: {
    cookieEncoding: "raw" | "base64url";
    cookies?:
      | CookieMethodsBrowser
      | CookieMethodsBrowserDeprecated
      | CookieMethodsServer
      | CookieMethodsServerDeprecated;
    cookieOptions?: CookieOptionsWithName;
  },
  isServerClient: boolean,
) {
  const cookies = options.cookies ?? null;
  const cookieEncoding = options.cookieEncoding;

  const setItems: { [key: string]: string } = {};
  const removedItems: { [key: string]: boolean } = {};

  let getAll: (keyHints: string[]) => ReturnType<GetAllCookies>;
  let setAll: SetAllCookies;

  if (cookies) {
    if ("get" in cookies) {
      // Just get is not enough, because the client needs to see what cookies
      // are already set and unset them if necessary. To attempt to fix this
      // behavior for most use cases, we pass "hints" which is the keys of the
      // storage items. They are then converted to their corresponding cookie
      // chunk names and are fetched with get. Only 5 chunks are fetched, which
      // should be enough for the majority of use cases, but does not solve
      // those with very large sessions.

      const getWithHints = async (keyHints: string[]) => {
        // optimistically find the first 5 potential chunks for the specified key
        const chunkNames = keyHints.flatMap((keyHint) => [
          keyHint,
          ...Array.from({ length: 5 }).map((_, i) => `${keyHint}.${i}`),
        ]);

        const chunks: ReturnType<GetAllCookies> = [];

        for (let i = 0; i < chunkNames.length; i += 1) {
          const value = await cookies.get(chunkNames[i]);

          if (!value && typeof value !== "string") {
            continue;
          }

          chunks.push({ name: chunkNames[i], value });
        }

        // TODO: detect and log stale chunks error

        return chunks;
      };

      getAll = async (keyHints: string[]) => await getWithHints(keyHints);

      if ("set" in cookies && "remove" in cookies) {
        setAll = async (setCookies) => {
          for (let i = 0; i < setCookies.length; i += 1) {
            const { name, value, options } = setCookies[i];

            if (value) {
              await cookies.set!(name, value, options);
            } else {
              await cookies.remove!(name, options);
            }
          }
        };
      } else if (isServerClient) {
        setAll = async () => {
          console.warn(
            "@supabase/ssr: createServerClient was configured without set and remove cookie methods, but the client needs to set cookies. This can lead to issues such as random logouts, early session termination or increased token refresh requests. If in NextJS, check your middleware.ts file, route handlers and server actions for correctness. Consider switching to the getAll and setAll cookie methods instead of get, set and remove which are deprecated and can be difficult to use correctly.",
          );
        };
      } else {
        throw new Error(
          "@supabase/ssr: createBrowserClient requires configuring a getAll and setAll cookie method (deprecated: alternatively both get, set and remove can be used)",
        );
      }
    } else if ("getAll" in cookies) {
      getAll = async () => await cookies.getAll!();

      if ("setAll" in cookies) {
        setAll = cookies.setAll!;
      } else if (isServerClient) {
        setAll = async () => {
          console.warn(
            "@supabase/ssr: createServerClient was configured without the setAll cookie method, but the client needs to set cookies. This can lead to issues such as random logouts, early session termination or increased token refresh requests. If in NextJS, check your middleware.ts file, route handlers and server actions for correctness.",
          );
        };
      } else {
        throw new Error(
          "@supabase/ssr: createBrowserClient requires configuring both getAll and setAll cookie methods (deprecated: alternatively both get, set and remove can be used)",
        );
      }
    } else {
      // neither get nor getAll is present on cookies, only will occur if pure JavaScript is used, but cookies is an object
      throw new Error(
        `@supabase/ssr: ${isServerClient ? "createServerClient" : "createBrowserClient"} requires configuring getAll and setAll cookie methods (deprecated: alternatively use get, set and remove).${isBrowser() ? " As this is called in a browser runtime, consider removing the cookies option object to use the document.cookie API automatically." : ""}`,
      );
    }
  } else if (!isServerClient && isBrowser()) {
    // The environment is browser, so use the document.cookie API to implement getAll and setAll.

    const noHintGetAll = () => {
      const parsed = parse(document.cookie);

      return Object.keys(parsed).map((name) => ({
        name,
        value: parsed[name] ?? "",
      }));
    };

    getAll = () => noHintGetAll();

    setAll = (setCookies) => {
      setCookies.forEach(({ name, value, options }) => {
        document.cookie = serialize(name, value, options);
      });
    };
  } else if (isServerClient) {
    throw new Error(
      "@supabase/ssr: createServerClient must be initialized with cookie options that specify getAll and setAll functions (deprecated, not recommended: alternatively use get, set and remove)",
    );
  } else {
    // getting cookies when there's no window but we're in browser mode can be OK, because the developer probably is not using auth functions
    getAll = () => {
      return [];
    };

    // this is NOT OK because the developer is using auth functions that require setting some state, so that must error out
    setAll = () => {
      throw new Error(
        "@supabase/ssr: createBrowserClient in non-browser runtimes (including Next.js pre-rendering mode) was not initialized cookie options that specify getAll and setAll functions (deprecated: alternatively use get, set and remove), but they were needed",
      );
    };
  }

  if (!isServerClient) {
    // This is the storage client to be used in browsers. It only
    // works on the cookies abstraction, unlike the server client
    // which only uses cookies to read the initial state. When an
    // item is set, cookies are both cleared and set to values so
    // that stale chunks are not left remaining.
    return {
      getAll, // for type consistency
      setAll, // for type consistency
      setItems, // for type consistency
      removedItems, // for type consistency
      storage: {
        isServer: false,
        getItem: async (key: string) => {
          const allCookies = await getAll([key]);
          const chunkedCookie = await combineChunks(
            key,
            async (chunkName: string) => {
              const cookie =
                allCookies?.find(({ name }) => name === chunkName) || null;

              if (!cookie) {
                return null;
              }

              return cookie.value;
            },
          );

          if (!chunkedCookie) {
            return null;
          }

          let decoded = chunkedCookie;

          if (chunkedCookie.startsWith(BASE64_PREFIX)) {
            decoded = stringFromBase64URL(
              chunkedCookie.substring(BASE64_PREFIX.length),
            );
          }

          return decoded;
        },
        setItem: async (key: string, value: string) => {
          const allCookies = await getAll([key]);
          const cookieNames = allCookies?.map(({ name }) => name) || [];

          const removeCookies = new Set(
            cookieNames.filter((name) => isChunkLike(name, key)),
          );

          let encoded = value;

          if (cookieEncoding === "base64url") {
            encoded = BASE64_PREFIX + stringToBase64URL(value);
          }

          const setCookies = createChunks(key, encoded);

          setCookies.forEach(({ name }) => {
            removeCookies.delete(name);
          });

          const removeCookieOptions = {
            ...DEFAULT_COOKIE_OPTIONS,
            ...options?.cookieOptions,
            maxAge: 0,
          };
          const setCookieOptions = {
            ...DEFAULT_COOKIE_OPTIONS,
            ...options?.cookieOptions,
            maxAge: DEFAULT_COOKIE_OPTIONS.maxAge,
          };

          // the NextJS cookieStore API can get confused if the `name` from
          // options.cookieOptions leaks
          delete removeCookieOptions.name;
          delete setCookieOptions.name;

          const allToSet = [
            ...[...removeCookies].map((name) => ({
              name,
              value: "",
              options: removeCookieOptions,
            })),
            ...setCookies.map(({ name, value }) => ({
              name,
              value,
              options: setCookieOptions,
            })),
          ];

          if (allToSet.length > 0) {
            await setAll(allToSet);
          }
        },
        removeItem: async (key: string) => {
          const allCookies = await getAll([key]);
          const cookieNames = allCookies?.map(({ name }) => name) || [];
          const removeCookies = cookieNames.filter((name) =>
            isChunkLike(name, key),
          );

          const removeCookieOptions = {
            ...DEFAULT_COOKIE_OPTIONS,
            ...options?.cookieOptions,
            maxAge: 0,
          };

          // the NextJS cookieStore API can get confused if the `name` from
          // options.cookieOptions leaks
          delete removeCookieOptions.name;

          if (removeCookies.length > 0) {
            await setAll(
              removeCookies.map((name) => ({
                name,
                value: "",
                options: removeCookieOptions,
              })),
            );
          }
        },
      },
    };
  }

  // This is the server client. It only uses getAll to read the initial
  // state. Any subsequent changes to the items is persisted in the
  // setItems and removedItems objects. createServerClient *must* use
  // getAll, setAll and the values in setItems and removedItems to
  // persist the changes *at once* when appropriate (usually only when
  // the TOKEN_REFRESHED, USER_UPDATED or SIGNED_OUT events are fired by
  // the Supabase Auth client).
  return {
    getAll,
    setAll,
    setItems,
    removedItems,
    storage: {
      // to signal to the libraries that these cookies are
      // coming from a server environment and their value
      // should not be trusted
      isServer: true,
      getItem: async (key: string) => {
        if (typeof setItems[key] === "string") {
          return setItems[key];
        }

        if (removedItems[key]) {
          return null;
        }

        const allCookies = await getAll([key]);
        const chunkedCookie = await combineChunks(
          key,
          async (chunkName: string) => {
            const cookie =
              allCookies?.find(({ name }) => name === chunkName) || null;

            if (!cookie) {
              return null;
            }

            return cookie.value;
          },
        );

        if (!chunkedCookie) {
          return null;
        }

        let decoded = chunkedCookie;

        if (
          typeof chunkedCookie === "string" &&
          chunkedCookie.startsWith(BASE64_PREFIX)
        ) {
          decoded = stringFromBase64URL(
            chunkedCookie.substring(BASE64_PREFIX.length),
          );
        }

        return decoded;
      },
      setItem: async (key: string, value: string) => {
        // We don't have an `onAuthStateChange` event that can let us know that
        // the PKCE code verifier is being set. Therefore, if we see it being
        // set, we need to apply the storage (call `setAll` so the cookie is
        // set properly).
        if (key.endsWith("-code-verifier")) {
          await applyServerStorage(
            {
              getAll,
              setAll,
              // pretend only that the code verifier was set
              setItems: { [key]: value },
              // pretend that nothing was removed
              removedItems: {},
            },
            {
              cookieOptions: options?.cookieOptions ?? null,
              cookieEncoding,
            },
          );
        }

        setItems[key] = value;
        delete removedItems[key];
      },
      removeItem: async (key: string) => {
        // Intentionally not applying the storage when the key is the PKCE code
        // verifier, as usually right after it's removed other items are set,
        // so application of the storage will be handled by the
        // `onAuthStateChange` callback that follows removal -- usually as part
        // of the `exchangeCodeForSession` call.
        delete setItems[key];
        removedItems[key] = true;
      },
    },
  };
}

/**
 * When createServerClient needs to apply the created storage to cookies, it
 * should call this function which handles correcly setting cookies for stored
 * and removed items in the storage.
 */
export async function applyServerStorage(
  {
    getAll,
    setAll,
    setItems,
    removedItems,
  }: {
    getAll: (keyHints: string[]) => ReturnType<GetAllCookies>;
    setAll: SetAllCookies;
    setItems: { [name: string]: string };
    removedItems: { [name: string]: boolean };
  },
  options: {
    cookieEncoding: "raw" | "base64url";
    cookieOptions?: CookieOptions | null;
  },
) {
  const cookieEncoding = options.cookieEncoding;
  const cookieOptions = options.cookieOptions ?? null;

  const allCookies = await getAll([
    ...(setItems ? (Object.keys(setItems) as string[]) : []),
    ...(removedItems ? (Object.keys(removedItems) as string[]) : []),
  ]);
  const cookieNames = allCookies?.map(({ name }) => name) || [];

  const removeCookies: string[] = Object.keys(removedItems).flatMap(
    (itemName) => {
      return cookieNames.filter((name) => isChunkLike(name, itemName));
    },
  );

  const setCookies = Object.keys(setItems).flatMap((itemName) => {
    const removeExistingCookiesForItem = new Set(
      cookieNames.filter((name) => isChunkLike(name, itemName)),
    );

    let encoded = setItems[itemName];

    if (cookieEncoding === "base64url") {
      encoded = BASE64_PREFIX + stringToBase64URL(encoded);
    }

    const chunks = createChunks(itemName, encoded);

    chunks.forEach((chunk) => {
      removeExistingCookiesForItem.delete(chunk.name);
    });

    removeCookies.push(...removeExistingCookiesForItem);

    return chunks;
  });

  const removeCookieOptions = {
    ...DEFAULT_COOKIE_OPTIONS,
    ...cookieOptions,
    maxAge: 0,
  };
  const setCookieOptions = {
    ...DEFAULT_COOKIE_OPTIONS,
    ...cookieOptions,
    maxAge: DEFAULT_COOKIE_OPTIONS.maxAge,
  };

  // the NextJS cookieStore API can get confused if the `name` from
  // options.cookieOptions leaks
  delete (removeCookieOptions as any).name;
  delete (setCookieOptions as any).name;

  await setAll([
    ...removeCookies.map((name) => ({
      name,
      value: "",
      options: removeCookieOptions,
    })),
    ...setCookies.map(({ name, value }) => ({
      name,
      value,
      options: setCookieOptions,
    })),
  ]);
}
