/**
 * Browser half of `dsh-mom-ui` — 妈妈模式 的 Web UI 定制。
 *
 * Hand-written bundle, no build step. `dsh-client-modules` serves this file
 * verbatim and the shell resolves `require` against its frozen baseline table,
 * so the only specifiers used here (`react`, `@deepseek-ai/dsh-client-ui-primitives`)
 * are ones the shell already seeds. Nothing inspects build provenance.
 *
 * Every surface is gated on the CURRENT SESSION's `agentPreset` projection, so
 * installing this plugin globally does not make the UI mom-themed globally: a
 * session on `standard` renders the shipped chrome untouched. The client plane
 * has no per-preset composition, so self-gating is how opt-in is preserved.
 *
 * Two ways to read the gate, because the props available differ:
 *   - `useProjection('agentPreset')` is session-only (SessionStandardProps), and is
 *     what the session-scoped surfaces use.
 *   - `useSessions(...)`, from GlobalStandardProps, reaches EVERY occupant including
 *     root, so the root-scoped surfaces read the current session through it.
 * Global hooks reach both kinds of slot; only `useProjection` is scope-restricted.
 * The palette is global CSS, so it is driven from `ctx.sessions.list` at
 * registration time rather than from any component.
 *
 * This package is deliberately NOT a bundle: `package.json` declares no
 * `dsh.bundle`, so `dsh plugin add` installs it as an inert plain dependency
 * rather than a second active Loader entry. Two active entries resolving to the
 * same package name are a composition error in `dsh-client-modules`
 * (`reconcilePackage` throws, the fiber fails, and `window.__DSH_BOOT__` is never
 * injected — the whole web client goes dark), so the single route install.sh
 * writes is the only way to reach this file on purpose.
 */
window.__ModuleLoader__.load({
  id: 'dsh-mom-ui',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const P = require('@deepseek-ai/dsh-client-ui-primitives')

    const h = React.createElement

    const PLUGIN_ID = 'dsh-mom-ui'
    const PRESET_ID = 'mom'
    const NS = 'momUi'

    // ── tuning knobs ────────────────────────────────────────────────────────
    // Client plugins receive no config (the boot graph carries plugin code, not
    // plugin options), so the switches that would otherwise be config live here.
    const SURFACES = {
      headerBadge: true,
      heroMark: true,
      hugAction: true,
      sidebarBrand: true,
      settingsRow: true,
      background: true,
      ambientOverlay: false,
    }

    // ── the art, fetched as a file ──────────────────────────────────────────
    // Served by this package's host half (`lib/index.js`) from `ds_mom.png`, the
    // single source of the art. Nothing here is generated and nothing here needs
    // editing when the image changes: the URL is a plain path with no
    // cache-busting query, and the host answers with `no-store`, so replacing
    // `ds_mom.png` is visible on the next reload.
    //
    // These two numbers are the SOURCE canvas, not a crop. The backdrop box is
    // sized to the image's own aspect ratio (`contain` fills it exactly), so a
    // source with the same canvas aspect renders correctly untouched — which is
    // the whole reason the crop could be dropped. A source of a different shape
    // needs these two numbers updated here; nothing else in the file assumes the
    // figure's position inside the canvas.
    const MOM_ART_PATH = '/mom/art.png'
    const MOM_ART_WIDTH = 1024
    const MOM_ART_HEIGHT = 1536

    // ── copy ────────────────────────────────────────────────────────────────
    const ZH = {
      badge: '妈妈模式',
      badgeTip: '这个会话运行在妈妈模式下：先接住人，再处理事。',
      hug: '抱抱',
      hugTip: '抱一下，然后继续。',
      brandName: '妈妈模式',
      settingsTitle: '妈妈模式装饰',
      settingsHint: '只影响你这台浏览器上的显示：暖色配色、心心与「抱抱」按钮。',
      runningLabel: '❤ 妈妈在想',
      placeholderLead: '想要妈妈做什么',
    }
    const EN = {
      badge: 'Mom mode',
      badgeTip: 'This session runs in mom mode: it takes the person first, then the problem.',
      hug: 'Hug',
      hugTip: 'A hug, then carry on.',
      brandName: 'Mom mode',
      settingsTitle: 'Mom mode decoration',
      settingsHint: 'Display-only, on this browser: the warm palette, the hearts, and the Hug button.',
      runningLabel: '❤ Mom is thinking',
      placeholderLead: 'Tell mom what to do',
    }

    // ── plugin-owned stylesheet ─────────────────────────────────────────────
    const CSS = `
.dsh-mom-badge{display:inline-flex;align-items:center;gap:6px;}
.dsh-mom-badge__anchor{display:inline-flex;align-items:center;}
.dsh-mom-badge__heart{line-height:1;font-size:calc(var(--dsh-content-font-size-secondary,13px) + 1px);}
.dsh-mom-heromark{display:inline-flex;align-items:center;justify-content:center;line-height:1;}
.dsh-mom-hug-anchor{display:inline-flex;align-items:center;}
.dsh-mom-hug{
  display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-secondary);
}
.dsh-mom-hug:hover{color:var(--dsw-alias-brand-primary);}
.dsh-mom-hug--done{color:var(--dsw-alias-brand-primary);}
.dsh-mom-brandname{
  font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-primary);
}
.dsh-mom-settings{
  display:flex;align-items:flex-start;gap:10px;
  color:var(--dsw-alias-label-primary);
}
.dsh-mom-settings__hint{
  margin-top:2px;color:var(--dsw-alias-label-tertiary);
  font-size:var(--dsh-content-font-size-secondary,13px);line-height:1.5;
}
.dsh-mom-overlay{
  position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:1;
}
/* Doubled class on purpose: the frame's overlay layer sets
   pointer-events:auto on EVERY direct child, at the same specificity as a single
   class, so one class could lose depending on stylesheet order. Two classes win
   outright, and the character must never intercept a click meant for the app.

   background-size:contain with background-position:left bottom is what makes the
   served SOURCE image usable without cropping it first: the component sizes this
   box from the image's own aspect ratio, so the image fills it exactly, and the
   LEFT edge is the one that must line up with the sidebar. The transparent margin
   the canvas carries around the figure is therefore part of what is drawn — she
   is positioned inside the canvas by the artist, not by this code. */
.dsh-mom-backdrop.dsh-mom-backdrop{
  position:fixed;bottom:0;pointer-events:none;z-index:0;
  background-repeat:no-repeat;background-position:left bottom;background-size:contain;
}
.dsh-mom-heart{
  position:absolute;top:-24px;opacity:0;
  animation:dsh-mom-fall linear infinite;
}
@keyframes dsh-mom-fall{
  0%{opacity:0;transform:translateY(0) rotate(0deg);}
  10%{opacity:.5;}
  90%{opacity:.35;}
  100%{opacity:0;transform:translateY(105vh) rotate(220deg);}
}
@media (prefers-reduced-motion: reduce){
  .dsh-mom-heart{animation:none;display:none;}
}
`

    // ── warm palette ────────────────────────────────────────────────────────
    // Overlay layer only: the base theme stays registered and untouched, so
    // leaving mom mode restores whatever the user had chosen. Every token needs
    // both modes — the presenter picks one, and a missing dark value would go
    // illegible on a scheme switch.
    const MOM_TOKENS = {
      '--dsw-alias-bg-base': { light: '#fff8f4', dark: '#241c1a' },
      '--dsw-alias-bg-layer-1': { light: '#fffdfb', dark: '#2b2220' },
      '--dsw-alias-bg-layer-2': { light: '#ffffff', dark: '#322826' },
      '--dsw-alias-bg-layer-3': { light: '#fdf1ec', dark: '#3a2e2b' },
      '--dsw-alias-bg-module-platform': { light: '#fdf1ec', dark: '#3a2e2b' },
      '--dsw-alias-brand-primary': { light: '#e8788f', dark: '#f0a0b4' },
      '--dsw-alias-brand-text': { light: '#c9556f', dark: '#f5b8c6' },
      '--dsw-alias-label-primary': { light: '#4a3730', dark: '#f5e6df' },
      '--dsw-alias-label-secondary': { light: '#7d665c', dark: '#c9b1a6' },
      '--dsw-alias-label-tertiary': { light: '#a89287', dark: '#9c8378' },
      '--dsw-alias-label-caption': { light: '#a89287', dark: '#9c8378' },
      '--dsw-alias-label-dimmed': { light: '#bda79c', dark: '#8a7268' },
      '--dsw-alias-border-l1': { light: '#f2e2da', dark: '#3d302c' },
      '--dsw-alias-border-l2': { light: '#e8d4ca', dark: '#4a3a35' },
      '--dsw-alias-border-l3': { light: '#dcc4b8', dark: '#574540' },
      '--dsw-alias-button-primary-fill': { light: '#e8788f', dark: '#e8829a' },
      '--dsw-alias-button-primary-hover': { light: '#d9647e', dark: '#f0a0b4' },
      '--dsw-alias-button-primary-dimmed': { light: '#f4c2cd', dark: '#7a4a56' },
      '--dsw-alias-interactive-bg-hover': { light: '#fdeef0', dark: '#3d2a2e' },
      '--dsw-alias-interactive-bg-active': { light: '#fbe0e5', dark: '#4a3236' },
      '--dsw-alias-interactive-bg-hover-accent': { light: '#fdeef0', dark: '#3d2a2e' },
      '--dsw-alias-markdown-inline-code': { light: '#fdeef0', dark: '#3d2a2e' },
      '--dsw-alias-markdown-code-block': { light: '#fdf6f2', dark: '#2b2220' },
      '--dsw-alias-scrollbar-bg-l1': { light: '#f6e7e0', dark: '#3a2e2b' },
      '--dsw-alias-scrollbar-hover-l1': { light: '#e8d4ca', dark: '#574540' },
    }

    // ── decoration preference (browser-local) ───────────────────────────────
    // Deliberately NOT a host settings namespace: this is a display preference
    // for one browser, and writing the durable host document from a UI plugin
    // would be a heavier commitment than the feature needs.
    const DECOR_KEY = 'dsh-mom-ui:decor'
    let decorEnabled = true
    try {
      const stored = globalThis.localStorage?.getItem(DECOR_KEY)
      if (stored === '0') decorEnabled = false
    } catch {
      /* private mode / storage disabled: keep the default */
    }
    const decorListeners = new Set()

    function setDecor(next) {
      decorEnabled = next
      try {
        globalThis.localStorage?.setItem(DECOR_KEY, next ? '1' : '0')
      } catch {
        /* the in-memory value still applies for this page */
      }
      for (const listener of decorListeners) listener()
    }

    function subscribeDecor(listener) {
      decorListeners.add(listener)
      return () => decorListeners.delete(listener)
    }

    function useDecor() {
      return React.useSyncExternalStore(
        subscribeDecor,
        () => decorEnabled,
        () => true,
      )
    }

    // ── the gate ────────────────────────────────────────────────────────────
    /** Session-scoped slots: the projection is already bound to this session. */
    function useSessionIsMom(props) {
      return props.useProjection('agentPreset') === PRESET_ID
    }

    /**
     * Visit every text node under one element.
     *
     * A hand-rolled walk rather than `TreeWalker`: the bundle is executed in a
     * minimal sandbox by `test/smoke.mjs`, where only `childNodes`, `nodeType` and
     * `data` are guaranteed. A missing container yields nothing, which is what an
     * untouched page needs anyway.
     * @param node - element to descend.
     * @yields each text node, depth first.
     */
    function* textNodesOf(node) {
      for (const child of node?.childNodes ?? []) {
        if (child.nodeType === 3) yield child
        else yield* textNodesOf(child)
      }
    }

    /** Root-scoped slots: follow whatever session is current. */
    function useRootIsMom(props) {
      const preset = props.useSessions((state) => {
        const value = onScreenSession(state)?.projectionValues?.agentPreset
        return typeof value === 'string' ? value : undefined
      })
      return preset === PRESET_ID
    }

    /**
     * The session the main view is showing, out of a session-list snapshot.
     *
     * Read from `retainedBy.mainView`, which is how the shipped
     * `dsh-client-ui-agent-preset` finds the same session (its
     * `captureBlankSessionSync`). The list snapshot is
     * `{ ids, byId, phase, projectionsBySession }` and carries NO `current`
     * field, so reading `state.current` answered `undefined` forever — and every
     * root-scoped surface here, plus the whole warm palette, was gated on it.
     * The projection itself was always correct; only the lookup was wrong.
     *
     * Retention is not yet recorded on the first paint of a fresh profile, where
     * exactly one session exists and is by definition the one on screen.
     * @param state - a session-list snapshot, or undefined before one exists.
     * @returns the on-screen session entry, or undefined when none is known.
     */
    function onScreenSession(state) {
      const byId = state?.byId
      if (byId === undefined || byId === null) return undefined
      const entries = Object.values(byId)
      let best
      for (const entry of entries) {
        const retained = entry?.retainedBy?.mainView ?? 0
        if (retained > 0 && (best === undefined || retained > (best.retainedBy?.mainView ?? 0))) {
          best = entry
        }
      }
      return best ?? (entries.length === 1 ? entries[0] : undefined)
    }

    // ── frame geometry ──────────────────────────────────────────────────────
    // The character is placed flush against the sidebar, so her own width has to
    // come from the sidebar's real width and the free gutter beside the centred
    // conversation card. `PanelInfo` carries no geometry and the frame's classes
    // are CSS-module hashes, but AppFrame writes `grid-template-columns` INLINE on
    // the element that owns the sidebar | centre | rightbar tracks, so the computed
    // value is the authoritative read — no private API and no hash to go stale.
    const CARD_MAX_WIDTH = 860 // --dsh-composer-card-max-width
    // The width at which she is drawn at full strength. Below it she does NOT
    // disappear — that used to be a hard cutoff, and it made the desktop app's
    // DEFAULT window (1280px, `apps/desktop/src/main.ts`) show nothing at all: the
    // card leaves an 80px gutter there, under the floor. She now shrinks with the
    // gutter and fades with it, so resizing a window slides her in and out
    // continuously instead of popping. This is also the divisor for that fade, so
    // it stays the one number that says "how wide is she worth drawing".
    const ART_MIN_WIDTH = 150
    // Her design size, and with it the maximum height: at this width the art is
    // 616px tall, which is a third less than the 924px this used to allow. Height
    // is what the ceiling really is — `bottom: 0` means the top is the only edge
    // that can hit the parent — so lowering the width is how the height comes down.
    // 280 is also close to twice ART_MIN_WIDTH, so the "dimmed by overlap" ratio
    // below can still reach full strength within a plausible gutter.
    const ART_MAX_WIDTH = 280
    // How far she may reach past the gutter, under the conversation card.
    // Deliberately small: this is the only part that can sit over content.
    const ART_BLEED = 24
    // The mask starts softening this many px BEFORE the card edge, so the overlap
    // is already mostly dissolved by the time it reaches text. It also makes her
    // adapt without a second rule: a roomy gutter keeps her solid across its whole
    // width, while a tight one turns her into a whisper exactly where space is
    // scarce.
    const ART_FADE_LEAD = 90
    // She is a background, not a foreground prop. `--dsh-composer-card-max-width`
    // is the COMPOSER's width, and the message column is not guaranteed to be the
    // same, so the gutter estimate can be optimistic — transparency is what keeps
    // an over-estimate from hurting readability.
    const ART_OPACITY = 0.5
    // She is anchored to the BOTTOM, so height is the only dimension that can run
    // her past the top of her parent. This is therefore her true ceiling, and it is
    // deliberately 100: she is allowed to reach the top edge exactly, and to stay
    // at full size for every viewport taller than that.
    //
    // It used to be 78, which meant she shrank in proportion to the viewport on the
    // way down — she got smaller on tall screens that had room to spare, which is the
    // "无脑的缩小" this replaced: a viewport-proportional cap cannot tell "the window
    // got shorter" from "she no longer fits", so it responds to both.
    //
    // The width→height relation below is what actually decides her size, and the
    // viewport only enters as a clamp. She keeps ART_MAX_WIDTH until the height
    // that implies would exceed the parent; only then does she start shrinking.
    const ART_MAX_HEIGHT_VH = 100

    /** The frame element: the inline grid whose box is essentially the viewport. */
    function findFrame() {
      if (typeof document === 'undefined') return null
      for (const element of document.querySelectorAll('[style*="grid-template-columns"]')) {
        if (element.getBoundingClientRect().height >= window.innerHeight * 0.8) return element
      }
      return null
    }

    /** @returns the sidebar and centre column widths in px, or 0s when unreadable. */
    function readColumns() {
      const frame = findFrame()
      if (frame === null) return { sidebar: 0, center: 0, viewportHeight: window.innerHeight }
      const tracks = getComputedStyle(frame).gridTemplateColumns.split(' ').map(Number.parseFloat)
      return {
        sidebar: Number.isFinite(tracks[0]) ? tracks[0] : 0,
        center: Number.isFinite(tracks[1]) ? tracks[1] : 0,
        viewportHeight: window.innerHeight,
      }
    }

    /**
     * Track the frame's column widths. The inline style is rewritten when the
     * sidebar collapses or is dragged, hence the attribute observer; the window
     * listener covers everything that changes the computed values without a style
     * write (viewport resize, scrollbar appearing, zoom).
     */
    function useColumns() {
      const [columns, setColumns] = React.useState(readColumns)
      React.useEffect(() => {
        const frame = findFrame()
        const update = () => setColumns(readColumns())
        update()
        const observer = frame === null ? null : new MutationObserver(update)
        observer?.observe(frame, { attributes: true, attributeFilter: ['style'] })
        const resize = new ResizeObserver(update)
        if (frame !== null) resize.observe(frame)
        window.addEventListener('resize', update)
        return () => {
          observer?.disconnect()
          resize.disconnect()
          window.removeEventListener('resize', update)
        }
      }, [])
      return columns
    }

    // ── surfaces ────────────────────────────────────────────────────────────

    /**
     * The heart shown before a blank session's headline.
     *
     * `conversation.hero.brand.mark` is a `single`/root seat with NO shipped
     * occupant and `replaceRisk: none`, so this is purely additive: it cannot
     * shadow anything, and a non-mom session renders the seat exactly as before.
     * Root scope means the gate is `useRootIsMom`, not the projection.
     * @param props - owner geometry plus the standard root hooks.
     * @returns the mark, or null outside mom mode.
     */
    function MomHeroMark(props) {
      const isMom = useRootIsMom(props)
      const decor = useDecor()
      if (!isMom || !decor) return null
      return h('span', {
        className: 'dsh-mom-heromark',
        'aria-hidden': 'true',
        style: { fontSize: `${String(props.size)}px` },
      }, '💗')
    }

    function MomHeaderBadge(props) {
      const isMom = useSessionIsMom(props)
      const decor = useDecor()
      if (!isMom || !decor) return null
      return h(
        'span',
        { className: 'dsh-mom-badge' },
        // Tooltip resolves its anchor by cloning the child with a `ref` and, when
        // the clone cannot hold one, renders NO bubble at all. `P.Tag` is a plain
        // function component (primitives ships no `forwardRef` anywhere), so the
        // anchor has to be a native element — hence the wrapping span, which is
        // also where the label's hover handlers land.
        h(P.Tooltip, { label: props.t('badgeTip'), side: 'bottom' },
          // `tabIndex` keeps the explanation reachable: Tooltip shows its bubble on
          // focus as well as hover, and a plain span is otherwise not focusable, so
          // a keyboard user would never see `badgeTip` at all.
          h('span', { className: 'dsh-mom-badge__anchor', tabIndex: 0 },
            h(P.Tag, { tone: 'info' },
              h('span', { className: 'dsh-mom-badge__heart', 'aria-hidden': 'true' }, '💗'),
              props.t('badge'),
            ),
          ),
        ),
      )
    }

    function MomHugAction(props) {
      const isMom = useSessionIsMom(props)
      const decor = useDecor()
      const [hugged, setHugged] = React.useState(false)
      if (!isMom || !decor) return null
      return h(
        // Same anchor rule as the badge: `P.Button` cannot hold a ref, so the
        // tooltip anchors a native span wrapping it.
        P.Tooltip,
        { label: props.t('hugTip'), side: 'top' },
        h(
          'span',
          { className: 'dsh-mom-hug-anchor' },
          h(
            P.Button,
            {
              variant: 'ghost',
              size: 'sm',
              // `icon` is the button's own leading-glyph slot; passing the glyph as
              // a child instead would miss its spacing wrapper.
              icon: h(P.IconSparkle16, null),
              className: hugged ? 'dsh-mom-hug dsh-mom-hug--done' : 'dsh-mom-hug',
              onClick: () => setHugged((value) => !value),
            },
            props.t('hug'),
          ),
        ),
      )
    }

    function MomBrandMark(props) {
      const isMom = useRootIsMom(props)
      const decor = useDecor()
      if (!isMom || !decor) return h(P.FishLogo, { size: props.size })
      return h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
        },
        h('path', {
          d: 'M12 20.5 4.2 13a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3A4.6 4.6 0 0 1 19.8 13Z',
          fill: 'var(--dsw-alias-brand-primary)',
        }),
      )
    }

    function MomBrandName(props) {
      const isMom = useRootIsMom(props)
      const decor = useDecor()
      if (!isMom || !decor) return h(P.BrandWordmark, { includeMark: false })
      return h('span', { className: 'dsh-mom-brandname' }, props.t('brandName'))
    }

    function MomOverlay(props) {
      const isMom = useRootIsMom(props)
      const decor = useDecor()
      if (!isMom || !decor) return null
      const hearts = []
      for (let index = 0; index < 9; index += 1) {
        hearts.push(
          h('span', {
            key: index,
            className: 'dsh-mom-heart',
            'aria-hidden': 'true',
            style: {
              left: `${String(6 + index * 10.5)}%`,
              fontSize: `${String(12 + (index % 3) * 6)}px`,
              animationDuration: `${String(11 + (index % 4) * 2.5)}s`,
              animationDelay: `${String(index * 1.3)}s`,
            },
          }, '💗'),
        )
      }
      return h('div', { className: 'dsh-mom-overlay', 'aria-hidden': 'true' }, hearts)
    }

    /**
     * 妈妈模式 的背景人物：她站在侧边栏右手边、贴着底边。
     *
     * Sizing solves for the free gutter rather than assuming one. The conversation
     * is a centred card, so the space she may occupy is
     * `(center - cardMax) / 2`; she is given that plus a small bleed, and the
     * bleed is faded out by a right-edge mask so she never ends in a hard edge
     * over the card. When even the minimum does not fit she renders nothing —
     * a squashed or overlapping character is worse than none.
     */
    function MomBackdrop(props) {
      const isMom = useRootIsMom(props)
      const decor = useDecor()
      const columns = useColumns()
      if (!isMom || !decor) return null
      if (MOM_ART_PATH === '' || MOM_ART_WIDTH === 0) return null

      const gutter = Math.max(0, (columns.center - CARD_MAX_WIDTH) / 2)
      // The one true zero: no gutter at all, either because the card fills the
      // column or because the frame could not be read. There is nothing to stand
      // in, and no reason to put her on top of the card.
      if (gutter <= 0) return null

      // SIZE comes from the top, not from the gutter. She is drawn at her design
      // width and only gives any of it up when the height that width implies would
      // carry her past the top of her parent — the viewport being the parent's
      // height, and `bottom: 0` pinning her there. A short window therefore
      // shrinks her, and nothing else does.
      //
      // The gutter used to be the size driver, which meant a NARROW window shrank
      // her horizontally on sight: at the desktop app's default 1280px the card
      // leaves 80px, and she came out a 104px sliver while the window was 820px
      // tall — plenty of room she was not allowed to use.
      const heightCap = (columns.viewportHeight * ART_MAX_HEIGHT_VH) / 100
      const byHeight = (heightCap * MOM_ART_WIDTH) / MOM_ART_HEIGHT
      const width = Math.min(ART_MAX_WIDTH, byHeight)
      const height = (width * MOM_ART_HEIGHT) / MOM_ART_WIDTH

      // The gutter decides how much of her lands on the card, and that is a
      // READABILITY problem, not a sizing one. `shell.overlay` is z-index 20, so
      // she is painted over the conversation and cannot go behind it; the tools
      // against that are the mask below and this dimming, never a smaller box.
      const reaches = Math.min(width, gutter + ART_BLEED)
      // Full strength while she fits beside the card (or is within ART_MIN_WIDTH of
      // it, which is where she reads as a figure at all); beyond that she dims in
      // proportion to how much of her overlaps, so a tight gutter makes her quieter
      // instead of smaller. This is what pays for the overlap below.
      const fit = Math.min(1, Math.max(reaches, ART_MIN_WIDTH) / width)
      // The fade is complete by the card's TEXT column, not at the far edge of her
      // box. `gutter + ART_BLEED` is where text begins (the bleed is the card's own
      // padding), so ending the ramp there is what holds her to ~0 alpha over text;
      // a ramp spanning her whole box instead left ~18% there. Past this point the
      // mask is pinned open, so the stretch of her lying over the card contributes
      // nothing: she is drawn at full width but reads as ending at the card, which
      // is what lets her keep her size without the gutter deciding it again.
      //
      // Absolute stops, not percentages, because the fade has to line up with the
      // measured card edge rather than with the image box.
      const fadeTo = Math.max(1, Math.min(width, reaches))
      const solidTo = Math.max(0, Math.min(fadeTo - 1, gutter - ART_FADE_LEAD))
      const fade = `linear-gradient(to right, #000 ${String(Math.round(solidTo))}px, transparent ${String(Math.round(fadeTo))}px)`

      return h('div', {
        className: 'dsh-mom-backdrop',
        'aria-hidden': 'true',
        style: {
          left: `${String(Math.round(columns.sidebar))}px`,
          width: `${String(Math.round(width))}px`,
          height: `${String(Math.round(height))}px`,
          backgroundImage: `url("${MOM_ART_PATH}")`,
          // Hold, then dissolve: nothing over the card ever ends on a hard edge.
          maskImage: fade,
          WebkitMaskImage: fade,
          opacity: String(ART_OPACITY * fit),
        },
      })
    }

    function MomSettingsRow(props) {
      const isMom = useRootIsMom(props)
      const decor = useDecor()
      // Gated on the session's preset like every other surface: the row's only
      // effect is on mom-mode decoration, so showing it in a `standard` session
      // would offer a switch with no visible consequence. `settings.general.item`
      // is a root slot, and `useSessions` reaches root occupants too, so the gate
      // costs nothing.
      if (!isMom) return null
      return h(
        'div',
        { className: 'dsh-mom-settings' },
        // The Switch takes only a `label`, which becomes its accessible name, so
        // it is given the SAME text the row shows. A separate longer string would
        // leave the visible title and the spoken name disagreeing, and the
        // primitive exposes no `aria-describedby` to attach the hint with.
        h(P.Switch, {
          checked: decor,
          onChange: setDecor,
          label: props.t('settingsTitle'),
        }),
        h(
          'div',
          null,
          h('div', null, props.t('settingsTitle')),
          h('div', { className: 'dsh-mom-settings__hint' }, props.t('settingsHint')),
        ),
      )
    }

    // ── registration ────────────────────────────────────────────────────────
    const inject = ['slots', 'sessions', 'theme', 'locale']

    function apply(ctx) {
      // Plugin-owned stylesheet, disposed with the fiber so HMR unload and a
      // profile removal both take it back out.
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {}
        const tag = document.createElement('style')
        tag.dataset.plugin = PLUGIN_ID
        tag.dataset.pluginCss = `${PLUGIN_ID}/mom.css`
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => tag.remove()
      }, `${PLUGIN_ID}: stylesheet`)

      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), `${PLUGIN_ID}: dictionaries`)

      // The palette is document-wide CSS, so it cannot be driven from a slot
      // occupant — it follows whichever session is on screen (the same lookup
      // the root-scoped surfaces use), and leaving mom mode removes the layer
      // instead of writing a preference.
      ctx.effect(() => {
        let layer = null
        const sync = () => {
          const state = ctx.sessions.list.getSnapshot()
          const preset = onScreenSession(state)?.projectionValues?.agentPreset
          const want = preset === PRESET_ID
          if (want && layer === null) {
            layer = ctx.theme.overrideTokens(PLUGIN_ID, MOM_TOKENS)
          } else if (!want && layer !== null) {
            layer()
            layer = null
          }
        }
        const stop = ctx.sessions.list.subscribe(sync)
        sync()
        return () => {
          stop()
          if (layer !== null) layer()
        }
      }, `${PLUGIN_ID}: warm palette`)

      /**
       * 把「深度求索中」换成妈妈的话。
       *
       * The string belongs to `@deepseek-ai/dsh-client-ui-chat`, and it cannot be
       * overridden the supported way: it lives in that plugin's locale namespace,
       * the registry is single-occupancy per (namespace, locale) — `register`
       * throws `locale namespace "chat" already has locale "zh"` — the plugin's
       * Config exposes no label field, and `RunningStatus` is rendered by the chat
       * view's own tree rather than by a slot occupant, so no seat can shadow it.
       * The one lever left is the text node. `[data-chat-running]` is a stable
       * data attribute on the container, and only the PREFIX is replaced, so the
       * timed variant keeps its 「，用时 3 秒」half.
       */
      ctx.effect(() => {
        if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return () => {}
        const t = ctx.locale.bind(NS)
        const rewrite = (text) => text
          .replaceAll('深度求索中', t('runningLabel'))
          .replaceAll('Deep diving', t('runningLabel'))
        let isMom = false
        const replace = () => {
          if (!isMom) return
          for (const container of document.querySelectorAll?.('[data-chat-running]') ?? []) {
            // The RETAINED copy is an ordinary text node.
            for (const node of textNodesOf(container)) {
              const next = rewrite(node.data)
              if (next !== node.data) node.data = next
            }
            // The shimmer's DECORATION layer — the marquee — has NO text node.
            // `TextShimmer` puts that copy in a `data-shimmer-text` ATTRIBUTE and
            // paints it with `content: attr(data-shimmer-text)` in a `::after`
            // pseudo-element, so a text-node walk walks straight past it: the
            // label read correctly while the run-on copy still said 深度求索中.
            for (const element of container.querySelectorAll?.('[data-shimmer-text]') ?? []) {
              const value = element.getAttribute('data-shimmer-text')
              const next = rewrite(value ?? '')
              if (next !== value) element.setAttribute('data-shimmer-text', next)
            }
          }
        }
        const stop = ctx.sessions.list.subscribe(() => {
          isMom = onScreenSession(ctx.sessions.list.getSnapshot())?.projectionValues?.agentPreset === PRESET_ID
          replace()
        })
        isMom = onScreenSession(ctx.sessions.list.getSnapshot())?.projectionValues?.agentPreset === PRESET_ID
        replace()
        const observer = new MutationObserver(replace)
        observer.observe(document.body ?? document.head ?? document, {
          childList: true,
          subtree: true,
          characterData: true,
        })
        return () => {
          observer.disconnect()
          stop()
        }
      }, `${PLUGIN_ID}: thinking label`)

      /**
       * 把输入框的默认 placeholder 换成妈妈的话。
       *
       * The string belongs to `@deepseek-ai/dsh-client-ui-conversation`
       * (`placeholder.default`) and, like the thinking label, has no supported
       * override: `InputBar` resolves it from that plugin's own namespace, the
       * composer bar is a `single` seat so no occupant can shadow it, and its
       * Config exposes no copy field. `conversation.input.dock` and friends are
       * `list` seats that render BESIDE the editor, never inside it.
       *
       * Two shipped strings per locale are rewritten, because a NEW session shows a
       * different one: a blank session renders the composer bar as `variant: 'hero'`,
       * and `ConversationContent` passes `placeholder.hero` there instead of
       * `placeholder.default` — so rewriting only the latter left the new-session
       * input still saying 描述你想要构建的内容. Both leads collapse to the same
       * wording, and each keeps the host's own tail.
       *
       * The tail — ", / 调用指令, @ 文件或对话" — is sliced off the shipped string
       * rather than retyped here, so the `/` and `@` affordances stay whatever the
       * host says they are. The match is against the WHOLE shipped string, which is
       * what keeps the situational placeholders (会话不可用 / plan / 选工作区 / 插话提示)
       * untouched: they differ, so they fall through.
       *
       * Three places carry the same string and all three are rewritten, or the UI
       * would disagree with itself: the visible `[data-composer-placeholder]` text
       * node, the editor's `data-placeholder`, and its `aria-label` (the contenteditable
       * takes the placeholder as its accessible name, since a div has no
       * placeholder attribute).
       *
       * All three are RESTORED on the way out, which React will not do for us — see
       * `originals` below.
       */
      ctx.effect(() => {
        if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return () => {}
        const t = ctx.locale.bind(NS)
        // Every shipped placeholder that carries the affordance tail, per locale,
        // split into the lead clause (swapped) and everything after it (kept). A
        // string the host adds later simply stops matching and keeps its own copy.
        const DEFAULTS = {
          zh: [
            { full: '发消息或创建任务, / 调用指令, @ 文件或对话', lead: '发消息或创建任务' },
            { full: '描述你想要构建的内容, / 调用指令, @ 文件或对话', lead: '描述你想要构建的内容' },
          ],
          en: [
            { full: 'Message or run a task, / commands, @ files or sessions', lead: 'Message or run a task' },
            { full: 'Describe what you want to build, / commands, @ files or sessions', lead: 'Describe what you want to build' },
          ],
        }
        const ENTRIES = Object.values(DEFAULTS).flat()
        const rewrite = (text) => {
          for (const { full, lead } of ENTRIES) {
            if (text === full) return t('placeholderLead') + full.slice(lead.length)
          }
          return text
        }
        /**
         * What each carrier said before mom touched it, so leaving mom can put the
         * host's own words back.
         *
         * React cannot do it. On a session switch the host re-renders with its
         * shipped string, but that string is what its PREVIOUS render already said,
         * so reconciliation sees no change and writes nothing — the mutation this
         * effect made survives the switch and mom keeps her wording in a standard
         * session. (Confirmed in the field: the composer node is reused across the
         * switch, so the rewrite outlived the preset that caused it.)
         *
         * Keyed by carrier, then by attribute name (`null` for a text node). The
         * remembered value is only written when the carrier holds a string this
         * table recognises as shipped, so the record is always the host's own words
         * for THAT carrier — and a host re-render that swaps the default placeholder
         * for the hero one updates the record instead of leaving a stale one behind.
         */
        const originals = new WeakMap()
        const remember = (carrier, attr, value) => {
          let byName = originals.get(carrier)
          if (byName === undefined) {
            byName = new Map()
            originals.set(carrier, byName)
          }
          byName.set(attr, value)
        }
        const recall = (carrier, attr) => originals.get(carrier)?.get(attr)
        const forget = (carrier, attr) => originals.get(carrier)?.delete(attr)

        /** Every string slot this effect owns: the visible text and both attributes. */
        function* slots() {
          for (const container of document.querySelectorAll?.('[data-composer-placeholder]') ?? []) {
            // The visible copy is an ordinary text node.
            for (const node of textNodesOf(container)) {
              yield { carrier: node, attr: null, read: () => node.data, write: (value) => { node.data = value } }
            }
          }
          // The editor surface holds the same string twice: as the `data-placeholder`
          // the host reads back, and as the accessible name.
          for (const element of document.querySelectorAll?.('[data-placeholder]') ?? []) {
            for (const name of ['data-placeholder', 'aria-label']) {
              yield {
                carrier: element,
                attr: name,
                read: () => element.getAttribute?.(name) ?? null,
                write: (value) => element.setAttribute?.(name, value),
              }
            }
          }
        }

        let isMom = false
        const replace = () => {
          for (const slot of slots()) {
            const value = slot.read()
            if (value === null || value === undefined) continue
            if (isMom) {
              const next = rewrite(value)
              if (next === value) continue
              if (ENTRIES.some((entry) => entry.full === value)) remember(slot.carrier, slot.attr, value)
              slot.write(next)
            } else {
              const back = recall(slot.carrier, slot.attr)
              if (back === undefined || back === value) continue
              slot.write(back)
              // Re-entering mom re-records it: the carrier is holding a shipped
              // string again, which is exactly the condition `remember` requires.
              forget(slot.carrier, slot.attr)
            }
          }
        }
        // Writing an attribute re-enters this observer; the rewrite then no-ops
        // because the string is already mom's, and the restore no-ops because the
        // record was dropped — so a pass converges instead of looping.
        const stop = ctx.sessions.list.subscribe(() => {
          isMom = onScreenSession(ctx.sessions.list.getSnapshot())?.projectionValues?.agentPreset === PRESET_ID
          replace()
        })
        isMom = onScreenSession(ctx.sessions.list.getSnapshot())?.projectionValues?.agentPreset === PRESET_ID
        replace()
        const observer = new MutationObserver(replace)
        observer.observe(document.body ?? document.head ?? document, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['data-placeholder', 'aria-label'],
        })
        return () => {
          observer.disconnect()
          stop()
        }
      }, `${PLUGIN_ID}: composer placeholder`)

      // `order: 40` puts mom's ambient rows after the shipped ones that share a
      // list (the queue dock registers at 20), so a shipped prompt still leads.
      const register = (slot, id, order, Component, locale) => {
        ctx.slots.inject(slot, () =>
          ctx.slots.register({ name: slot, id, order, ...(locale === undefined ? {} : { locale }) }, Component),
        )
      }

      if (SURFACES.headerBadge) register('conversation.session.header.utilities', 'mom-badge', 40, MomHeaderBadge, NS)
      if (SURFACES.heroMark) register('conversation.hero.brand.mark', 'mom-hero-mark', 40, MomHeroMark)
      if (SURFACES.hugAction) register('conversation.chat.assistant-actions', 'mom-hug', 40, MomHugAction, NS)
      if (SURFACES.settingsRow) register('settings.general.item', 'mom-settings', 40, MomSettingsRow, NS)
      // `shell.overlay` is the only additive, frame-wide, non-shadowing seat. Its
      // layer sits at z-index 20 above every column, so the character cannot go
      // BEHIND the conversation — which is why she is sized to the empty gutter
      // beside the card instead of being spread across the frame.
      if (SURFACES.background) register('shell.overlay', 'mom-backdrop', 10, MomBackdrop)
      if (SURFACES.ambientOverlay) register('shell.overlay', 'mom-overlay', 40, MomOverlay)

      if (SURFACES.sidebarBrand) {
        // Single-cell slots: registering here SHADOWS the shipped occupant, so
        // each component renders the official mark itself when the current
        // session is not mom. Both brand slots are taken together, matching how
        // `dsh-client-ui-brand-official` fills them.
        //
        // The explicit `priority: -1` is load-bearing, not cosmetic. For
        // single/keyed slots `priority` is a cell-shadowing rank that defaults
        // to 0, and `brand-official` registers both of these at that default —
        // a second registration at the SAME priority THROWS at load ("register
        // at a different priority to shadow it"), which would take the whole
        // client plugin down. Lower renders, so -1 wins the cell cleanly.
        ctx.slots.inject('sidebar.brand.mark', () =>
          ctx.slots.inject('sidebar.brand.name', function* () {
            yield ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, MomBrandMark)
            yield ctx.slots.register({ name: 'sidebar.brand.name', priority: -1, locale: NS }, MomBrandName)
          }),
        )
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
