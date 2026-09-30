/**
 * Smoke tests for 妈妈模式, runnable without a browser or a harness boot.
 *
 *   node test/smoke.mjs
 *
 * Covers the two halves separately, because they fail in different ways:
 *
 *   1. `dsh-mom-mode` (agent plane) — real ESM import. Asserts the plugin's shape
 *      (one prompt section, no agent-event subscriptions) and that the policy
 *      text reaching the model is the tuned one, free of rulebook, servile and
 *      idle-closing vocabulary.
 *
 *   2. `dsh-mom-ui` (browser plane) — the shipped `lib/client.js` bundle is
 *      executed against a stubbed `window.__ModuleLoader__`, materialized with
 *      stubbed `react`/primitives, and its `apply(ctx)` is driven with a fake
 *      client context. Every registered surface is then RENDERED under both a
 *      mom session and a standard session to prove the gate actually gates.
 */

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

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

// ════════════════════════════════════════════════════════════════════════════
section('dsh-mom-mode · plugin shape')
// ════════════════════════════════════════════════════════════════════════════

const mode = await import(join(ROOT, 'dsh-mom-mode/index.js'))

check('plugin name', mode.name, 'mom-mode')
// `agents` was only needed for the removed `agent/pre-step` listener. The plugin
// now registers one prompt section and nothing else, so it declares one service.
check('injects only the prompt registry', JSON.stringify(mode.inject), JSON.stringify(['systemPrompt']))
check('policy section name', mode.POLICY_SECTION, 'mom:policy')
// The affirmation machinery is gone from the module surface, not merely unused:
// a leftover export is how a removed feature comes back by accident.
for (const gone of ['DEFAULT_MOODS', 'DEFAULT_AFFIRMATIONS', 'classifyMood', 'phrasesFor', 'pickAffirmation', 'fnv1a32', 'boundSummary']) {
  check(`module no longer exports ${gone}`, Object.hasOwn(mode, gone), false)
}


// ════════════════════════════════════════════════════════════════════════════
section('dsh-mom-mode · behavioural policy')
// ════════════════════════════════════════════════════════════════════════════

let section_ = null
let subscribed = []
mode.apply({
  systemPrompt: { section: (value) => { section_ = value; return () => {} } },
  on: (event) => { subscribed.push(event) },
}, {})

// The whole point of the removal: this plugin contributes a prompt section and
// never touches the turn pipeline again.
check('subscribes to no agent events', subscribed.join(','), '')

check('registers the behavioural policy section', section_.name, 'mom:policy')
check('policy sorts immediately after the deployment persona prefix', section_.order, 1)
checkTruthy('policy text carries the anti-flattery guardrail', section_.text.includes('不拣好听的哄他'))

// ── voice guard ─────────────────────────────────────────────────────────────
// This text is read by the MODEL and steers its sentences. Rulebook vocabulary
// ("底线/绝不可以/必须/禁止") reads as a compliance gate and leaks exactly that
// stiffness into the replies it is supposed to warm up. Encoding the requirement
// as a test keeps a future edit from quietly reintroducing it.
const STIFF_VOCABULARY = [
  '门控', '闸', '底线', '绝不可以', '绝不能', '禁止', '严禁',
  '必须', '务必', '不得', '契约', '违规', '硬性', '强制',
]

// The other way the voice goes wrong: not stiff, but SERVILE. Closing every reply
// by asking to be given orders ("说一声就行") reads as a support desk, which is
// the opposite of the company this preset exists to be. The policy therefore
// carries only the positive move — ask what the user wants to do — and these
// phrases stay out of the prompt, exactly like the rulebook words above.
const SERVILE_VOCABULARY = [
  '说一声就行', '随时吩咐', '听候差遣', '随时待命', '有需要随时叫我', '随叫随到',
]

// Idle companionship filler: a reply whose WHOLE content is "go on, I'm
// listening". It answers nothing and asks nothing, so the user leaves with the
// question they arrived with — and it only looks like company because it fills
// the turn. Checked against the policy blocks only: several of these strings are
// legitimate MOM ASIDES in the `moods:` pool (`我在这儿呢，你说。`), which is a
// different speaker, so this list must never be pointed at that block.
const IDLE_VOCABULARY = [
  '我先听着', '我听着呢', '我在听', '你直接说', '你说吧', '我在这儿呢', '等着你说', '等你开口',
]

/** Extract a `key: |` / `key: |-` block scalar without a YAML dependency. */
function blockScalar(text, key) {
  const lines = text.split('\n')
  const head = lines.findIndex((line) => new RegExp(`^\\s*${key}:\\s*\\|[-+]?\\s*$`).test(line))
  if (head === -1) return undefined
  const indent = lines[head].match(/^\s*/)[0].length
  const body = []
  for (const line of lines.slice(head + 1)) {
    if (line.trim() !== '' && line.match(/^\s*/)[0].length <= indent) break
    body.push(line)
  }
  const contentIndent = Math.min(...body.filter((line) => line.trim() !== '').map((line) => line.match(/^\s*/)[0].length))
  return body.map((line) => line.slice(contentIndent)).join('\n').trim()
}

// The bundle patch IS the preset declaration now: `cordis.patch.yml` carries the
// composition inline, and `presets/` is gone. Read as text on purpose — this
// suite has no YAML parser, and the assertions below are about the wording.
const PRESET_TEXT = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8')
// The plugin is VENDORED into the preset directory, so the composition must name
// it preset-relatively. An absolute path here would go stale the moment the repo
// moved, and a stale path fails the Loader import (not a graceful degradation).
// The agent row names the bundle's own package. A preset CHILD does not inherit
// this patch's resolution base (see the note in `cordis.patch.yml`), so a relative
// path would land in the profile directory; a bare name resolves there, where the
// installed bundle is symlinked. Either way it must not be an absolute path — the
// old hand-rolled installer had to bake in a `$DSH_HOME` one.
checkTruthy("preset names its plugin by package name ('dsh-mom-preset')",
  /^\s*name:\s*'dsh-mom-preset'\s*$/m.test(PRESET_TEXT))
checkTruthy('and carries no absolute filesystem path', !/name:\s*'\/[^']*'/.test(PRESET_TEXT))

const PRESET_POLICY = blockScalar(PRESET_TEXT, 'policy')
const PRESET_PERSONA = blockScalar(PRESET_TEXT, 'prefix')

checkTruthy('preset carries its own tuned policy text', typeof PRESET_POLICY === 'string' && PRESET_POLICY.length > 100)
checkTruthy('preset carries its own persona prefix', typeof PRESET_PERSONA === 'string' && PRESET_PERSONA.length > 40)

for (const [label, text] of [
  ['plugin fallback policy', mode.DEFAULT_POLICY],
  ['preset policy', PRESET_POLICY],
  ['preset persona prefix', PRESET_PERSONA],
]) {
  const found = STIFF_VOCABULARY.filter((word) => text.includes(word))
  check(`${label} avoids rulebook vocabulary`, found.join(','), '')
}

// Given to the model, never asked of it: a reply that ends by requesting orders
// turns mom into a help desk. The positive move is what the policy states.
for (const [label, text] of [
  ['plugin fallback policy', mode.DEFAULT_POLICY],
  ['preset policy', PRESET_POLICY],
]) {
  const found = SERVILE_VOCABULARY.filter((word) => text.includes(word))
  check(`${label} never closes by asking for orders`, found.join(','), '')
}

// Nor may it idle: a reply that only offers to listen gives the user nothing.
for (const [label, text] of [
  ['plugin fallback policy', mode.DEFAULT_POLICY],
  ['preset policy', PRESET_POLICY],
]) {
  const found = IDLE_VOCABULARY.filter((word) => text.includes(word))
  check(`${label} never fills a turn by offering to listen`, found.join(','), '')
}

checkTruthy('preset policy keeps the anti-flattery guardrail', PRESET_POLICY.includes('不拣好听的哄他'))
checkTruthy('preset policy names everyday opening phrases', PRESET_POLICY.includes('辛苦了'))
// The other way the voice goes wrong: not saccharine, but written like a spec
// sheet ("跨半边契约", "去源码里核"). The rule is carried as the PREFERRED word,
// never as the avoided one — `契约` is itself in STIFF_VOCABULARY above, so
// naming it here would trip the guard three lines up.
checkTruthy('preset policy asks for "约定" over invented jargon', PRESET_POLICY.includes('约定'))
checkTruthy('plugin fallback policy keeps that same voice', mode.DEFAULT_POLICY.includes('约定'))
// The closing move, and a rule that had to be taken back out. This assertion
// used to REQUIRE the policy to say "问他有什么想做的" — which is precisely what
// made the model end every reply by asking. A model with nothing left to say
// obeyed the instruction and evaded the ban on the literal "要不要我……" frame
// with a paraphrase; the reasoning trace in `session-c86302e3` says so out
// loud: 「末尾别用'要不要我……'。可以问他：你现在想让我看点啥？」 So the guard
// now asserts the opposite, and the asking move is allowed only when the reply
// can offer real options.
checkTruthy('preset policy no longer tells the model to ask what to do',
  !PRESET_POLICY.includes('问他有什么想做的'))
// The rule then became a QUOTE BLACKLIST: it named the frames "要不要我……" and
// "还想做点什么", and the model obeyed the letter of it while doing the same
// act in other words. `session-4416bf36`'s reasoning shows that plainly — it
// reasons "别用'要不要我……'结尾" and then closes with "你就直接说想干啥吧".
// So the rule now names the ACT and ships no quotable frame to hide behind.
checkTruthy('the closing rule ships no quote to hide behind', !PRESET_POLICY.includes('要不要我……'))
checkTruthy('and names the act instead', PRESET_POLICY.includes('把话头递回去的问句'))
checkTruthy('with a test the model can apply itself', PRESET_POLICY.includes('这轮少没少东西'))
checkTruthy('while keeping a conditional, option-bearing ask', PRESET_POLICY.includes('把路摆出来让他挑'))

// ── voice direction, reversed on request ────────────────────────────────────
// The policy used to say 「句子短一点」, and the clipped verb chains it produced
// ("查源码、改文件、跑命令、看日志、盯风险") are what the user asked to stop.
checkTruthy('preset policy no longer asks for short sentences', !PRESET_POLICY.includes('句子短一点'))
checkTruthy('and spells compressed wording out instead', PRESET_POLICY.includes('展开成平时会说的整句话'))
checkTruthy('and names the terse register to avoid', PRESET_POLICY.includes('简洁干练'))
checkTruthy('the fallback carries the same direction', mode.DEFAULT_POLICY.includes('别把一句人话压成一个词组'))
// And when there is nothing to report, it says something real rather than
// offering to listen.
checkTruthy('preset policy says something real instead of idling', PRESET_POLICY.includes('实在没话可说'))
checkTruthy('preset persona keeps the {{model}} variable', PRESET_PERSONA.includes('{{model}}'))

{
  // The preset's own policy must actually reach the section: this is what makes
  // tuning the wording a YAML edit rather than a plugin edit.
  let hook = null
  let section = null
  mode.apply({
    systemPrompt: { section: (value) => { section = value; return () => {} } },
    on: () => {},
  }, { policy: PRESET_POLICY })
  check('a configured policy replaces the fallback', section.text === PRESET_POLICY, true)
  void hook
}


// ════════════════════════════════════════════════════════════════════════════
section('dsh-mom-ui · bundle loading')
// ════════════════════════════════════════════════════════════════════════════

let bundle = null
const styleTags = []
// The backdrop reads the frame's inline `grid-template-columns`, so the sandbox
// has to stand in for that DOM read. `sandbox.__columns` is the single knob the
// sizing tests turn.
// The thinking-label rewrite walks `[data-chat-running]`, which lives inside the
// shipped chat view. Stand in for that container with one mutable text node so
// the rewrite and its mom-gate are both observable.
const runningText = { nodeType: 3, data: '深度求索中，用时 3 秒 ···' }
// The shimmer's decoration layer paints from an ATTRIBUTE, not a text node:
// `TextShimmer` sets `data-shimmer-text` and the CSS draws it with
// `content: attr(data-shimmer-text)`. A text-node-only rewrite left the marquee
// showing the shipped words, which is exactly what shipped once.
const runningShimmer = {
  nodeType: 1,
  attrs: { 'data-shimmer-text': '深度求索中，用时 3 秒 ···' },
  getAttribute(name) { return this.attrs[name] ?? null },
  setAttribute(name, value) { this.attrs[name] = value },
}
const runningContainers = [{
  childNodes: [runningText],
  querySelectorAll: (selector) => (selector === '[data-shimmer-text]' ? [runningShimmer] : []),
}]
// The composer placeholder rewrite reads three carriers of the SAME string: the
// visible `[data-composer-placeholder]` text node, the editor's `data-placeholder`,
// and the `aria-label` that stands in for a placeholder attribute on a
// contenteditable. Rewriting only the visible one would leave the accessible name
// announcing the shipped words. `placeholderText` drives all three, so one fixture
// covers them together.
const placeholderText = { nodeType: 3, data: '发消息或创建任务, / 调用指令, @ 文件或对话' }
const placeholderContainer = { childNodes: [placeholderText] }
const placeholderSurface = {
  nodeType: 1,
  attrs: {
    'data-placeholder': '发消息或创建任务, / 调用指令, @ 文件或对话',
    'aria-label': '发消息或创建任务, / 调用指令, @ 文件或对话',
  },
  getAttribute(name) { return this.attrs[name] ?? null },
  setAttribute(name, value) { this.attrs[name] = value },
}
// A new session renders the composer as `variant: 'hero'`, which resolves to
// `placeholder.hero` — a DIFFERENT string with the same affordance tail. Rewriting
// only `placeholder.default` is why the new-session input still read 描述你想要构建的内容.
const heroPlaceholderText = { nodeType: 3, data: '描述你想要构建的内容, / 调用指令, @ 文件或对话' }
const heroPlaceholderContainer = { childNodes: [heroPlaceholderText] }
const heroPlaceholderSurface = {
  nodeType: 1,
  attrs: { 'data-placeholder': '描述你想要构建的内容, / 调用指令, @ 文件或对话' },
  getAttribute(name) { return this.attrs[name] ?? null },
  setAttribute(name, value) { this.attrs[name] = value },
}
// A situational placeholder must still survive untouched: `placeholder.unavailable`
// is a bare string with no tail, so it also proves the rewrite cannot fire on an
// arbitrary sentence that merely happens to sit in the same element.
const situationalPlaceholderText = { nodeType: 3, data: '会话不可用' }
const situationalPlaceholderContainer = { childNodes: [situationalPlaceholderText] }
const situationalPlaceholderSurface = {
  nodeType: 1,
  attrs: { 'data-placeholder': '会话不可用' },
  getAttribute(name) { return this.attrs[name] ?? null },
  setAttribute(name, value) { this.attrs[name] = value },
}

const sandbox = {
  console,
  Math,
  Date,
  JSON,
  window: {
    __ModuleLoader__: { load: (registration) => { bundle = registration } },
    innerHeight: 1000,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  document: {
    createElement: () => ({ dataset: {}, textContent: '', remove: () => { styleTags.pop() } }),
    head: { appendChild: (tag) => styleTags.push(tag) },
    querySelectorAll: (selector) => {
      if (selector === '[data-chat-running]') return runningContainers
      if (selector === '[data-composer-placeholder]') {
        return [placeholderContainer, heroPlaceholderContainer, situationalPlaceholderContainer]
      }
if (selector === '[data-placeholder]') return [placeholderSurface, heroPlaceholderSurface, situationalPlaceholderSurface]
      return selector.includes('grid-template-columns')
        ? [{ getBoundingClientRect: () => ({ height: sandbox.window.innerHeight }) }]
        : []
    },
  },
  getComputedStyle: () => ({ gridTemplateColumns: sandbox.__columns }),
  MutationObserver: class { observe() {} disconnect() {} },
  ResizeObserver: class { observe() {} disconnect() {} },
  __columns: '260px 1180px 0px',
  __locale: 'zh',
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
const BUNDLE_SOURCE = readFileSync(join(ROOT, 'dsh-mom-ui/lib/client.js'), 'utf8')
vm.runInContext(BUNDLE_SOURCE, sandbox)

check('bundle registers under its package name', bundle?.id, 'dsh-mom-ui')

// ── the guard that would have caught the turnBoundary bug ───────────────────
// `useProjection` silently yields `undefined` for any key the host does not
// publish to the browser, because the projection seam skips every unit whose
// definition carries no `wire` view. Reading a host-only key is therefore a
// silent, permanent zero — how the removed composer banner came to be pinned to
// turn 1 while every test still passed. This asserts each key the bundle READS is
// one the client can actually RECEIVE.
//
// Source of truth: the union of every `interface SessionProjectionMap`
// augmentation across the installed packages (the same set the seam builds).
const CLIENT_PROJECTION_KEYS = new Set([
  'agentPreset', 'contextBreakdown', 'contextPressure', 'goal', 'imageLimits',
  'inbox', 'modelSelection', 'permissions', 'plan', 'schedule',
  'sessionListMetadata', 'sessionStats', 'subagent', 'subagentCatalog',
  'subagentTiming', 'title', 'todos', 'tokenUsage', 'turnOutline',
])
const HOST_ONLY_KEYS = new Set(['turnBoundary'])

{
  const read = [...new Set([...BUNDLE_SOURCE.matchAll(/useProjection\(\s*'([^']+)'/g)].map((m) => m[1]))]
  checkTruthy(`bundle reads at least one projection (${read.join(', ')})`, read.length > 0)
  const unreachable = read.filter((key) => !CLIENT_PROJECTION_KEYS.has(key))
  check(`every projection the bundle reads is client-visible`, unreachable.join(','), '')
  const hostOnly = [...HOST_ONLY_KEYS].filter((key) => read.includes(key))
  check('bundle reads no host-only projection (e.g. turnBoundary)', hostOnly.join(','), '')
}

const ReactStub = {
  createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.length > 1 ? children : children[0] } }),
  // React treats a function initial value as a lazy initializer; the stub must
  // too, or a component asking for `useState(readGeometry)` receives the function.
  useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  useEffect: () => {},
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}
const REQUIRED_PRIMITIVES = new Set()
const primitivesCache = new Map()
const primitivesStub = new Proxy({}, {
  get: (_target, name) => {
    const key = String(name)
    REQUIRED_PRIMITIVES.add(key)
    // Cache per name: the Proxy must hand back a STABLE identity, or an element
    // type captured at render time never equals the one read in an assertion.
    if (!primitivesCache.has(key)) {
      primitivesCache.set(key, function PrimitiveStub() { return { type: key } })
    }
    return primitivesCache.get(key)
  },
})

const mod = bundle.factory((specifier) => {
  if (specifier === 'react') return ReactStub
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitivesStub
  throw new Error(`bundle requested a non-baseline module: ${specifier}`)
})

check('exports apply', typeof mod.apply, 'function')
check('injects slots/sessions/theme/locale', JSON.stringify(mod.inject), JSON.stringify(['slots', 'sessions', 'theme', 'locale']))

// ════════════════════════════════════════════════════════════════════════════
section('dsh-mom-ui · registration and palette gating')
// ════════════════════════════════════════════════════════════════════════════

const registrations = []
const effects = []
const locales = {}
const layers = []
let preset = 'mom'
let notify = new Set()

/**
 * A session-list snapshot shaped like the one the real service returns.
 *
 * That snapshot is `{ ids, byId, phase, projectionsBySession }` — there is NO
 * `current` field. An earlier version of this fixture invented one, so the
 * palette and every root-scoped surface read a value production never had: the
 * suite stayed green while the real UI kept the standard palette no matter which
 * session was open. What marks the session on screen is `retainedBy.mainView`,
 * which is also how the shipped `dsh-client-ui-agent-preset` finds it.
 * @param sessionPreset - the preset projection value for that session.
 * @param options - session id, and its main-view retention count.
 * @returns a list snapshot carrying production's exact top-level keys.
 */
const listSnapshot = (sessionPreset, { id = 'current-1', retained = 1 } = {}) => ({
  ids: [id],
  byId: { [id]: { id, retainedBy: { mainView: retained }, projectionValues: { agentPreset: sessionPreset } } },
  phase: 'ready',
  projectionsBySession: {},
})

const ctx = {
  effect: (fn, label) => { effects.push({ label, dispose: fn() }) },
  // `bind` is part of the locale service contract, and the bundle uses it to
  // translate the rewritten thinking label. The stub omitted it, so the first
  // plugin that needed a translator crashed here — the fixture, not the code.
  // It resolves through `sandbox.__locale` rather than hardcoding zh, because the
  // placeholder rewrite ships one rewrite path per locale: with zh pinned here, an
  // English-only bug (a lead clause that does not match the shipped string) would
  // pass the whole suite.
  locale: {
    register: (ns, dicts) => { locales[ns] = dicts; return () => {} },
    bind: (ns) => (key) => locales[ns]?.[sandbox.__locale]?.[key] ?? key,
  },
  theme: {
    overrideTokens: (source, tokens) => {
      const layer = { source, tokens, disposed: false }
      layers.push(layer)
      return () => { layer.disposed = true }
    },
  },
  sessions: {
    list: {
      getSnapshot: () => listSnapshot(preset),
      // A SET, not a single slot: the real snapshot store notifies every
      // subscriber, and the bundle has two (the palette and the thinking label).
      // Keeping one overwrote the other, which silently stopped the palette from
      // ever syncing — the fixture again, not the plugin.
      subscribe: (fn) => {
        notify.add(fn)
        return () => { notify.delete(fn) }
      },
    },
  },
  slots: {
    inject: (_slot, callback) => {
      // The real registry accepts either a disposer or an ITERABLE of disposers
      // ("iterables install transactionally and dispose in reverse order"), and
      // a generator callback only performs its registrations while being
      // iterated. The stub has to iterate, or a generator-shaped registration
      // silently disappears.
      const effect = callback()
      if (effect !== null && typeof effect === 'object' && typeof effect[Symbol.iterator] === 'function') {
        for (const disposer of effect) effects.push({ label: 'slot-disposer', dispose: disposer })
      } else {
        effects.push({ label: 'slot-disposer', dispose: effect })
      }
      return () => {}
    },
    register: (options, Component) => {
      registrations.push({ slot: options.name, options, Component })
      return () => {}
    },
  },
}

mod.apply(ctx)

check('installs the stylesheet effect', effects.some((e) => e.label === 'dsh-mom-ui: stylesheet'), true)
check('registers zh + en dictionaries', JSON.stringify(Object.keys(locales.momUi ?? {}).sort()), JSON.stringify(['en', 'zh']))
check('registers exactly one override layer on entry', layers.length, 1)
check('non-registered slots are left alone', registrations.map((r) => r.slot).sort().join(','),
  ['conversation.chat.assistant-actions', 'conversation.hero.brand.mark', 'conversation.session.header.utilities', 'settings.general.item', 'shell.overlay', 'sidebar.brand.mark', 'sidebar.brand.name'].sort().join(','))
// `id`/`order` exist only on list kind; single/keyed cells take `priority`.
check('list registrations carry an id', registrations.filter((r) => r.slot !== 'sidebar.brand.mark' && r.slot !== 'sidebar.brand.name').every((r) => typeof r.options.id === 'string'), true)
check('single-cell brand registrations carry no list-only options',
  registrations.filter((r) => r.slot.startsWith('sidebar.brand.')).every((r) => r.options.id === undefined && r.options.order === undefined), true)

// ── the thinking label ──────────────────────────────────────────────────────
// `[data-chat-running]` is the only lever: the string is owned by
// `@deepseek-ai/dsh-client-ui-chat`, the locale registry is single-occupancy per
// (namespace, locale) — `register` throws `locale namespace "chat" already has
// locale "zh"` — its Config exposes no label field, and no slot occupant renders
// it. Only the shipped PREFIX is replaced, so the duration survives.
check('the thinking label is rewritten for mom sessions', runningText.data, '❤ 妈妈在想，用时 3 秒 ···')
checkTruthy('and the timed variant keeps its duration', runningText.data.includes('用时 3 秒'))
// The marquee: painted from the attribute, so it needs its own rewrite.
check('the shimmer decoration copy is rewritten too',
  runningShimmer.attrs['data-shimmer-text'], '❤ 妈妈在想，用时 3 秒 ···')

runningText.data = '深度求索中'
runningShimmer.attrs['data-shimmer-text'] = '深度求索中'
preset = 'standard'
for (const fn of notify) fn()
check('and is left exactly as shipped outside mom mode', runningText.data, '深度求索中')
check('including the shimmer decoration copy', runningShimmer.attrs['data-shimmer-text'], '深度求索中')
// Leave the plugin in the STANDARD state the palette checks below expect, and
// restore the fixture: re-entering mom here would stack a layer out of turn.
runningText.data = '深度求索中，用时 3 秒 ···'

check('leaving mom mode disposes the palette layer', layers[0]?.disposed, true)
check('and does not register a second layer', layers.length, 1)

preset = 'mom'
for (const fn of notify) fn()
check('re-entering mom mode stacks a fresh layer', layers.length, 2)
check('and the fresh layer is live', layers[1]?.disposed, false)

// ── the composer placeholder ────────────────────────────────────────────────
// `placeholder.default` and `placeholder.hero` belong to
// `@deepseek-ai/dsh-client-ui-conversation` and have no supported override:
// `InputBar` resolves them from that plugin's namespace, the composer bar is a
// `single` seat no occupant can shadow, and its Config exposes no copy field. The
// lead clause is swapped and the host's own ", / …, @ …" tail is read back off the
// shipped string, so the affordance hints stay the host's.
const MOM_DEFAULT = '想要妈妈做什么, / 调用指令, @ 文件或对话'
check('the default composer placeholder leads with mom’s wording', placeholderText.data, MOM_DEFAULT)
check('and the host’s "/ command, @ file" tail is kept verbatim', placeholderText.data.slice('想要妈妈做什么'.length), ', / 调用指令, @ 文件或对话')
check('the editor surface’s data-placeholder is rewritten too',
  placeholderSurface.attrs['data-placeholder'], MOM_DEFAULT)
// A contenteditable has no placeholder attribute, so the string is its accessible
// name — leaving this stale would announce the shipped words to a screen reader.
check('and its accessible name follows', placeholderSurface.attrs['aria-label'], MOM_DEFAULT)
// A new session shows the HERO placeholder, a different shipped string. Both leads
// collapse to mom's wording, and both keep the host's own tail.
check('the new-session (hero) placeholder is rewritten too', heroPlaceholderText.data, MOM_DEFAULT)
check('and its editor surface', heroPlaceholderSurface.attrs['data-placeholder'], MOM_DEFAULT)
// Exact match against the shipped string is what spares every situational
// placeholder — here a bare string with no tail at all.
check('a situational placeholder is left exactly as shipped', situationalPlaceholderText.data, '会话不可用')
check('including its data-placeholder', situationalPlaceholderSurface.attrs['data-placeholder'], '会话不可用')

// ── leaving mom restores what the host shipped ──────────────────────────────
// Switch away with the carriers STILL holding mom's wording — the state the field
// bug was reported from. Restoring the fixtures by hand before flipping the preset
// would make every assertion below vacuous: that hand-restore is precisely what does
// not happen in the browser, where React reconciles the host's shipped string
// against its own previous render, sees no change, and writes nothing at all.
preset = 'standard'
for (const fn of notify) fn()
check('leaving mom restores the composer placeholder', placeholderText.data, '发消息或创建任务, / 调用指令, @ 文件或对话')
check('including the editor surface’s data-placeholder', placeholderSurface.attrs['data-placeholder'], '发消息或创建任务, / 调用指令, @ 文件或对话')
check('and its accessible name', placeholderSurface.attrs['aria-label'], '发消息或创建任务, / 调用指令, @ 文件或对话')
check('and the new-session one too', heroPlaceholderText.data, '描述你想要构建的内容, / 调用指令, @ 文件或对话')
check('including its editor surface', heroPlaceholderSurface.attrs['data-placeholder'], '描述你想要构建的内容, / 调用指令, @ 文件或对话')
check('while a situational placeholder is never rewritten, so never restored either',
  situationalPlaceholderText.data, '会话不可用')

// Re-entering mom must work off the RESTORED string, not a leftover: this is the
// round trip a session switch actually performs.
preset = 'mom'
for (const fn of notify) fn()
check('re-entering mom rewrites it again', placeholderText.data, MOM_DEFAULT)
check('and the new-session one', heroPlaceholderText.data, MOM_DEFAULT)

// The host re-rendering a DIFFERENT shipped string while mom is on (default → hero
// as a session starts) must replace the remembered original rather than leave the
// first one behind, or the restore would put the wrong variant's words back.
placeholderText.data = '描述你想要构建的内容, / 调用指令, @ 文件或对话'
for (const fn of notify) fn()
check('a re-render under a different shipped string is rewritten too', placeholderText.data, MOM_DEFAULT)
preset = 'standard'
for (const fn of notify) fn()
check('and the restore follows the host’s latest string, not the stale one',
  placeholderText.data, '描述你想要构建的内容, / 调用指令, @ 文件或对话')
preset = 'mom'
placeholderText.data = '发消息或创建任务, / 调用指令, @ 文件或对话'
for (const fn of notify) fn()

// The same rewrite, in the other locale: its shipped string carries a different
// lead AND a different tail, so both halves of the table have to be right.
sandbox.__locale = 'en'
placeholderText.data = 'Message or run a task, / commands, @ files or sessions'
placeholderSurface.attrs['data-placeholder'] = 'Message or run a task, / commands, @ files or sessions'
placeholderSurface.attrs['aria-label'] = 'Message or run a task, / commands, @ files or sessions'
for (const fn of notify) fn()
check('the English default placeholder is rewritten too', placeholderText.data, 'Tell mom what to do, / commands, @ files or sessions')
check('and its accessible name', placeholderSurface.attrs['aria-label'], 'Tell mom what to do, / commands, @ files or sessions')
// An English draft left alone while the UI is English: the lead is swapped per
// locale, never pasted from the Chinese string.
placeholderText.data = 'Tell mom what to do, / commands, @ files or sessions'
sandbox.__locale = 'zh'
for (const fn of notify) fn()
check("mom's rewritten English placeholder is not re-matched by the Chinese lead", placeholderText.data, 'Tell mom what to do, / commands, @ files or sessions')
placeholderText.data = '发消息或创建任务, / 调用指令, @ 文件或对话'
placeholderSurface.attrs['data-placeholder'] = '发消息或创建任务, / 调用指令, @ 文件或对话'
placeholderSurface.attrs['aria-label'] = '发消息或创建任务, / 调用指令, @ 文件或对话'
for (const fn of notify) fn()

// The two assertions that pin the fixture to production. The palette checks
// above run through `listSnapshot`, so if this helper ever regains the invented
// `current` field, the coupling is gone again and these fail loudly.
check("the fixture carries production's list-snapshot keys", Object.keys(listSnapshot('mom')).sort().join(','),
  'byId,ids,phase,projectionsBySession')
check('and leaves no `current` field to read', Object.hasOwn(listSnapshot('mom'), 'current'), false)

// ════════════════════════════════════════════════════════════════════════════
section('dsh-mom-ui · surfaces gate on the current preset')
// ════════════════════════════════════════════════════════════════════════════

const componentFor = (slot) => registrations.find((r) => r.slot === slot)?.Component
const t = (key) => `[${key}]`

/** Props for a session-scoped surface, with the session's preset as given. */
const sessionProps = (sessionPreset) => ({
  t,
  sessionId: 'session-x',
  useProjection: (key, selector) => {
    const value = key === 'agentPreset' ? sessionPreset : undefined
    return selector === undefined ? value : selector(value)
  },
})

/** Props for a root-scoped surface, with the current session's preset as given. */
const rootProps = (currentPreset, size = 24) => ({
  t,
  size,
  useSessions: (selector) => selector(listSnapshot(currentPreset)),
})

const SESSION_SURFACES = [
  'conversation.session.header.utilities',
  'conversation.chat.assistant-actions',
]

for (const slot of SESSION_SURFACES) {
  const Component = componentFor(slot)
  checkTruthy(`${slot} renders in a mom session`, Component(sessionProps('mom')) !== null)
  check(`${slot} renders nothing in a standard session`, Component(sessionProps('standard')), null)
}

checkTruthy('settings row renders in a mom session', componentFor('settings.general.item')(rootProps('mom')) !== null)
check('settings row renders nothing in a standard session', componentFor('settings.general.item')(rootProps('standard')), null)
check('brand mark falls back to the shipped logo off-mom', componentFor('sidebar.brand.mark')(rootProps('standard')).type, primitivesStub.FishLogo)
check('brand mark switches to the mom mark in mom mode', componentFor('sidebar.brand.mark')(rootProps('mom')).type, 'svg')
check('brand name falls back off-mom', componentFor('sidebar.brand.name')(rootProps('standard')).type, primitivesStub.BrandWordmark)
check('brand name switches in mom mode', componentFor('sidebar.brand.name')(rootProps('mom')).type, 'span')
checkTruthy('the hero heart renders in a mom session', componentFor('conversation.hero.brand.mark')(rootProps('mom')) !== null)
check('and renders nothing in a standard session', componentFor('conversation.hero.brand.mark')(rootProps('standard')), null)

{
  // The gate follows the session the MAIN VIEW holds, not merely the first mom
  // session in the map: a standard session on screen must stay standard even
  // while a mom session sits retained in the sidebar, and vice versa.
  const twoSessions = (onScreenPreset) => ({
    ids: ['offscreen', 'onscreen'],
    byId: {
      offscreen: { id: 'offscreen', retainedBy: { mainView: 0, sidebarView: 1 }, projectionValues: { agentPreset: 'mom' } },
      onscreen: { id: 'onscreen', retainedBy: { mainView: 1 }, projectionValues: { agentPreset: onScreenPreset } },
    },
    phase: 'ready',
    projectionsBySession: {},
  })
  const BrandName = componentFor('sidebar.brand.name')
  const renderName = (snapshot) => BrandName({ t, size: 24, useSessions: (selector) => selector(snapshot) })
  check('a standard session on screen stays standard though a mom one is retained',
    renderName(twoSessions('standard')).type, primitivesStub.BrandWordmark)
  check('and the on-screen mom session themes the shell',
    renderName(twoSessions('mom')).type, 'span')
}

check('the floating-hearts overlay is opt-in and off by default',
  registrations.some((r) => r.options.id === 'mom-overlay'), false)
checkTruthy('the background figure occupies shell.overlay instead',
  registrations.some((r) => r.options.id === 'mom-backdrop'))

// Regression guard for a real crash found while building this: `single` cells
// throw when a second entry lands on the SAME priority, and brand-official
// registers both brand slots at the default 0.
check('brand shadowing registers below the shipped default priority',
  registrations.filter((r) => r.slot.startsWith('sidebar.brand.')).every((r) => r.options.priority === -1), true)

// ── single install route ────────────────────────────────────────────────────
// Two active Loader entries resolving to the SAME package name are a fatal
// composition error in `dsh-client-modules` (`reconcilePackage` throws, the
// fiber fails, `window.__DSH_BOOT__` is never injected, and the whole web client
// goes dark). A browser-side guard cannot help — the host dies first — so the
// package must not offer a second route at all.
{
  const pkg = JSON.parse(readFileSync(join(ROOT, 'dsh-mom-ui/package.json'), 'utf8'))
  check('client package declares no dsh.bundle (single route)', pkg.dsh?.bundle, undefined)
  check('client package declares its browser half', pkg.dsh?.client?.platform, 'web')
  checkTruthy('and exports the ./client bundle it names', pkg.exports['./client'] !== undefined)
  checkTruthy('no bundle patch file ships', !existsSync(join(ROOT, 'dsh-mom-ui/cordis.patch.yml')))
}

// ════════════════════════════════════════════════════════════════════════════
section('dsh-mom-ui · background figure')
// ════════════════════════════════════════════════════════════════════════════

{
  const backdrop = registrations.find((r) => r.options.id === 'mom-backdrop')?.Component
  checkTruthy('the backdrop is registered into shell.overlay', backdrop !== undefined)
  checkTruthy('its registration carries no locale (it renders no copy)',
    registrations.find((r) => r.options.id === 'mom-backdrop')?.options.locale === undefined)

  // A data URI is the only way the art can reach the page: the module route serves
  // `lib/client.js` and nothing else.
  checkTruthy('the art is embedded as a webp data URI', /const MOM_ART = 'data:image\/webp;base64,[A-Za-z0-9+/=]{200,}'/.test(BUNDLE_SOURCE))
  const artMeta = JSON.parse(readFileSync(join(ROOT, 'assets/mom-art.json'), 'utf8'))
  check('the embedded width matches the prepared asset', Number(BUNDLE_SOURCE.match(/MOM_ART_WIDTH = (\d+)/)[1]), artMeta.width)
  check('the embedded height matches the prepared asset', Number(BUNDLE_SOURCE.match(/MOM_ART_HEIGHT = (\d+)/)[1]), artMeta.height)
  checkTruthy('the asset itself is present', existsSync(join(ROOT, 'assets/mom-art.webp')))

  // The pipeline keys a flat field out only when the SOURCE lacks alpha, and never
  // re-keys a source that already has it. Read the PNG IHDR colour type directly
  // (offset 25: 2 = RGB, 4 = grey+alpha, 6 = RGBA) rather than pulling in an image
  // library, and require the prepared asset to be an alpha-capable container so a
  // regression to a flattened rectangle is caught here rather than on screen.
  {
    const png = readFileSync(join(ROOT, 'ds_mom.png'))
    checkTruthy('the source is a PNG', png.subarray(1, 4).toString('latin1') === 'PNG')
    const colorType = png[25]
    checkTruthy(
      `the source is a shape prepare-art accepts (colour type ${String(colorType)}: 2 RGB, or 4/6 with alpha)`,
      colorType === 2 || colorType === 4 || colorType === 6,
    )

    const webp = readFileSync(join(ROOT, 'assets/mom-art.webp'))
    const chunk = webp.subarray(12, 16).toString('latin1')
    checkTruthy(`the prepared art is a WebP (${chunk})`, webp.subarray(0, 4).toString('latin1') === 'RIFF' && webp.subarray(8, 12).toString('latin1') === 'WEBP')
    if (chunk === 'VP8X') {
      // Extended format: bit 0x10 is "has alpha", and it is the only lossy
      // WebP encoding that can carry one.
      checkTruthy('the extended WebP declares an alpha channel', (webp[20] & 0x10) !== 0)
    } else {
      check('the WebP is lossless, which always carries alpha', chunk, 'VP8L')
    }
  }

  // Regression guard with teeth: the frame must be the trimmed subject. The art is
  // shown at a fixed height and its aspect feeds the component's size solve, so a
  // frame that still holds most of the canvas (the source is 1536×864, aspect 1.78)
  // or one inflated by a keyed edge trail would draw her at the wrong size.
  {
    const aspect = artMeta.width / artMeta.height
    checkTruthy(`the trimmed frame is the subject, not the canvas (aspect ${aspect.toFixed(3)})`, aspect > 0.3 && aspect < 0.6)
  }

  /** Render the backdrop with a given frame geometry. */
  const renderBackdrop = (preset, columns, viewportHeight = 1000) => {
    sandbox.__columns = columns
    sandbox.window.innerHeight = viewportHeight
    return backdrop(rootProps(preset))
  }

  // Every assertion below dereferences a render result. Reading through these
  // two keeps a regression that makes the backdrop stop rendering from aborting
  // the whole run on the first `null.props` — the suite should report the broken
  // gate, not die on it and hide the other twenty checks.
  const styleOf = (node) => node?.props?.style ?? {}
  const pxAfterTransparent = (mask) => {
    const match = /transparent (\d+)px/.exec(String(mask))
    return match === null ? undefined : Number.parseFloat(match[1])
  }

  // Wide screen: sidebar 260, centre 2000 → gutter (2000-860)/2 = 570, capped at
  // ART_MAX_WIDTH 420 + bleed, so she is height-capped by the viewport.
  const wide = renderBackdrop('mom', '260px 2000px 0px')
  checkTruthy('renders on a wide screen in a mom session', wide !== null)
  check('sits flush against the sidebar', styleOf(wide).left, '260px')
  checkTruthy('uses the art as a background image', String(styleOf(wide).backgroundImage).startsWith('url("data:image/webp'))
  check('carries the tuned transparency', styleOf(wide).opacity, '0.5')
  {
    // Two regimes, and they behave differently on purpose.
    //
    // (a) GUTTER-BOUND: her width is the gutter plus the bleed, so she does reach
    //     the card and the fade is what protects the text. Frame: centre 1260 →
    //     gutter (1260-860)/2 = 200; a tall viewport keeps the height cap out of
    //     the way, so she is 200+24 = 224 wide, solid to 200-90 = 110.
    const gutterBound = renderBackdrop('mom', '260px 1260px 0px', 2000)
    const mask = String(styleOf(gutterBound).maskImage)
    checkTruthy('fade uses absolute stops, not percentages', /#000 \d+px, transparent \d+px/.test(mask))
    checkTruthy('softening begins 90px before the card edge', mask.includes('#000 110px'))
    checkTruthy('and she is fully gone at the bleed limit', mask.includes('transparent 224px'))
    check('the bleed really is the overlap', Number.parseFloat(styleOf(gutterBound).width), 224)

    // (b) HEIGHT-BOUND: the viewport cap makes her narrower than the gutter, so
    //     she never reaches the card and there is nothing to fade.
    const heightBound = renderBackdrop('mom', '260px 2000px 0px', 1000)
    const hbEnd = pxAfterTransparent(styleOf(heightBound).maskImage)
    check('a height-bound figure ends inside the gutter', hbEnd, Number.parseFloat(styleOf(heightBound).width))
  }
  {
    const width = Number.parseFloat(styleOf(wide).width)
    const height = Number.parseFloat(styleOf(wide).height)
    const aspect = artMeta.width / artMeta.height
    checkTruthy(`aspect ratio preserved (${width.toFixed(0)}×${height.toFixed(0)})`, Math.abs(width / height - aspect) < 0.01)
    checkTruthy('never taller than the viewport cap', height <= 1000 * 0.78 + 1)
  }

  // The sidebar collapses: she must follow it, not stay put.
  const collapsed = renderBackdrop('mom', '56px 2000px 0px')
  check('follows a collapsed sidebar', styleOf(collapsed).left, '56px')

  // Threshold: `gutter + ART_BLEED >= ART_MIN_WIDTH` → centre >= 1112, since
  // gutter (1000-860)/2 = 70 gives 94px wide.
  check('renders nothing when the gutter cannot fit her', renderBackdrop('mom', '260px 1000px 0px'), null)
  check('one pixel under the threshold is still hidden', renderBackdrop('mom', '260px 1111px 0px'), null)
  checkTruthy('and the threshold itself renders', renderBackdrop('mom', '260px 1112px 0px') !== null)
  checkTruthy('a roomy gutter renders too', renderBackdrop('mom', '260px 1300px 0px') !== null)

  // A tight gutter must not keep her fully opaque right up to the card. With
  // gutter 126 the fade starts at 126-90 = 36, so she is soft across most of it.
  {
    const tight = renderBackdrop('mom', '260px 1112px 0px')
    checkTruthy('a tight gutter softens her early', String(styleOf(tight).maskImage).includes('#000 36px'))
    checkTruthy('and the fade never runs past the image box',
      pxAfterTransparent(styleOf(tight).maskImage) <= Number.parseFloat(styleOf(tight).width))
  }

  check('renders nothing in a standard session', renderBackdrop('standard', '260px 2000px 0px'), null)
  check('renders nothing when the frame cannot be read', renderBackdrop('mom', 'none'), null)
}

// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${String(checks - failures)}/${String(checks)} checks passed`)
process.exitCode = failures === 0 ? 0 : 1
