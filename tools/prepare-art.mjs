/**
 * Turn `ds_mom.png` into the art the client bundle embeds.
 *
 *   node tools/prepare-art.mjs            # ds_mom.png → assets/mom-art.webp
 *   node tools/prepare-art.mjs --inspect  # diagnostics only, no output
 *
 * Two source shapes are supported, decided by whether the PNG carries an alpha
 * channel:
 *
 *   alpha present  → trim → resize → encode. Nothing touches the pixels; the
 *                    author already did the keying, and second-guessing it only
 *                    risks eating her outline.
 *   alpha absent   → key first (see `keyField`), then the same three steps.
 *
 * The keyer is a flood fill inward from the border, NOT a global colour
 * predicate. The current source is a figure on a flat black field, and her own
 * art contains ~1000–3600 near-black pixels (line art, the dark navy of her hair
 * and skirt) that a global threshold would punch out of her body as holes. Only
 * pixels *reachable from the border* are background, so interior darks survive.
 *
 * A source that is neither — no alpha, and no flat field around the edges — is a
 * case the keyer cannot serve, so it fails loudly rather than quietly producing a
 * black rectangle.
 *
 * The other thing that needs care is the trim threshold. A keying/authoring pass
 * can leave a faint alpha trail out to the side of the subject (alpha 1–15), and
 * trimming on `alpha > 0` inflates the box — earlier revisions measured 988px
 * against a real 523px. That is not cosmetic: the frame's width/height feed the
 * component's aspect solve, so an inflated box would draw her roughly half the
 * intended size. `ALPHA_FLOOR` ignores such a trail, and the diagnostics print
 * both boxes so the fault stays visible instead of silent.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'ds_mom.png')
const TARGET = join(ROOT, 'assets/mom-art.webp')
const SIDECAR = join(ROOT, 'assets/mom-art.json')

/** Alpha at or below this is treated as empty canvas when trimming. */
const ALPHA_FLOOR = 16
/** Breathing room kept around the subject, in source pixels. */
const PAD = 8
/** The art is shown at most ~80vh, so 1600px covers a 2x display. */
const OUT_HEIGHT_CAP = 1600
/** A pixel counts as "the flat field" when no channel exceeds this (0–255). */
const KEY_LEVEL = 20
/** Radius of the silhouette blur that antialiases the keyed edge, in pixels. */
const KEY_EDGE = 2
/** The keyer only makes sense if the field is a minority of the canvas. */
const KEY_MAX_SHARE = 0.95
const KEY_MIN_SHARE = 0.05

// sharp is not a dependency of this repo; borrow the harness copy, located by
// following the `dsh` binary, so the tool runs with no install step.
const require = createRequire(import.meta.url)
function loadSharp() {
  const candidates = []
  if (process.env.SHARP_PATH) candidates.push(process.env.SHARP_PATH)
  candidates.push(join(ROOT, 'node_modules/sharp'))
  let bin
  try {
    bin = realpathSync(execFileSync('which', ['dsh'], { encoding: 'utf8' }).trim())
  } catch {
    bin = undefined
  }
  if (bin !== undefined) {
    let directory = dirname(bin)
    while (true) {
      const candidate = join(directory, 'sharp')
      if (existsSync(candidate)) {
        candidates.push(candidate)
        break
      }
      const parent = dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(
    'prepare-art: sharp not found. Install it here, or run where `dsh` is on PATH so the harness copy is reachable.',
  )
}

const sharp = loadSharp()
const inspectOnly = process.argv.includes('--inspect')

const meta = await sharp(SOURCE).metadata()
const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info
const count = W * H

/** Largest channel of a pixel — the keyer reads "how far from black", not hue. */
function peak(i) {
  const o = i * C
  return Math.max(data[o], data[o + 1], data[o + 2])
}

/**
 * Alpha the flat field out of an opaque source, in place.
 *
 * The field is grown inward from the border through pixels no brighter than
 * `KEY_LEVEL`; anything the fill cannot reach stays part of the subject, which is
 * what keeps her near-black line art and dark navy hair intact instead of
 * perforated. The edge is then antialiased two ways at once — a small box blur of
 * the silhouette, and a ramp on the fringe's own brightness — because the pixels
 * straddling a black field are *darkened by it*, and left at full alpha they would
 * carry a black halo onto any background the UI paints behind her.
 *
 * Returns diagnostics; throws when the source is not a figure on a flat field,
 * because in that case a key either does nothing or eats the subject.
 */
function keyField() {
  const isField = (i) => peak(i) <= KEY_LEVEL
  const field = new Uint8Array(count)
  const stack = new Int32Array(count)
  let sp = 0
  const grow = (i) => {
    if (field[i] === 0 && isField(i)) {
      field[i] = 1
      stack[sp] = i
      sp += 1
    }
  }
  for (let x = 0; x < W; x += 1) {
    grow(x)
    grow((H - 1) * W + x)
  }
  for (let y = 0; y < H; y += 1) {
    grow(y * W)
    grow(y * W + W - 1)
  }
  while (sp > 0) {
    const i = stack[--sp]
    const x = i % W
    const y = (i / W) | 0
    if (x > 0) grow(i - 1)
    if (x < W - 1) grow(i + 1)
    if (y > 0) grow(i - W)
    if (y < H - 1) grow(i + W)
  }

  let fieldPixels = 0
  let keptDark = 0
  for (let i = 0; i < count; i += 1) {
    if (field[i] === 1) fieldPixels += 1
    else if (isField(i)) keptDark += 1
  }
  const share = fieldPixels / count
  if (share < KEY_MIN_SHARE || share > KEY_MAX_SHARE) {
    throw new Error(
      `${SOURCE} has no alpha channel and its border is not a flat field (${(share * 100).toFixed(1)}% of the canvas keyed). ` +
        'The keyer only handles a subject on a uniform backdrop — supply a transparent PNG instead.',
    )
  }

  const solid = new Float32Array(count)
  for (let i = 0; i < count; i += 1) solid[i] = field[i] === 1 ? 0 : 1
  const span = KEY_EDGE * 2 + 1
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let sum = 0
      let seen = 0
      for (let dy = -KEY_EDGE; dy <= KEY_EDGE; dy += 1) {
        const yy = y + dy
        if (yy < 0 || yy >= H) continue
        for (let dx = -KEY_EDGE; dx <= KEY_EDGE; dx += 1) {
          const xx = x + dx
          if (xx < 0 || xx >= W) continue
          sum += solid[yy * W + xx]
          seen += 1
        }
      }
      const i = y * W + x
      if (field[i] === 1) {
        data[i * C + 3] = 0
      } else {
        const fringe = Math.min(1, peak(i) / (KEY_LEVEL * 2))
        data[i * C + 3] = Math.round(Math.max(sum / seen, fringe) * 255)
      }
    }
  }
  return { share, keptDark, span }
}

const keyed = meta.hasAlpha === true ? undefined : keyField()
if (meta.hasAlpha === true) {
  console.log('prepare-art: source %dx%d, alpha already present — not re-keying', W, H)
} else {
  console.log('prepare-art: source %dx%d, no alpha — keying the flat field', W, H)
  console.log('  field keyed from the border  : %s%% of the canvas', (keyed.share * 100).toFixed(1))
  console.log('  near-black pixels kept       : %d  ← interior line art, unreachable from the border',
    keyed.keptDark)
}

/** Bounding box of the pixels at or above an alpha threshold. */
function box(threshold) {
  let minX = W
  let minY = H
  let maxX = -1
  let maxY = -1
  let pixels = 0
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (data[(y * W + x) * C + 3] < threshold) continue
      pixels += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return maxX < 0
    ? null
    : { minX, minY, maxX, maxY, pixels, width: maxX - minX + 1, height: maxY - minY + 1 }
}

const anyAlpha = box(1)
const subject = box(ALPHA_FLOOR)
if (subject === null) throw new Error('prepare-art: the source has no pixels above the alpha floor')

let transparent = 0
for (let i = 0; i < count; i += 1) if (data[i * C + 3] === 0) transparent += 1

console.log('  fully transparent          : %s%%', ((transparent / count) * 100).toFixed(1))
console.log('  subject bbox (alpha>=%d)   : %dx%d  aspect %s', ALPHA_FLOOR, subject.width, subject.height,
  (subject.width / subject.height).toFixed(3))
if (anyAlpha !== null && (anyAlpha.width !== subject.width || anyAlpha.height !== subject.height)) {
  console.log('  bbox if trimmed on alpha>0 : %dx%d  ← alpha-noise trail, ignored on purpose',
    anyAlpha.width, anyAlpha.height)
} else {
  console.log('  no alpha-noise trail       : the trim box is the same at either threshold')
}
console.log('  subject fills the canvas   : %s%% wide, %s%% tall',
  ((subject.width / W) * 100).toFixed(1), ((subject.height / H) * 100).toFixed(1))

if (subject.pixels < count * 0.001) {
  throw new Error('prepare-art: the subject is essentially empty; check the source image')
}

if (inspectOnly) process.exit(0)

const left = Math.max(0, subject.minX - PAD)
const top = Math.max(0, subject.minY - PAD)
const boxWidth = Math.min(W - left, subject.width + PAD * 2)
const boxHeight = Math.min(H - top, subject.height + PAD * 2)

const pipeline = sharp(data, { raw: { width: W, height: H, channels: C } })
  .extract({ left, top, width: boxWidth, height: boxHeight })
  .resize({ height: Math.min(boxHeight, OUT_HEIGHT_CAP), fit: 'inside', withoutEnlargement: true })

// Lossy alpha WebP is dramatically smaller for a line-art subject and its
// artefacts are invisible at the sizes this is displayed at; take whichever wins.
const lossless = await pipeline.clone().webp({ lossless: true, effort: 5 }).toBuffer()
const lossy = await pipeline.clone().webp({ quality: 90, alphaQuality: 100, effort: 5 }).toBuffer()
const chosen = lossy.length < lossless.length ? lossy : lossless

mkdirSync(dirname(TARGET), { recursive: true })
writeFileSync(TARGET, chosen)

const encoded = await sharp(chosen).metadata()
writeFileSync(SIDECAR, `${JSON.stringify({
  width: encoded.width,
  height: encoded.height,
  bytes: chosen.length,
  format: 'webp',
}, null, 2)}\n`, 'utf8')

console.log('  trimmed                    : %dx%d → encoded %dx%d', boxWidth, boxHeight, encoded.width, encoded.height)
console.log('  webp lossless / lossy      : %s KB / %s KB', (lossless.length / 1024).toFixed(0), (lossy.length / 1024).toFixed(0))
console.log('  wrote %s (%s KB, %s)', TARGET, (chosen.length / 1024).toFixed(0), chosen === lossy ? 'lossy' : 'lossless')
console.log('  sidecar                    : assets/mom-art.json')
