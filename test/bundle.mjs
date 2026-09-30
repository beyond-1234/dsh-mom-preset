/**
 * Bundle tests: is this directory a well-formed, installable preset bundle?
 *
 *   node test/bundle.mjs
 *
 * This file replaces the old installer tests. There is no installer any more:
 * the bundle is a static artifact (`package.json` declaring `dsh.bundle.patch`,
 * plus the patch it points at), installed into a profile by `plugin_manager`
 * `install_bundle`. So the only way to break it is to break the artifact, and
 * that is what these assertions look at.
 *
 * The two failure modes worth naming, because both have bitten this repo:
 *
 *   - a name the Loader cannot resolve. In a patch, a bare specifier must be an
 *     installed harness package and a relative one must exist BESIDE THE PATCH.
 *     An unresolvable child does not degrade — it fails the whole preset's
 *     activation, and the roster then refuses every session that selects it.
 *   - two active Loader entries resolving to one package, which is why
 *     `dsh-mom-ui` must declare no `dsh.bundle` of its own.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
let checks = 0

function check(label, actual, expected) {
  checks += 1
  const ok = Object.is(actual, expected)
  if (!ok) failures += 1
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${ok ? '' : ` — expected ${String(expected)}, got ${String(actual)}`}`)
}

function checkTruthy(label, actual) {
  checks += 1
  if (!actual) failures += 1
  console.log(`${actual ? '  ok  ' : ' FAIL '} ${label}`)
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`)
}

/**
 * Locate the installed harness's `node_modules`, so the patch is parsed by the
 * same js-yaml the host uses and its module names are checked against the real
 * package set.
 *
 * `dsh web` is usually launched through `npx @deepseek-ai/dsh`, which leaves no
 * `dsh` on PATH — so the npx cache is searched too, and the dependent checks only
 * skip when the harness really is not installed anywhere reachable.
 * @returns the `node_modules` directory, or undefined when no harness is found.
 */
function findHarnessModules() {
  const candidates = []
  try {
    candidates.push(dirname(realpathSync(execFileSync('which', ['dsh'], { encoding: 'utf8' }).trim())))
  } catch {
    // not on PATH; fall through to the npx cache
  }
  const npxCache = join(homedir(), '.npm/_npx')
  if (existsSync(npxCache)) {
    for (const entry of readdirSync(npxCache)) candidates.push(join(npxCache, entry, 'node_modules'))
  }
  // Newest first: an npx cache accumulates one directory per published version,
  // and the last one installed is the one the host is actually running.
  for (const nodeModules of candidates.reverse()) {
    const directory = join(nodeModules, '@deepseek-ai')
    if (existsSync(join(directory, 'dsh-web-app/cordis.patch.yml')) && existsSync(join(nodeModules, 'js-yaml'))) {
      return nodeModules
    }
  }
  return undefined
}

const MODULES = findHarnessModules()

/**
 * Parse a patch file with the harness's own js-yaml plus the loader's `!!js`
 * scalar tag, so the artifact is checked against the same parser whose failure
 * would abort the profile boot.
 * @param nodeModules - a `node_modules` directory holding the harness packages.
 * @param file - the YAML file to parse.
 * @returns the parsed document.
 */
function loadYamlFile(nodeModules, file) {
  const require = createRequire(join(nodeModules, '@deepseek-ai/dsh/package.json'))
  const yaml = require('js-yaml')
  const jsTag = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: (value) => value })
  return yaml.load(readFileSync(file, 'utf8'), { schema: yaml.DEFAULT_SCHEMA.extend([jsTag]) })
}

/**
 * Does one bare Loader entry name resolve inside the installed harness?
 *
 * A preset child the Loader cannot import does not degrade to a missing tool: it
 * fails the whole definition's activation, `agent-presets` records the
 * diagnostic, and the roster then refuses every session that selects it.
 * @param nodeModules - a `node_modules` directory holding the harness packages.
 * @param name - the entry's `name`: a bare specifier with an optional subpath.
 * @returns true when the package, and any subpath export, both exist.
 */
function resolveHarnessModule(nodeModules, name) {
  const segments = name.split('/')
  const packageName = name.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
  const subpath = name.startsWith('@') ? segments.slice(2) : segments.slice(1)
  const manifest = join(nodeModules, packageName, 'package.json')
  if (!existsSync(manifest)) return false
  if (subpath.length === 0) return true
  const exported = JSON.parse(readFileSync(manifest, 'utf8')).exports ?? {}
  return Object.prototype.hasOwnProperty.call(exported, `./${subpath.join('/')}`)
}

/**
 * Walk an entry list and call `visit` on every row, descending into both
 * `cordis:group` children and a preset declaration's `config.plugins`.
 * @param rows - a parsed entry list.
 * @param visit - callback receiving each row.
 */
function walkRows(rows, visit) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row === null || typeof row !== 'object') continue
    visit(row)
    if (Array.isArray(row.config)) walkRows(row.config, visit)
    if (Array.isArray(row.config?.plugins)) walkRows(row.config.plugins, visit)
  }
}

// ════════════════════════════════════════════════════════════════════════════
section('bundle · the package declaration')
// ════════════════════════════════════════════════════════════════════════════

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
checkTruthy('package.json declares a name', typeof manifest.name === 'string' && manifest.name.length > 0)
check('and is private, so it is never published by accident', manifest.private, true)

const declared = typeof manifest.dsh?.bundle?.patch === 'string'
  ? [manifest.dsh.bundle.patch]
  : manifest.dsh?.bundle?.patch
checkTruthy('it declares dsh.bundle.patch', Array.isArray(declared) && declared.length > 0)
const patchPaths = (Array.isArray(declared) ? declared : []).map((file) => join(ROOT, file))
for (const file of patchPaths) {
  check(`the declared patch exists (${file.slice(ROOT.length + 1)})`, existsSync(file), true)
}

// ════════════════════════════════════════════════════════════════════════════
section('bundle · the patch is a valid profile layer')
// ════════════════════════════════════════════════════════════════════════════

if (MODULES === undefined) {
  console.log('  skip  harness not on PATH — parse and resolution checks skipped')
} else {
  const patches = patchPaths.filter((file) => existsSync(file)).map((file) => loadYamlFile(MODULES, file))
  checkTruthy('every declared patch parses as a top-level row list', patches.length > 0 && patches.every(Array.isArray))

  const inserted = patches.flatMap((rows) => rows.flatMap((patch) => patch?.insert ?? []))
  check('it inserts the preset declaration', inserted.some((row) => row.id === 'preset-mom'), true)
  check('and the browser half', inserted.some((row) => row.id === 'mom-ui'), true)

  const declaration = inserted.find((row) => row.id === 'preset-mom')
  check('the declaration names the preset plugin', declaration?.name, '@deepseek-ai/dsh-agent-preset')
  check('registers it as id mom', declaration?.config?.id, 'mom')
  check('with the display name the selector shows', declaration?.config?.name, '妈妈模式')
  check('and a numeric order', typeof declaration?.config?.order, 'number')

  const plugins = declaration?.config?.plugins
  checkTruthy('carrying a composition', Array.isArray(plugins) && plugins.length > 0)
  const ids = Array.isArray(plugins) ? plugins.map((row) => row.id) : []
  // The two mom layers that make this preset itself, rather than a copy of
  // `standard`: the rewritten persona and the policy row.
  checkTruthy('including the persona row', ids.includes('persona'))
  checkTruthy('and the mom-mode policy row', ids.includes('mom-mode'))

  // ── NAME RESOLUTION ───────────────────────────────────────────────────────
  // The check whose absence let an uninstallable row ship once already.
  const relative = []
  const bare = []
  walkRows(inserted, (row) => {
    if (typeof row.name !== 'string' || row.name === 'cordis:group') return
    if (/^\.\.?\//.test(row.name)) relative.push({ id: row.id, name: row.name })
    else if (!row.name.startsWith('/') && !row.name.includes(':')) bare.push({ id: row.id, name: row.name })
  })

  // A relative name is anchored beside the patch file, so it has to exist there.
  // This is what replaced the old installer's absolute-path rewriting: get it
  // wrong and the preset mounts with a child the Loader cannot import.
  for (const row of relative) {
    check(`relative ${row.name} exists beside the patch`, existsSync(join(ROOT, row.name)), true)
  }
  check('exactly one row is relative — the inserted browser half', relative.length, 1)
  checkTruthy('and none of the rows is an absolute path', ![...relative, ...bare].some((row) => row.name.startsWith('/')))

  // Bare names come in two kinds with two different bases. A HARNESS package
  // resolves from the installed deployment; the bundle's OWN name resolves from
  // the profile directory, where the installed bundle is symlinked. Checking the
  // second against the first would fail a healthy bundle.
  const harnessBare = bare.filter((row) => row.name !== manifest.name)
  const selfNamed = bare.filter((row) => row.name === manifest.name)
  const unresolved = harnessBare.filter((row) => !resolveHarnessModule(MODULES, row.name))
  check(`all ${String(harnessBare.length)} harness module names resolve`, unresolved.length, 0)
  for (const row of unresolved) console.log(`        unresolved: ${row.id} → ${row.name}`)
  check('and exactly one row names the bundle itself', selfNamed.length, 1)

  // ── POLICY ────────────────────────────────────────────────────────────────
  const momRow = Array.isArray(plugins) ? plugins.find((row) => row.id === 'mom-mode') : undefined
  // A preset CHILD does not resolve like an inserted row: `mountPreset` mounts it
  // with the DECLARING plugin's base (the registry's), so a relative path lands in
  // the profile directory and the preset comes up `broken: never started`. A bare
  // name resolves against the profile directory, where the installed bundle is
  // symlinked — so the agent half is named by the bundle's own package name.
  check('the policy row names the bundle package', momRow?.name, manifest.name)
  const policy = momRow?.config?.policy
  checkTruthy('carrying the tuned policy', typeof policy === 'string' && policy.length > 100)
  checkTruthy('and the anti-flattery guardrail', String(policy).includes('不拣好听的哄他'))
  checkTruthy('and the address rules', String(policy).includes('宝宝') && String(policy).includes('孩子'))
  // The affirmation machinery was removed on purpose; a stale key here would be
  // silently ignored by the plugin rather than failing loudly.
  for (const gone of ['moods', 'affirmations', 'includeFirstTurn']) {
    check(`the row no longer configures ${gone}`, Object.hasOwn(momRow?.config ?? {}, gone), false)
  }

  // ── DRIFT ─────────────────────────────────────────────────────────────────
  // Reported, never asserted: the composition is documented as a SNAPSHOT of the
  // shipped `standard` preset, so a DSH upgrade changing that list is expected
  // rather than broken. It is printed because silent drift is how the
  // unresolvable `workflow-worker-thread` row survived review.
  const standardPatch = join(MODULES, '@deepseek-ai/dsh-web-app/presets/standard.patch.yml')
  if (!existsSync(standardPatch)) {
    console.log('  skip  shipped standard preset not found — drift report skipped')
  } else {
    const flatten = (rows) => {
      const flat = new Map()
      const walk = (list, prefix) => {
        for (const row of Array.isArray(list) ? list : []) {
          if (row === null || typeof row !== 'object') continue
          const key = `${prefix}${String(row.id ?? '?')}|${String(row.name ?? '?')}`
          flat.set(key, { disabled: row.disabled, isolate: row.isolate, config: Array.isArray(row.config) ? undefined : row.config })
          if (Array.isArray(row.config)) walk(row.config, `${key}/`)
        }
      }
      walk(rows, '')
      return flat
    }
    const mom = flatten(plugins)
    const shipped = loadYamlFile(MODULES, standardPatch)
    const standard = flatten(
      shipped.find((patch) => patch?.insert !== undefined)
        ?.insert.find((row) => row.id === 'preset-standard')?.config?.plugins,
    )
    const INTENTIONAL = new Set(['persona|@deepseek-ai/dsh-persona', `mom-mode|${manifest.name}`])
    const drift = []
    for (const key of [...new Set([...mom.keys(), ...standard.keys()])].sort()) {
      if (INTENTIONAL.has(key)) continue
      const left = standard.get(key)
      const right = mom.get(key)
      if (left === undefined) drift.push(`only in the preset: ${key}`)
      else if (right === undefined) drift.push(`missing from the preset: ${key}`)
      else if (JSON.stringify(left) !== JSON.stringify(right)) drift.push(`changed: ${key}`)
    }
    if (drift.length === 0) {
      console.log('  ok   the composition is the shipped standard plus the two mom layers')
    } else {
      console.log(`  WARN ${String(drift.length)} row(s) differ from the installed standard preset`)
      console.log('        (expected after a DSH upgrade — re-sync cordis.patch.yml)')
      for (const line of drift) console.log(`        ${line}`)
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
section('bundle · the two plugin halves are packages with the right faces')
// ════════════════════════════════════════════════════════════════════════════

{
  // `dsh-mom-ui` must NOT declare `dsh.bundle`. Two active Loader entries
  // resolving to the same package name make `dsh-client-modules` throw, the
  // fiber fails, `window.__DSH_BOOT__` is never injected, and the whole Web
  // client goes dark — a browser-side guard cannot help, because the host is
  // already dead.
  const ui = JSON.parse(readFileSync(join(ROOT, 'dsh-mom-ui/package.json'), 'utf8'))
  checkTruthy('dsh-mom-ui declares its browser half', ui.dsh?.client !== undefined)
  check('and declares no dsh.bundle of its own', ui.dsh?.bundle, undefined)
  const clientEntry = ui.exports?.['./client']
  const clientFile = typeof clientEntry === 'string' ? clientEntry : clientEntry?.default
  checkTruthy('and exports a ./client bundle', typeof clientFile === 'string')
  check('which exists on disk', existsSync(join(ROOT, 'dsh-mom-ui', clientFile)), true)

  // The agent half is loaded as a bare file path by the preset. Its own
  // package.json is what tells Node the file is ESM — without it Node guesses,
  // warns (MODULE_TYPELESS_PACKAGE_JSON), and would refuse the file outright if
  // any ancestor package.json said `"type": "commonjs"`.
  // What makes `dsh-mom-preset` a legal preset child: the bundle package answers
  // as a plugin. `@deepseek-ai/dsh-web-app` has exactly this shape — one package
  // that is both a profile layer and a plugin.
  const selfEntry = typeof manifest.exports?.['.'] === 'string' ? manifest.exports['.'] : manifest.exports?.['.']?.default
  const selfMain = selfEntry ?? manifest.main
  checkTruthy('the bundle package answers as a plugin', typeof selfMain === 'string')
  check('whose entry exists on disk', existsSync(join(ROOT, selfMain)), true)

  const agent = JSON.parse(readFileSync(join(ROOT, 'dsh-mom-mode/package.json'), 'utf8'))
  check('dsh-mom-mode is explicit about being ESM', agent.type, 'module')
  check('and declares no dsh.bundle either', agent.dsh?.bundle, undefined)
  check('its main entry exists on disk', existsSync(join(ROOT, 'dsh-mom-mode', agent.main)), true)
}

// ════════════════════════════════════════════════════════════════════════════
section('bundle · the agent half injects nothing')
// ════════════════════════════════════════════════════════════════════════════

{
  // This replaced a check that drove the plugin's `agent/pre-step` listener and
  // ran its built message through the harness's own `assertV4RowAdmission`: that
  // message once shipped a retired v3 source wrapper and failed every turn. The
  // plugin builds no messages now, which retires the failure mode entirely — the
  // strongest form of "the row is admitted" is having no row.
  const modes = await import(pathToFileURL(join(ROOT, 'dsh-mom-mode/index.js')).href)
  const subscribed = []
  let registered = null
  modes.apply(
    {
      systemPrompt: { section: (value) => { registered = value; return () => {} } },
      on: (event) => { subscribed.push(event) },
    },
    {},
  )
  check('the plugin subscribes to no agent events', subscribed.join(','), '')
  check('and registers exactly the policy section', registered?.name, 'mom:policy')
}

// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${String(checks - failures)}/${String(checks)} checks passed`)
process.exitCode = failures === 0 ? 0 : 1
