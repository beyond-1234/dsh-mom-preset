/**
 * Host half of `dsh-mom-ui`.
 *
 * Intentionally empty: this package contributes browser presentation only. The
 * row still has to exist, because `dsh-client-modules` discovers client plugins
 * by scanning the host Loader's enabled entries for packages declaring
 * `dsh.client` — without a host-side row the browser bundle would never be
 * served. The same one-line no-op is what the shipped
 * `@deepseek-ai/dsh-client-ui-brand-official` uses.
 *
 * All behaviour lives in `./client`, reached through `exports["./client"]`.
 */

/** Host plugin body — this package contributes browser presentation only. */
export function apply() {}
