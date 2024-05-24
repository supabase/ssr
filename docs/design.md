# Design

This document should help clarify how this library works internally and why
certain choices were made.

## Data flows

Supabase Auth encodes a user's session using an access token (a JWT,
symmetrically signed) and a refresh token (a unique string that can be only
used once to issue a new access token).

In Single Page Applications (SPA) these are stored in local storage. For
applications where Server-Side Rendering frameworks are used, the access and
refresh token need to also be accessible by the server.

This is traditionally done using browser cookies [Cookies](). By storing the
access token and refresh token in cookies, the browser will send them over to
the server on every page load. Then, the server can take them from the request
headers and render HTML (i.e. server-rendered React) based on the user's
session.

It's important to note that when the user visits a SSR page for the first time,
the request (and therefore cookies) are sent _well before any JavaScript runs
on the page._ In fact, JavaScript can only run after the response from the
server is received. This means that the access token is very likely expired
when sent to the server, and it's the server's job to use the refresh token (as
an extension of the usser's agent) to obtain a new access token.

Since a refresh token can only be used once, the server must send back the new
access token it received as `Set-Cookie` headers.

## Persisting the session information in Cookies

Cookies have significant limitations, as they are a technology invented many
years ago. They can [only hold US ASCII characters **not including** `"`, `,`,
`;`, `\`, `\n`, `\r`, and other
whitespace](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1). As
such JSON **is not permitted** (though appears to be somewhat allowed in
real-life by most servers).

Browsers tend to limit the size of individual cookies. Experimental results
show that individual cookies longer than 3180 bytes will not be sent to the
server, or may not even be saved at all.

For this reason, a _cookie chunking_ strategy is used to split a single value
over multiple cookies.

### Cookie chunking strategy

This library uses this cookie chunking strategy:

1. If the value to be stored is <= 3180 bytes, then it's stored under the full
   cookie name.
2. If the value is >= 3180 bytes, it's split in chunks of 3180 bytes.
   The name of the cookie takes the form `key.chunk_index` where `key` is the
   key for storing the value and `chunk_index` is the 0-based index of the
   chunk.

The operation for reading a stored item with the key `key` is as follows:

1. If there's a cookie with a full name `key`, use its value.
2. For each index starting at `0` if there's a `key.index` cookie, join its
   value with the previous index. If there's no value, stop processing.

Note: These algorithms were introduced in versions <= 0.3.0 and are kept for
their simplicity.

Because of these algorithms, it's important for the library to ensure handling
these state changes with regards to a stored item's value:

1. _Non-chunked to chunked._ If a value for an item previously fit in a
   non-chunked cookie, but now it needs to be split amongst multiple cookies:
   - The non-chunked cookie must be _removed_ (i.e. set to `Max-Age=0`).
2. _More chunks to less chunks._ If a value for an item previously fit in 3
   chunks but now needs to fit in 2 chunks:
   - The chunks from the end, e.g. `key.2` must be _removed_ (i.e. set to
     `Max-Age=0`).
3. _Chunked to non-chunked._ If a value for an item previously fit in at least
   2 chunks, but now can fit in one cookie:
   - All of the chunks need to be _removed_ (i.e. set to `Max-Age=0`) and only
     the full cookie be set to the value.

If these state changes are not implemented correctly, it can lead to issues in
the Supabase Auth library such as:

- Reading garbled data (reading stale chunks).
- Reading stale data (as the non-chunked version is preferential, failing to
  remove it when moving to chunked data can cause the library to read old
  data).

#### Deprecation of `get`, `set` and `remove` in favor of `getAll` and `setAll`

To ensure the correct implementation of the state changes described above, it
was necessary to deprecate the `get`, `set` and `remove` cookie access methods
starting in version 0.4.0 in favor of `getAll` and `setAll`.

This is because when a storage item needs to be set, all cookies that have
chunk-like names need to be properly set and cleared. These cannot be known in
advance, so `get` is not sufficient for solving the problem.

To illustrate with an example, suppose a request comes in with the following
cookies:

```typescript
{
   'storage-item': 'value',
   'storage-item.0': 'value',
   'storage-item.1': 'value',
   'storage-item.5': 'value',
}
```

The client library cannot know that there exist 4 different versions of the
same cookies so it can `get` them. It must use a function like `getAll` with
which it can inspect the full state of the request.

Let's assume that the new state of the `storage-item` is to set two chunks `.0`
and `.1` such as:

```typescript
{
   'storage-item.0': 'val',
   'storage-item.1': 'ue',
}
```

These need to be translated into the following `Set-Cookie` headers (commands):

```http
Set-Cookie: storage-item.0=val; Max-Age=<many seconds>
Set-Cookie: storage-item.1=ue;  Max-Age=<many seconds>
Set-Cookie: storage-item=;   Max-Age=0
Set-Cookie: storage-item.5=; Max-Age=0
```

Notice the last two commands that clear the stale `storage-key` and
`storage-item.5` cookies.

Starting version 0.4.0 if `get`, `set` and `remove` are used, in an effort to
maintain some reliability of the state represented by cookies, the client
library will test for the storage item and its first 5 chunks and clear them if
necessary. This should suffice for most situations, but not all.

Regardless, all users must switch to `getAll` and `setAll`, as in the next
major version the individual `get`, `set` and `remove` methods will not be
supported.

### Cookies as a database (Max-Age option explained)

Cookies are like a very primitive key-value store. You can only query by cookie
name, and the database will give you back a value. It won't give you back its
metadata.

To write to the database, you have to use the `Set-Cookie` header, which is
like the `INSERT` or `UPDATE` commands.

Since the Supabase Auth library uses cookies only to store the session, the
`Max-Age` option of a cookie (as a chunk or otherwise) must be set to a very
high number. This ensures that the browser will always send the value to the
server, and not "delete it."

Conversely, when a cookie is **removed** the `Max-Age` option should be set to
`0`. This is equivalent to a `DELETE` command. This is **extremely important**
as failing to send these commands can result in stale data remaining in the
browser.

### Encoding cookie values

As mentioned previously, cookies can [only hold US ASCII characters **not including** `"`, `,`,
`;`, `\`, `\n`, `\r`, and other
whitespace](https://datatracker.ietf.org/doc/html/rfc6265#section-4.1.1). But,
Supabase Auth's library encodes stored items as JSON.

This means that, technically, these values must not be used as-is as cookies
and some transformation to the JSON needs to be made to conform to the
restriction.

This is because:

- JSON is full of `"`, which appear to be banned and can be mis-interpreted.
- JSON can hold any UTF-8 sequence, which is not US ASCII. This means that if
  the stored session holds any character (like a Chinese, Japanese or Cyrillic
  user name) it should technically be not accepted and is open to
  mis-interpretation.

#### Versions at or before 0.3.0

Up to version 0.3.0 this limitation for cookies was ignored, and likely
contributed to confused servers, browsers, developers and users.

Therefore, the raw JSON values (chunked or not) were split up without regards
to the limitations and set as cookies.

#### Versions after 0.3.0

To force the library's behavior into compliance, after version 0.3.0 a new
encoding strategy is developed for cookie values.

It utilizes Base64-URL encoding in the following manner:

1. The value is prefixed with `base64-` which allows the library to detect the
   encoding used.
2. The value is encoded using Base64-URL and appended to the prefix, without
   any white space or padding (`=`) characters.
3. If the whole prefix + encoded value needs to be chunked, it's chunked as a
   whole string.

Therefore to read a value from cookies, the library uses this algorithm:

1. If the value starts with `base64-`, read the rest of it, decode it from Base64
   and return it.
2. If the value does not start with `base64-` and there is another prefix
   defined then attempt to use the indicated encoding algorithm. If that
   algorithm is not supported, either return an error or return a null value.
3. Finally, the value does not seem to be an encoded value, so try to read it
   as-is (raw) and return it.

This algorithm allows for backward and forward compatibility between versions
0.3.0 and above including the introduction of new/different encoding
strategies.

## SSR framework patterns

All SSR frameworks today can be described as having the following patterns:

1. **Middleware.** This is a function that runs on the server _before_ any
   rendering is done. It has access to the whole request, including headers,
   cookies and other infromation. Usually these functions have the right to
   change the response headers as well, such as for setting cookies. They are
   often used to:
   - Redirect to other pages (like to `/sign-in` to ask the user to sign in, or
     `/verify-mfa` to ask them to go through MFA)
   - Return responses (such as 401, 403 and others)
2. **Routes or APIs.** These are functions that help developers implement APIs
   for their applications without needing to build a separate API server. These
   are often useful with traditional [HTML forms](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form) or
   simply for offloading slow or privileged tasks. These functions have access to
   the full request context
   and are able to return any response, including setting headers.
3. **Server pages and components.** These are React components (sometimes
   organized as pages) which can be rendered on the server. Most React features
   that enable interactivity, such as click handlers, `useEffect`, `useContext` or
   React Query are **not available.** Usually only basic `fetch` is allowed, with
   some form of additional caching provided. In most SSR frameworks when a page or
   component is rendered on the server **accessing request information is
   limited or not available, with the exception of access to cookies**. <ins>It is
   not possible to **set cookies**.</ins>
4. **Client (browser) pages and components.** These are React components that are
   [hydrated](https://react.dev/reference/react-dom/client/hydrateRoot) into
   life after the server has returned the rendered response for the page. They run
   inside the browser's runtime, and have full access to the
   [`document.cookie`](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie)
   API for reading and writing cookies.

As you can see, patterns 1 and 2 allow full access to cookies on the server,
while pattern 3 allows for read-only access on the server. This means that any
Supabase Client object on the server must be able to conditionally "set"
cookies and always allow access to reading them.

As the cookie access method per framework (or version of framework) varies, the
`createServerClient` function exposes an interface for getting and optionally
setting cookies:

- `getAll` a function that returns _all_ cookies associated with the request as
  an array of `{ name: string; value: string }` objects. It's important to
  return all cookies, as the server may need to "delete" cookies by setting them
  to `Max-Age=0` such as when moving from more chunks to less chunks.
- `setAll` a function whose first argument is an array of cookie objects `{
name: string; value: string; options: CookieOptions }`. Each of those _must_
  be set **both on the request (when available, usually in middlewares) and response**. If the client is used in server-rendered pages and components (pattern 3) and setting of cookies is not possible, the library must emit a warning that setting of cookies is required but not available. This is a developer aid to help identify mutations in server-rendering which is a code smell.

On the browser (client) the `createBrowserClient` function will use the
underlying `document.cookie` API automatically. If this is not supported for
some reason, **both `getAll` and `setAll` must be specified.** The client must
always be able to set cookies, as access tokens and refresh tokens are
continuously issued while the user is interacting with the page.

It is expected that `getAll` sees the changes created by `setAll`!

### When does the server `setAll`?

Server-side rendering frameworks attempt to make it easy to generate HTML on
the server, which improves important web metrics like (Time to first byte,
First contentful paint, etc.).

It's important to notice that server-rendering _primarily_ comes into play on
fresh page loads. Once a page has been rendered and hydrated in the browser,
client React compoenents take over. When using the Supabase Auth library in the
browser in such a way, the user's session (access and refresh tokens) are
proactively and ahead-of-time refreshed, meaning that they are continuously set
as cookies well ahead of their expiry time.

From this it naturally follows that the most critical user session refresh
point is when the user has not interacted with the page in a while, such as
opening a new tab after a full night of partying.

Say the website `app.example.com` is developed in an SSR framework. What
happens when a user opens a brand new tab after a while and types
`app.example.com<Enter>` in the address bar is this:

1. The browser sends a request to `https://app.example.com` with all the
   cookies in its store.
2. The middleware (pattern 1) is invoked.
3. The server client is created with a `getAll` that retrieves the cookies.
4. The server client notices that the access token stored in the cookies has
   been expired for hours or days.
5. It calls the `POST /token?grant_type=refresh_token` endpoint of Supabase
   Auth to get a new access token (or to detect that the user has been signed
   out due to session termination).
6. Finally calls `setAll` with the new cookies that need to be set or cleared.

Once this process is complete, and the effect of `setAll` is returned to the
browser as `Set-Cookie` headers in the response, both browser and server are
in-sync with regards to the user session.

So long as the user continues interacting with the website, the browser client
will keep the access token up-to-date so any future server-side rendering is
unlikely to need to refresh the user's session.

There are two key points to identify from this about the behavior of
`createServerClient`:

1. **Using the middleware pattern is mandatory. Session refresh happens in the
   middleware.** Not using a middleware function means that the session will
   likely not be properly refreshed, given that server pages and components don't
   always get to set cookies.
2. **Cookies are set when the storage values change. Set-Cookie headers should
   not be sent out if there is no change.** Therefore cookies are set only on
   these `onAuthStateChange` events:
   - `TOKEN_REFRESHED` -- when the access token was expired
   - `USER_UPDATED` -- usually only in pattern 3 -- routes or APIs that call the `updateUser()` API
   - `SIGNED_OUT` when the session expired or was terminated, such as the user signing out from another device
