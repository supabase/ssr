import { describe, it, expect } from "vitest";

import { MAX_CHUNK_SIZE, stringToBase64URL } from "./utils";
import { CookieOptions } from "./types";
import { createServerClient } from "./createServerClient";

describe("createServerClient", () => {
  describe("validation", () => {
    it("should throw an error on empty URL and anon key", async () => {
      expect(() => {
        createServerClient("URL", "", {
          cookies: {
            getAll() {
              return [];
            },

            setAll(cookiesToSet) {
              // no-op
            },
          },
        });
      }).toThrow();

      expect(() => {
        createServerClient("", "anon key", {
          cookies: {
            getAll() {
              return [];
            },

            setAll(cookiesToSet) {
              // no-op
            },
          },
        });
      }).toThrow();
    });
  });

  describe("use cases", () => {
    const storageKeys = [null, "custom-storage-key"];
    const cookieEncodings = [
      undefined /* base64url+length */,
      "base64url" as const,
      "raw" as const,
    ];

    storageKeys.forEach((storageKey) => {
      cookieEncodings.forEach((cookieEncoding) => {
        it(`should set PKCE code verifier correctly (storage key = ${storageKey}, cookieEncoding = ${cookieEncoding})`, async () => {
          let setAllCalls = 0;
          let getAllCalls = 0;

          const setCookies: {
            name: string;
            value: string;
            options: CookieOptions;
          }[] = [];

          const supabase = createServerClient(
            "https://project-ref.supabase.co",
            "anon-key",
            {
              ...(storageKey ? { cookieOptions: { name: storageKey } } : null),
              cookieEncoding,
              cookies: {
                getAll() {
                  getAllCalls += 1;

                  return [];
                },

                setAll(cookiesToSet) {
                  setAllCalls += 1;
                  setCookies.push(...cookiesToSet);
                },
              },

              global: {
                fetch: async (a: any, b?: any) => {
                  throw new Error("Should not be called");
                },
              },
            },
          );

          const {
            data: { url },
            error,
          } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { skipBrowserRedirect: true },
          });

          expect(error).toBeNull();
          expect(setAllCalls).toEqual(1);

          // change cookie values to a fixed value so snapshots don't change due to randomness
          setCookies.forEach((obj) => {
            if (typeof obj.value === "string") {
              obj.value = "<RANDOM VALUE>";
            }
          });

          expect(setCookies).toMatchSnapshot();
        });

        it(`should set exchange PKCE code for session correctly (storage key = ${storageKey}, cookieEncoding = ${cookieEncoding})`, async () => {
          let setAllCalls = 0;
          let getAllCalls = 0;

          const setCookies: {
            name: string;
            value: string;
            options: CookieOptions;
          }[] = [];

          const supabase = createServerClient(
            "https://project-ref.supabase.co",
            "anon-key",
            {
              ...(storageKey ? { cookieOptions: { name: storageKey } } : null),
              cookieEncoding,
              cookies: {
                getAll() {
                  getAllCalls += 1;

                  return [
                    {
                      name: storageKey
                        ? `${storageKey}-code-verifier`
                        : "sb-project-ref-auth-token-code-verifier",
                      value: "<RANDOM VALUE>",
                    },
                  ];
                },

                setAll(cookiesToSet) {
                  setAllCalls += 1;
                  setCookies.push(...cookiesToSet);
                },
              },

              global: {
                fetch: async (a: any, b?: any) => {
                  if (
                    a.endsWith("/token?grant_type=pkce") &&
                    b.method === "POST"
                  ) {
                    return new Response(
                      JSON.stringify({
                        expires_in: 3600,
                        expires_at: Math.floor(
                          new Date("2037-01-01T00:00:00Z").getTime() / 1000.0,
                        ), // to make sure the snapshot does not change with Date.now()
                        access_token: "<access-token>",
                        refresh_token: "<refresh-token>",
                        user: {
                          id: "<user-id-refresh-token>",
                          // to force chunking
                          email:
                            Array.from(
                              { length: MAX_CHUNK_SIZE },
                              () => "x",
                            ).join("") + "@example.com",
                        },
                      }),
                      {
                        status: 200,
                        headers: {
                          "Content-Type": "application/json; charset=UTF-8",
                        },
                      },
                    );
                  } else {
                    throw new Error("Bad mock!");
                  }
                },
              },
            },
          );

          const { data, error } =
            await supabase.auth.exchangeCodeForSession("<code>");

          expect(error).toBeNull();
          expect(setAllCalls).toEqual(1);
          expect(setCookies).toMatchSnapshot();
          expect(data).toMatchSnapshot();
        });

        it(`should refresh session correctly as typically used in middlewares (storage key = ${storageKey}, cookieEncoding = ${cookieEncoding})`, async () => {
          let setAllCalls = 0;
          let getAllCalls = 0;

          const setCookies: {
            name: string;
            value: string;
            options: CookieOptions;
          }[] = [];

          const supabase = createServerClient(
            "https://project-ref.supabase.co",
            "anon-key",
            {
              ...(storageKey ? { cookieOptions: { name: storageKey } } : null),
              cookieEncoding,
              cookies: {
                getAll() {
                  getAllCalls += 1;

                  return [
                    {
                      name: storageKey
                        ? storageKey
                        : "sb-project-ref-auth-token",
                      value:
                        "base64-" +
                        stringToBase64URL(
                          JSON.stringify({
                            token_type: "bearer",
                            access_token: "<access-token-to-be-refreshed>",
                            refresh_token: "<initial-refresh-token>",
                            expires_at: Math.floor(Date.now() / 1000),
                            expires_in: 0,
                            user: {
                              id: "<user-to-be-refreshed>",
                            },
                          }),
                        ),
                    },
                  ];
                },

                setAll(cookiesToSet) {
                  setAllCalls += 1;
                  setCookies.push(...cookiesToSet);
                },
              },

              global: {
                fetch: async (a: any, b?: any) => {
                  if (typeof a !== "string" && typeof b !== "object") {
                    throw new Error("Bad mock!");
                  }

                  if (
                    a.endsWith("/token?grant_type=refresh_token") &&
                    b.method === "POST"
                  ) {
                    return new Response(
                      JSON.stringify({
                        expires_in: 3600,
                        expires_at: Math.floor(
                          new Date("2037-01-01T00:00:00Z").getTime() / 1000.0,
                        ), // to make sure the snapshot does not change with Date.now()
                        access_token: "<access-token>",
                        refresh_token: "<refresh-token>",
                        user: {
                          id: "<user-id-refresh-token>",
                          // to force chunking
                          email:
                            Array.from(
                              { length: MAX_CHUNK_SIZE },
                              () => "x",
                            ).join("") + "@example.com",
                        },
                      }),
                      {
                        status: 200,
                        headers: {
                          "Content-Type": "application/json; charset=UTF-8",
                        },
                      },
                    );
                  } else if (a.endsWith("/user") && b.method === "GET") {
                    return new Response(
                      JSON.stringify({
                        id: "<user-id-user>",
                      }),
                      {
                        status: 200,
                        headers: {
                          "Content-Type": "application/json; charset=UTF-8",
                        },
                      },
                    );
                  } else {
                    throw new Error("Bad mock!");
                  }
                },
              },
            },
          );

          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          expect(error).toBeNull();
          expect(getAllCalls > 1).toBeTruthy();
          expect(setAllCalls).toEqual(1);

          expect(user).toMatchSnapshot();
          expect(setCookies).toMatchSnapshot();
        });

        it(`should not set cookies if the session does not need to be refreshed (storage key = ${storageKey}, cookieEncoding = ${cookieEncoding})`, async () => {
          let setAllCalls = 0;
          let getAllCalls = 0;

          const supabase = createServerClient(
            "https://project-ref.supabase.co",
            "anon-key",
            {
              ...(storageKey ? { cookieOptions: { name: storageKey } } : null),
              cookieEncoding,
              cookies: {
                getAll() {
                  getAllCalls += 1;

                  return [
                    {
                      name: storageKey
                        ? storageKey
                        : "sb-project-ref-auth-token",
                      value:
                        "base64-" +
                        stringToBase64URL(
                          JSON.stringify({
                            token_type: "bearer",
                            access_token: "<access-token-to-be-refreshed>",
                            refresh_token: "<initial-refresh-token>",
                            expires_at: Math.floor(Date.now() / 1000) + 5 * 60, // expires in 5 mins
                            expires_in: 5 * 60,
                            user: {
                              id: "<user-to-be-refreshed>",
                            },
                          }),
                        ),
                    },
                  ];
                },

                setAll(cookiesToSet) {
                  setAllCalls += 1;
                },
              },

              global: {
                fetch: async (a: any, b?: any) => {
                  if (typeof a !== "string" && typeof b !== "object") {
                    throw new Error("Bad mock!");
                  }

                  if (
                    a.endsWith("/token?grant_type=refresh_token") &&
                    b.method === "POST"
                  ) {
                    throw new Error(
                      "Refreshing the session should not take place!",
                    );
                  } else if (a.endsWith("/user") && b.method === "GET") {
                    return new Response(
                      JSON.stringify({
                        id: "<user-id-user>",
                      }),
                      {
                        status: 200,
                        headers: {
                          "Content-Type": "application/json; charset=UTF-8",
                        },
                      },
                    );
                  } else {
                    throw new Error("Bad mock!");
                  }
                },
              },
            },
          );

          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          expect(getAllCalls > 1).toBeTruthy();
          expect(setAllCalls).toEqual(0);

          expect(error).toBeNull();
          expect(user).toMatchSnapshot();
        });
      });
    });
  });
});
