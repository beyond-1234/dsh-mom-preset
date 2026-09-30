/**
 * Inline the prepared art into the client bundle.
 *
 *   node tools/prepare-art.mjs   # first: `ds_mom.png` → assets/mom-art.webp
 *   node tools/embed-art.mjs     # then:  assets/* → dsh-mom-ui/lib/client.js
 *
 * The browser half cannot fetch a package asset: `dsh-client-modules` serves
 * exactly one file per plugin (`exports["./client"]`) and no static-asset route,
 * so a data URI inside the bundle is the only way the art can reach the page. The
 * generated region in `lib/client.js` is marked and rewritten wholesale; the
 * binary stays the source of truth so it can be re-keyed or re-compressed without
 * touching the bundle by hand.
 *
 * Reads `assets/mom-art.json` rather than the image, so this step needs no image
 * library at all.
 */

import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ART = join(ROOT, 'assets/mom-art.webp')
const META = join(ROOT, 'assets/mom-art.json')
const BUNDLE = join(ROOT, 'dsh-mom-ui/lib/client.js')

const START = '// <<<dsh-mom-art>>>'
const END = '// <<<end-dsh-mom-art>>>'

const check = process.argv.includes('--check')
const meta = JSON.parse(readFileSync(META, 'utf8'))
const bytes = readFileSync(ART)
const dataUri = `data:image/webp;base64,${bytes.toString('base64')}`

const bundle = readFileSync(BUNDLE, 'utf8')
const start = bundle.indexOf(START)
const end = bundle.indexOf(END)
if (start === -1 || end === -1 || end < start) {
  throw new Error(`embed-art: markers not found in ${BUNDLE}; expected ${START} … ${END}`)
}

/**
 * Both numbers are load-bearing at runtime: the URL paints the art, and the
 * dimensions preserve her aspect ratio when the component solves for a size.
 */
const region = [
  START,
  `    const MOM_ART = '${dataUri}'`,
  `    const MOM_ART_WIDTH = ${String(meta.width)}`,
  `    const MOM_ART_HEIGHT = ${String(meta.height)}`,
  `    ${END}`,
].join('\n')

const updated = bundle.slice(0, start) + region + bundle.slice(end + END.length)

if (check) {
  const fresh = bundle.includes(bytes.toString('base64').slice(0, 64))
  console.log(`embed-art --check: ${fresh ? 'up to date' : 'STALE — run node tools/embed-art.mjs'}`)
  process.exitCode = fresh ? 0 : 1
} else if (updated === bundle) {
  console.log('embed-art: bundle already current (%d×%d, %s KB)', meta.width, meta.height, (bytes.length / 1024).toFixed(0))
} else {
  writeFileSync(BUNDLE, updated, 'utf8')
  const size = statSync(BUNDLE).size
  console.log('embed-art: inlined %d×%d art (%s KB → bundle %s KB)',
    meta.width, meta.height, (bytes.length / 1024).toFixed(0), (size / 1024).toFixed(0))
}
