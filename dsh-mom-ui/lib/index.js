/**
 * Host half of `dsh-mom-ui`: it SERVES THE ART.
 *
 * The row exists for two reasons, and both are load-bearing:
 *
 *   1. `dsh-client-modules` discovers client plugins by scanning the host
 *      Loader's enabled entries for packages declaring `dsh.client`. Without a
 *      host-side row the browser bundle would never be served at all. (The same
 *      no-op shape is what the shipped `@deepseek-ai/dsh-client-ui-brand-official`
 *      uses.)
 *   2. It publishes `ds_mom.png` over HTTP, so the browser half can point at a URL
 *      instead of carrying the art as a base64 string inside `lib/client.js`.
 *      `dsh-client-modules` serves exactly one file per plugin (`exports["./client"]`)
 *      and no static-asset route, so without this route a plugin has no way to
 *      deliver a second file — the only alternatives are inlining the bytes or
 *      fetching them from a server that does not exist yet.
 *
 * WHY THE RESPONSE IS NEVER CACHED. The point of the URL is that replacing
 * `ds_mom.png` takes effect on reload, with no build step and no edit to
 * `lib/client.js`. That only holds if the browser asks every time: a cached
 * response would be invisible to the new file. `no-store` is therefore part of
 * the contract, not a tuning knob — and because it is, the client can use a plain
 * path with no cache-busting query, which is what keeps a new image from
 * requiring a code change.
 *
 * THE IMAGE IS THE SOURCE FILE, UNCROPPED. The client renders it with
 * `background-size: contain` into a box it sizes from the image's own aspect
 * ratio, so a source of the same canvas aspect needs no geometry update here. See
 * the note in `client.js` for what a differently shaped source would require.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** The webserver owns the socket; this plugin needs its route registry. */
export const inject = ['webServer']

/** Route path. `client.js` hardcodes this same string; `test/bundle.mjs` checks they agree. */
export const ART_ROUTE = '/mom/art.png'

/** The one art file: the repository root, one level above this package's `lib/`. */
const ART_FILE = fileURLToPath(new URL('../../ds_mom.png', import.meta.url))

const HEADERS = {
  'content-type': 'image/png',
  // Both halves of the no-cache contract: `no-store` keeps a conforming cache
  // from reusing the response, and the legacy pair covers intermediaries that
  // predate it. Deliberately NOT an ETag: a validator invites a 304, and a 304
  // means the browser keeps what it already drew.
  'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
  pragma: 'no-cache',
  expires: '0',
}

/**
 * Register the art route.
 *
 * The file is read per request on purpose — that is what makes an edited
 * `ds_mom.png` visible on the next reload.
 * @param ctx - the host context carrying the `webServer` service.
 */
export function apply(ctx) {
  ctx.webServer.register({
    kind: 'exact',
    path: ART_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' })
        res.end()
        return
      }
      let bytes
      try {
        bytes = await readFile(ART_FILE)
      } catch (error) {
        // A missing or unreadable source is reported as such instead of as an
        // empty image: the browser half simply has no art, and the reason is here.
        ctx.logger.warn('mom-ui: cannot read %s: %s', ART_FILE, String(error))
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        res.end('mom-ui: ds_mom.png is missing or unreadable\n')
        return
      }
      res.writeHead(200, { ...HEADERS, 'content-length': String(bytes.byteLength) })
      // A HEAD response carries the headers and no body.
      res.end(req.method === 'HEAD' ? undefined : bytes)
    },
  })
}
