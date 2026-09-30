# ⚠️ 先看这里：解决状态（这份是历史记录，不是现行问题清单）

**下面这些发现，后面一轮全都修掉了。** 这张表把每一条对上它的修法；正文保持原样，当作当时的证据留档。**别拿正文判断代码现状哈。**

> **📌 后续变更（比这张表更新）：输入框上方那条横幅已经整个删掉了。** 所以下面凡是讲横幅的
> 条目——尤其 §9 / 问题一（"轮次跑着的时候横幅超前一轮"）——现在都**没有对应代码了**，
> 当历史看就行。跟它一起删掉的还有：`MomInputBanner`、`useLastTurn`、客户端那份 `MOODS` 副本、
> 以及为它存在的**跨半边 FNV-1a 哈希约定**（`test/smoke.mjs` 里那段 200 轮对照也一并移除）。
> 情绪表现在只剩两处：预设的 `moods:` 和插件的 `DEFAULT_MOODS`。
>
> **📌 再后来：安装方式换成了标准 bundle。** `install.sh`、`tools/preset-row.py`、
> `tools/patch-edit.py`、`presets/` 全部删除——现在就是 `package.json`（声明
> `dsh.bundle.patch`）+ `cordis.patch.yml`，用 `plugin_manager install_bundle` 装。
> 所以本文里凡是指 `install.sh` 行为、`$DSH_HOME/.agent-presets/` 拷贝、绝对路径改写的记述，
> 一律当历史。
>
> **📌 再后来：「全肯定」那一层也整个删掉了。** 上面那句"情绪表现在只剩两处"已经作废——
> **情绪表、`moods:`、关键词分类器、FNV-1a 轮换、`DEFAULT_MOODS`、`DEFAULT_AFFIRMATIONS`
> 全都没有了**，连"每轮注入一条 user 消息"这件事本身都没了。`dsh-mom-mode` 现在只做一件事：
> 注册那段行为准则 prompt（约 80 行）。所以下面凡是指"插件会注入/会挑短语/会按情绪选档"的
> 说法，一律当历史。剩下跟情绪表有关的，只有本文档自己的记述。

| 发现 | 状态 | 修法 |
|---|---|---|
| §2(c)、问题二 — `Tooltip` 的子元素得能接 ref，可 `Tag`/`Button` 接不住 | ✅ 修好了 | 两个 Tooltip 都改成锚定原生 `<span>`（`.dsh-mom-badge__anchor` / `.dsh-mom-hug-anchor`），跟官方那 38 处调用一个形状。徽章锚点另外加了 `tabIndex: 0`，这样键盘也能把气泡唤出来 |
| §9、问题一 — 横幅在轮次跑着的时候超前一轮 | ✅ 修好了（改的是文档，不是行为） | 行为保留成「**预览下一轮**要注入的那句」——这是唯一不需要运行态信息就能成立的说法呀（客户端能看到的投影里没有 running 标志）。`useCurrentTurn` 和 `MomInputBanner` 里 "last COMMITTED turn" / "stay in step" 那两句错话改掉了，README 也单开了一条 |
| 问题三 — 单实例令牌防的是错的失败，注释被推翻 | ✅ 从根上修好了 | 令牌整个删掉。改成**只留一条安装路径**：`dsh-mom-ui/package.json` 不再声明 `dsh.bundle`，`cordis.patch.yml` 删了。这么一来 `dsh plugin add` 只会把它装成一个不生效的普通依赖，不可能多出第二个 Loader entry。`test/smoke.mjs` 加了一条测试，守住「只能有一条路」这件事 |
| 小毛病 1 — `--dsh-composer-max-width` 根本不存在 | ✅ 修好了 | 换成真实存在的 `--dsh-composer-card-max-width` |
| 小毛病 2 — `Button` 有 `icon` prop，却把图标当 child 传 | ✅ 修好了 | 改用 `icon: h(P.IconSparkle16)`，拿到了按钮自带的间距包裹 |
| 小毛病 3 — `Tag` 不可聚焦，徽章 tooltip 键盘够不到 | ✅ 修好了 | 锚点 `<span>` 加了 `tabIndex: 0` |
| 小毛病 4 — `Switch` 的可及名跟可见标题对不上 | ✅ 修好了 | `label` 改用可见的 `settingsTitle`（WCAG 2.5.3），多余的 `settingsLabel` 删了。原语不提供 `aria-describedby`，在它这个 props 面下这是唯一能做的关联了 |
| 小毛病 5 — `order: 40` 的意图没写明 | ✅ 修好了 | 加了注释，说明它排在共享 list 的那些内置组件（队列 dock 是 20）后面 |
| 小毛病 6 — `dsh.client` 没声明 `inject` | ✅ 修好了 | 补上 `inject: ['@deepseek-ai/dsh-client-ui-renderer']`，跟 brand-official 的约定一致，把"排在 renderer 之后"从碰巧变成写明 |
| 小毛病 7 — 头部注释把 hook 的可达范围写窄了 | ✅ 修好了 | 改成：Global hooks 对两种作用域都可达，只有 `useProjection` 是 session 专属 |
| 「核对过、不用动」里说 `dsh.bundle.patch` 是真约定 | ⚠️ 故意没跟 | 它确实是真字段（6 个内置 bundle 在用），但跟本项目「只留一条安装路径」的取舍撞了，所以拿掉。这是唯一一处有意不采纳的结论 |

这份审计没覆盖、但同一轮里另外修掉的问题（来自另一份评审）：`install.sh` 在 UTF-8
locale 下的 `$VAR（` 崩溃、两条安装路径按包名冲突、`patch-edit.py` 的 `[]`／撕裂写／裸文件名、
`notice.summary` 的 120 字上限、还有 README 里"客户端半边必须重启"那个错结论（其实是
`dsh-client-hmr` 的 node 半边 500ms 轮询，约半秒自动热替换）。

回归覆盖：`test/smoke.mjs`（115 项）+ `test/install.mjs`（53 项）。

---

# 审计正文

**审的是** `/Users/name/codes/mom_preset_dsh/dsh-mom-ui/lib/client.js`（529 行）、`lib/index.js`、`package.json`。

**参照的是** `/Users/name/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/`（所有包都是 `0.1.5-rc.3`）。

**引用说明。** `dsh-web-frontend/dist/assets/index-BKQ_L1z6.js` 是 Vite 压过的 shell（117 行）；那份冻结的 require 表在**第 114 行**，primitives 命名空间和 SlotCore 类在**第 56 行**，`Tooltip` 的实现在**第 61 行**。其余引到的都是能直接读的源码。

---

## 1. 模块注册 —— **对上了**

`window.__ModuleLoader__.load({id, factory})` 跟 shipped 的形状一模一样；factory 返回的对象就是这个模块的 exports，而 `registry.plugin` 会读 `apply` **和** `inject`。

| 事实 | 证据 |
| --- | --- |
| `load({id, factory})` 就是注册的规矩 | `dsh-client-modules/lib/client.js:1-6`（这个包自己的 bundle）、`:229-233`（`register()` 按 `stripClientSuffix(id)` 存 `registration.factory`） |
| factory 的返回值就是模块 exports | `dsh-client-modules/lib/client.js:272-293`（`exports: registered(this.makeRequire(edges))`）、`:311-320`（`import()` 返回 `record.exports`） |
| shell 读的是 `exports.apply` | `cordis-plugin-loader/lib/index.js:269-282`（`EntryTree.import` → `ctx.loader.internal.import`）、`:520-527`（`_init` → `unwrapExports` → `_start`）、`:536-543`（`ctx.registry.plugin(plugin, …)`） |
| 没有 `apply` 的插件会被拒 | `cordis/lib/index.js:1617-1618` —— `throw new Error("invalid plugin, expect function or object with an \"apply\" method, received " + typeof plugin)` |
| `apply(ctx)` 拿到的就是插件 ctx | `cordis/lib/index.js:1071-1073` —— `runtime.callback(this.ctx, this.config)` |
| **`exports.inject` 在客户端这边也算数** | `cordis/lib/index.js:1634` —— `new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, …)`；客户端这边只换了*模块来源*（`internal.import`），插件机制一点没换。所以 `inject` **不是** host 专属的 |
| 用 `Symbol.toStringTag` 而不是 `__esModule`，没副作用 | `cordis-plugin-loader/lib/index.js:731-736` —— `unwrapExports`：没有 `default`、也没有 `__esModule` → 原样返回这个对象 |

## 2. 基线模块表与 primitives —— **对上了**，但有一处真的违约（见 §2(c)）

**(a) 两个说明符都在种子里。** `index-BKQ_L1z6.js:114`：

```js
function by(){return{react:ec,"react/jsx-runtime":ic,"react-dom":cc,"react-dom/client":fc,
  "@deepseek-ai/cordis":Ha,"@deepseek-ai/dsh-client-store":Hc,"@deepseek-ai/dsh-client-ui-slots":Ac,
  "@deepseek-ai/dsh-client-ui-primitives":Zg,"@deepseek-ai/dsh-client-ui-dockkit":Ey}}
```

这个对象就是交给模块系统的 `staticModules` 种子，位置在
`index-BKQ_L1z6.js:114`（`r.create({boot:t.__DSH_BOOT__, staticModules:by(), …})`）；`makeRequire`
会最先拿它来答（`dsh-client-modules/lib/client.js:300-309`）。✓ 所以 `react` 和 primitives
都能解析到，而这个 bundle 也不需要别的东西。

**(b) 点名的七个 primitives 都在** —— `index-BKQ_L1z6.js:56`，那个冻结命名空间：

`BrandWordmark:uC, Button:w3, FishLogo:cC, IconSparkle16:Zp, Switch:Xp, Tag:Kp, Tooltip:Fr` —— 全在。

| 插件用到的 prop | 结论 | 证据 |
| --- | --- | --- |
| `Tooltip({label, side})` | 名字对 | `index-BKQ_L1z6.js:61` —— `function Fr({label:t,side:r="right",delayMs:i=0,disabled:s=!1,maxWidth:a,children:c})`；`side` 的分支有 `right`/`top`/`bottom`，所以 `'bottom'` 和 `'top'` 都没问题 |
| `Tag({tone})` 传 `'info'` | 对 | `index-BKQ_L1z6.js:56` —— `function Kp({tone:t="outline",className:r,children:i})` → `data-tone={tone}`；`dist/assets/index-DPX2bQLO.css` 里为 `outline, solid, neutral, quiet, success, info, warning, danger` 都定义了 `[data-tone=…]` |
| `Button({variant, size, className, onClick})` | 对 | `index-BKQ_L1z6.js:56` —— `function w3({variant:t="ghost",size:r="md",icon:i,className:s,children:a,...c})` → `className=Ce(ro.button,ro[t],ro[r],s)`，`...c` 会摊到 `<button>` 上，所以 `onClick` 能透过去；类名映射是 `ro={button,md,sm,primary,ghost,outline,toolbar,icon}` → **合法 variant**：`primary, ghost, outline, toolbar`；**合法 size**：`md, sm`。`'ghost'` + `'sm'` ✓ |
| `Switch({checked, onChange, label})` | 对，而且 **`onChange` 收到的是 BOOLEAN，不是 event** | `index-BKQ_L1z6.js:56` —— `function Xp({checked:t,onChange:r,label:i,disabled:s=!1,title:a,className:c})` … `onClick:()=>{r(!t)}`。所以插件的 `onChange: setDecor` 拿到的是 `true`/`false` —— 跟 `setDecor(next)` 对得上（`client.js:214`） |
| `FishLogo({size})` | 对 | `index-BKQ_L1z6.js:56` —— `function cC({size:t=24,className:r})` |
| `BrandWordmark({includeMark})` | 对 | `index-BKQ_L1z6.js:56` —— `function uC({size:t=24,className:r,includeMark:i=!0})` |
| `IconSparkle16` 不给 props | 对 | `index-BKQ_L1z6.js:56` —— `Zp=({size:t=16,className:r})=>…`，两个都是可选的 |

没有哪个 prop 缺失或者叫错名。**插件用到的 `variant`/`size` 也都在合法范围内。**

**(c) 这里有个问题 —— `Tooltip` 的子元素得能接 ref，而 `Tag`/`Button` 接不住。**

`Tooltip` 定位**只**靠子元素身上的 ref
（`index-BKQ_L1z6.js:61`）：

```js
const h=I.useRef(null), p=c.ref, m=I.useCallback(B=>{h.current=B; … },[p]), [g,v]=I.useState(null),
const F=()=>{ if(s)return; const B=h.current; if(B===null)return; const G=B.getBoundingClientRect(); x(r); v({…}) }
…
I.cloneElement(c,{ref:m,onMouseEnter:…,onMouseLeave:…,onFocus:…,onBlur:…}),
g!==null && d.jsx("span",{ref:k,className:zd.bubble,role:"tooltip",children:_})
```

气泡只在 `g !== null` 时才渲染，而 `g` 只在 `F()` 里被设上 —— `F()` 一看到
`h.current === null` 就**直接退出了**。`Button`（`function w3(…)`）和 `Tag`（`function Kp(…)`）
在生产 bundle 里就是普通函数组件，不是 `forwardRef` 的产物；而 shell 跑的是 React 18.3.1
（`dsh-client-ui-renderer/lib/client.js:17` 里带着 pnpm 路径 `use-sync-external-store@1.2.0_react@18.3.1`），
这个版本下 `cloneElement(el,{ref})` 碰到函数组件会把 ref 丢掉。旁证：整个 shipped 树里
**38 处 `primitives.Tooltip` 调用全都包着宿主 DOM 元素**（比如
`dsh-client-ui-sidebar-right/lib/client.js:814-828`、`dsh-client-ui-conversation/lib/client.js:14237-14255`），
没有一处把 primitives 组件直接当子元素。

*在浏览器里是什么样呢：* `conversation.session.header.utilities` 那个妈妈徽章（`client.js:280`）和
「抱抱」按钮（`client.js:325`）都能渲染、也有 hover 反应，但**永远不出气泡** —— 不报错，
就是什么都不干，也不报错。这条是拿生产 bundle 静态比对出来的，没真跑页面点一下。

## 3. 插槽注册选项、priority、`locale` —— **对上了**

SlotCore 的 `register` —— `index-BKQ_L1z6.js:56`：

```js
register(t,r){ const i=this.records.get(t.name);
  if(!i?.spec) throw new Error(`slot "${t.name}" is not declared (a parent entry's children table must declare it)`);
  const s=i.spec, a=t.priority??0,
        c=m=>`at priority ${a}… — register at a different priority to shadow it (lowest renders)`;
  switch(s.kind){
    case"single": { const m=i.entries.find(g=>(g.options.priority??0)===a); if(m) throw new Error(`single slot "${t.name}" already has a registration ${c(m)}`); break }
    case"keyed":  { if(t.key===void 0) throw …; …same priority && same key → throw… }
    case"list":   { if(t.id===void 0) throw new Error(`list slot "${t.name}" requires options.id`);
                    const m=i.entries.find(g=>g.options.id===t.id&&(g.options.priority??0)===a); if(m) throw new Error(`list slot … already has an entry with id "${t.id}" ${c(m)}`); break }
    case"chain":  { if(t.select===void 0) throw …; break } }
```

| 说法 | 结论 | 证据 |
| --- | --- | --- |
| list 单元要 `{name, id, order, locale}` | 对上了 | `id` 对 `list` 是必填；`order` 每种 kind 都收，用作 list 的并列打破（`p.sort(s.kind==="list" ? (a,b)=>(a.priority??0)-(b.priority??0)\|\|(a.order??0)-(b.order??0) : …)`） |
| single 单元要 `{name, priority}`，不收 `id`/`order` | 对上了 | `single` **没有**必填字段；`id`/`order` 会被存下来但 `single` 用不到。插件给品牌那两个槽传的正是这两个都没传 —— 对 |
| **single** 单元上同优先级的第二次注册会抛 | 对上了 | `throw new Error(\`single slot "${t.name}" already has a registration … register at a different priority to shadow it (lowest renders)\`)` |
| **list** 单元上同优先级、同 `id` 的第二次注册会抛 | 对上了 | `list slot … already has an entry with id "${t.id}"` |
| **更低的** priority 赢 / 能把别人盖掉 | 对上了 | 升序排序 `(a.priority??0)-(b.priority??0)`，加上 `entriesOfSlot` 每个单元只留**第一个**活着的条目：`for(const c of r.entries){ if(this.abdicated.has(c))continue; const h=i==="keyed"?c.options.key:i==="list"?c.options.id:void 0; a.has(h)\|\|(a.add(h),s.push(c)) }`（single ⇒ 所有条目的 `h` 都是 `undefined` ⇒ 只会有一个赢家） |
| `locale` 是合法的注册选项，值是个命名空间字符串 | 对上了 | 不管哪种 kind，它都会被带到条目上（`…(t.locale!==void 0?{locale:t.locale}:{})…`），渲染时被消费掉：`dsh-client-ui-renderer/lib/client.js:602-606` |
| `dsh-client-ui-brand-official` 这两个品牌槽都是按默认的 priority 0 注册的 | 对上了 | `dsh-client-ui-brand-official/lib/client.js:37-38` —— `ctx.slots.register({name:"sidebar.brand.mark"}, …)` / `{name:"sidebar.brand.name"}`，**都没有** `priority` |

所以 `priority: -1` 确实能遮住 brand-official 的 `0`，插件里那句删不得的注释
（`dsh-mom-ui/lib/client.js:504-521`）对机制的描述是准的。

## 4. `ctx.slots.inject` 与释放的规矩 —— **对上了**

- 它确实存在，签名是 `(key, callback)`：`dsh-client-ui-renderer/lib/client.js:1015`
  （`inject(key, callback)`），声明在 `lib/types/client/registry.d.ts:100`。
- 回调返回值：`SlotInjectionEffect = (() => void) | Iterable<() => void, void, void>`
  （`registry.d.ts:44`），也就是**一个 disposer，或者一组 disposer**。回调是通过
  `ctx.effect(callback, …)` 装上的（`dsh-client-ui-renderer/lib/client.js:1041`）。
- 可迭代的东西会被迭代，yield 出来的都收作 disposer；释放是**倒序**的：
  `cordis/lib/index.js:1145-1152`（`else if (Symbol.iterator in effect) { … const result = iter.next(); safeCollect(result.value); if (result.done) return; }`）
  和 `:1178`（`for (const disposable of disposables.splice(0).reverse()) …`）。
  类型说明在 `cordis/lib/types/fiber.d.ts:41-51`（"generator effects register each yielded disposer as it is produced"；"Disposers run in reverse registration order"）。
- **在 `inject` 回调里再套一层 `inject` 是正当的** —— shipped 的品牌插件就是这么干的：
  `dsh-client-ui-brand-official/lib/client.js:36-39`
  （`ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", function* () { yield …; yield … }))`），
  跟 `dsh-mom-ui/lib/client.js:516-521` 逐字符同形。
- 回调只在插槽**已被声明**期间才跑（`reconcile()` 在 `specDynamic(key) === undefined` 时提前返回，
  `dsh-client-ui-renderer/lib/client.js:1031-1040`），这也是 `package.json` 里不需要
  `dsh.client.inject` 那一行的原因。
- 有一处文档上的细微出入：registry 的文档把可迭代 effect 叫"事务性"的
  （`registry.d.ts:91`），但 cordis 是**产出即收集**——一个 generator 如果在第二次 `register`
  时抛了，第一次那个注册还活着。这个插件碰不到（两次品牌注册是彼此独立的），但它不是注释
  暗示的那种事务保证。

## 5. 插槽名、kind、scope，以及填进来的组件能拿到什么 props —— **对上了（八个都在）**

| 插槽 | Kind / scope | 声明证据 | 渲染处传的 owner props |
| --- | --- | --- | --- |
| `conversation.session.header.utilities` | list / session | `dsh-client-ui-conversation/lib/client.js:16695-16698` | `{}` —— `dsh-client-ui-conversation/lib/client.js:15077` |
| `conversation.input.dock` | list / session | `dsh-client-ui-conversation/lib/client.js:16629-16632` | `zone = {session, input}` —— `:14869-14872`，渲染在 `:14927` |
| `conversation.composer.dock` | list / session | `dsh-client-ui-conversation/lib/client.js:16744-16747` | `{}` —— `:16259` |
| `conversation.chat.assistant-actions` | list / session | `dsh-client-ui-chat/lib/client.js:3763-3766` | `{messageId}` —— `dsh-client-ui-chat/lib/client.js:3655` |
| `settings.general.item` | list / root | `dsh-client-ui-settings-general/lib/client.js:657-660` | `{}` —— `:344` |
| `sidebar.brand.mark` | **single** / root | `dsh-client-ui-sidebar/lib/client.js:379-382` | `{size: 24}`（外加 `fallback: <FishLogo size={24}/>`）—— `:215`、`:246` |
| `sidebar.brand.name` | **single** / root | `dsh-client-ui-sidebar/lib/client.js:383-386` | `{}`（外加一个 `<span>` 当备用）—— `:218` |
| `shell.overlay` | list / root | `dsh-client-ui-layout/lib/client.js:540-543` | `{}` —— `dsh-client-ui-layout/lib/client.js:276` |

**填进来的组件能拿到什么 props —— 精确答案在这儿。** 标准套件会把*根*那套 props 合进*每一种* scope，然后再叠上该
scope 自己的（`dsh-client-ui-renderer/lib/client.js:538-573`，`standardProps`：

```js
if (scope === "root") return root;
standard = { ...root, ...materializeStandardBinding(scopeBinding, scope === "session-maybe") };
```

再加上 `:599-627` 的 `standardKit`），而 hook 名是这么合成的：
`standardHookPropName = t => \`use${t[0]?.toUpperCase() ?? ""}${t.slice(1)}\``
（`index-BKQ_L1z6.js:56`，导出名是 `standardHookPropName:Rc`）。

- 根贡献：`dsh-client-ui-session/lib/client.js:321-324` ——
  `provideRoot({hooks:{sessions: ctx.sessions.list, sessionPendingInteraction: …}})`；
  `dsh-client-ui-workspace/lib/client.js:2730`（`workspaces`）；`dsh-client-ui-layout/lib/client.js:519`（`panelInfo`）。
  ⇒ 所以 `props.useSessions` **在根和 session 作用域都有**（它是继承下来的）。
- session 绑定：`dsh-client-ui-session/lib/client.js:57-69`（`BUILTIN_SOURCE`）——
  `hooks:["session"]`、`keyedHooks:["projection"]`、`props:["sessionId"]` 解析成
  `props:{sessionId}`、`keyedHooks:{projection:(key)=>binding.session.projections.faceOf(key)}`。
  ⇒ `props.sessionId` ✓，`props.useProjection(key, selector?)` ✓，但**只有 session 作用域**的组件才有。
- `props.t` **不是** scope prop：只有当*注册*里声明了
  `locale: <namespace>` 时它才出现 —— `dsh-client-ui-renderer/lib/client.js:602-606`
  （`if (entry.locale !== void 0) { … kit["t"] = localeSeat(face, entry.locale) }`），而且没装
  locale face 的话它会**抛** `SlotAssemblyError`。
- `size` 完全不是标准 prop —— 它纯粹是以 owner props 的形式，从 `renderSlot(…, { size: 24 })`
  传到填 `sidebar.brand.mark` 那个组件手上（`dsh-client-ui-sidebar/lib/client.js:215`、`:246`）。

插件这个 registry/scope 配对**每一处都是对的**：四个 session 作用域的组件用
`props.useProjection`，四个 root 作用域的用 `props.useSessions`
（`dsh-mom-ui/lib/client.js:239-252`，调用点 `:273-415`）；`locale: NS` 恰好只声明在
那五个会读 `props.t` 的注册上（`:497`、`:499`、`:500`、`:501`、`:519`），另外两个不读的
（`:498`、`:518`）都没有。

## 6. `ctx.theme.overrideTokens(source, tokens)` —— **对上了**，25 个 token 也都在

- 签名 `overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void` ——
  `dsh-client-ui-theme/lib/types/client/index.d.ts:178`；实现在
  `dsh-client-ui-theme/lib/client.js:1364-1376`，返回的 disposer 只摘掉它自己那一层
  （`if (this.overrides.get(source) !== layer) return; this.overrides.delete(source); this.publish()`）。
- 值形状 `{ light, dark }` 是运行时强制的 —— `dsh-client-ui-theme/lib/client.js:1430-1442`：
  直接给字符串会抛一个教学式错误；给个不是 `{light:string, dark:string}` 的对象会抛
  `must map to a { light, dark } pair of strings`。
- token 名就是 **CSS 自定义属性名**（`--dsw-alias-*`），原样应用：
  `dsh-client-ui-layout/lib/client.js:474-478`（`for (const [name, value] of Object.entries(snapshot.active.tokens)) body.style.setProperty(name, value)`），
  而 shipped 的目录也是同一个拼法（`name:"--dsw-alias-bg-base"`、`cssVariable:"--dsw-alias-bg-base"`，`dsh-client-ui-theme/lib/client.js:1132-1138`）。
- **`MOM_TOKENS` 那 25 个键在 shipped alias 调色板里全都有**
  （`dsh-client-ui-theme/lib/client.js:1053`，`design_platform_css_default` 那段）。机械比对过：
  25/25 都在，0 个缺。（其中 8 个另外还进了 `BUILTIN_INSPECT_TOKENS`。）
  token 名*拼错*的话 `overrideTokens` 是抓不住的 —— `validateOverrides` 只查形状 ——
  所以这一项值得查，而它过了。
- `source` 用的确实是包 id（`dsh-mom-ui/lib/client.js:477` 用的 `PLUGIN_ID`），门面文档也
  正是指定这么用的（`dsh-client-ui-theme/lib/types/client/index.d.ts:169-171`）。

## 7. `ctx.sessions.list` —— **形状原来查错了，已改正**

> ⚠️ 这一节早先写着快照里有 `current`。**那是错的**，而且代价不小：代码照着它写、
> `test/smoke.mjs` 的假快照也照着它捏，于是 `state.current` 永远是 `undefined`，
> **暖色主题和所有 root 层界面（侧栏品牌、背景人物、设置行）永远不会生效**，
> 而整套测试依然是绿的——因为假快照里那个 `current` 是测试自己造出来的。

- 真正的初始化在 `dsh-api-session-controller/lib/client.js:3166-3171`：
  `createSnapshotStore({ ids: [], byId: {}, phase: "pending", projectionsBySession: {} })`
  —— 在 `:3192` 发布成客户端服务（`rootCtx.reflect.provide("sessions", this, void 0)`）。
- 所以**快照的形状是 `{ids, byId, phase, projectionsBySession}`，没有 `current`**。
  组装处在 `:2956-2967`。`byId[id]` 每行是
  `{id, displayTitle, running, retainedBy, blank, updatedAt, projectionValues, cwd}`
  （在浏览器里实测过：`Object.keys(getSnapshot())` 就是那四个）。
- `createSnapshotStore` 返回 `{getSnapshot, subscribe, update, set}`，所以 `.getSnapshot()`
  和 `.subscribe(fn)` 都在。
- **要读「现在正在看的那个会话」，用 `retainedBy.mainView`。** shipped 的 agent-preset
  就是这么找的：`dsh-client-ui-agent-preset/lib/client.js:1674`
  （`Object.values(ctx.sessions.list.getSnapshot().byId).find((s) => s.blank && (s.retainedBy.mainView ?? 0) > 0)`），
  同文件 `:445`、`:1566`、`:1594` 也是这个判据。
  `dsh-mom-ui/lib/client.js` 的 `onScreenSession()` 现在走的就是这条路。
- `agentPreset` 在 `SessionProjectionMap` 里的类型是 `string | null`。
- **每行的 `projectionValues?.agentPreset` 这个读法本身没错**，shipped 的标签也是这么读的
  （`dsh-client-ui-agent-preset/lib/client.js:359-362` 的 `AgentPresetLabel`：
  `state.byId[sessionId]?.projectionValues?.agentPreset`）。错的只是**用哪个 id 去索引**。
- 拿来判断的那个值 `'mom'` 也没错：预设的 id **就是**它的目录名，而 `install.sh` 复制到
  `$DSH_HOME/.agent-presets/mom`。`PRESET_ID = 'mom'` 在 `dsh-mom-ui/lib/client.js`。✓

## 8. `ctx.locale.register(NS, {zh, en})` —— **对上了**

- `register(ns, localeOrDicts, dict)` 既接受"单个 locale id + 字典"，也接受
  `{locale: dictionary}` 这种对象 —— `dsh-client-locale/lib/client.js:1256-1258`。
- **语言键真的是 `zh` / `en`**，不是 `zh-CN`：`const LOCALE_IDS = ["zh","en"]`
  （`dsh-client-locale/lib/client.js:811-812`），接受的 id 模式是
  `LOCALE_ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u`（`:810`），所以两种短写法都能过校验。
- 它返回一个 disposer（`dsh-client-locale/lib/client.js:1270-1281`），所以在
  `dsh-mom-ui/lib/client.js:464` 用 `ctx.effect` 包起来是对的。
- `t` 的绑定走的是**注册时**那个 `locale` 选项，不是自动来的 ——
  `dsh-client-ui-renderer/lib/client.js:602-606` → `localeSeat(face, entry.locale)` →
  `face.bind(ns)`（`dsh-client-locale/lib/client.js:1283-1292`）。所以 `props.t` 有没有，
  **取决于**它的 `ctx.slots.register({locale})` 有没有点名一个命名空间。上面 §5 已经核过：
  插件恰好只在读它的地方声明了它。
- `ctx.locale` / `ctx.theme` 确实都是可注入的服务名：`dsh-client-locale/lib/client.js:1378`
  （`ctx.provide("locale", locale)`）、`dsh-client-ui-theme/lib/client.js:1472`（`ctx.provide("theme", theme)`）。

## 9. 投影 —— **对上了，只有"最后已完成的轮"这个说法不成立**

| 说法 | 结论 | 证据 |
| --- | --- | --- |
| `agentPreset` 客户端可见（有 wire 视图，也在 `SessionProjectionMap` 里） | 对上了 | `dsh-agent-presets/lib/index.js:1071-1081`（`wire:{viewSchema: agentPresetSchema, view:(state)=>state}`）；`dsh-agent-presets/lib/types/types.d.ts:72-74` |
| `turnOutline` 客户端可见 | 对上了 | `dsh-session-turn-outline/lib/index.js:137-140`（`wire:{viewSchema: turnOutlineEntriesSchema, view:(state)=>state.turns}`）；`dsh-session-turn-outline/lib/types/types.d.ts:40-43` |
| `turnOutline` 的视图给的是一组轮次条目 | 对上了 | 同上，另加 `turnOutlineEntriesSchema = z.array(z.object({turn:int≥0, seq, prompt, response}).strict())` 在 `:50-54` |
| `turn` 是单调递增的 | 对上了 | `superRefine` 要求严格递增（`:55-67`），fold 会拒掉不递增的 `turn/start`（`:84-87`），类型文档里也写了 "strictly increasing by turn"（`lib/types/types.d.ts:33`） |
| **最后一条就是最后"已完成"的轮** | **不成立** | `turnOutline` 是在 `turn/start` 追加的，不是 `turn/end`：`dsh-session-turn-outline/lib/index.js:84-96` —— `case "turn/start": … return { turns: [...state.turns, {turn: event.data.turn, seq: event.seq, prompt:"", response:""}], draft:"" }`。state 文档把配套那个字段叫"the OPEN turn's draft"（`lib/types/types.d.ts:34-36`） |
| `turnBoundary` 是 host 专属（没有 `wire`） | 对上了 | `dsh-agent-loop/lib/index.js:1300-1346` —— 定义里只有 `key/stateVersion/stateSchema/init/apply`，**没有 `wire` 键**；它也不在 `SessionProjectionMap` 里（只在 `dsh-agent-loop/lib/types/index.d.ts:14-15` 被提到） |
| 没有 `wire` 视图的单元会被 seam 跳过 | 对上了 | `dsh-session-projection/lib/index.js:147` —— `if (registration.def.wire === void 0) continue;`（另外还有 `:170`、`:249`、`:340`） |
| 客户端仍然可以*订阅*一个没有 wire 的键，不会抛 | 对上了 | `faceOf` 是 "Always defined — absence is an `undefined` snapshot, never a missing face"（`dsh-api-session-controller/lib/types/client/sessions/projection-store.js:19-27`）—— 这正是插件以前读 `turnBoundary` 会永远拿到 `undefined` 的原因 |
| `turnOutline` 在 web profile 里挂了 | 对上了 | `dsh-web-app/cordis.patch.yml:91-92`（`- id: session-turn-outline / name: '@deepseek-ai/dsh-session-turn-outline'`） |
| `useProjection(key, selector)` 确实能这么用 | 对上了 | `dsh-client-ui-renderer/lib/client.js:233-243`（`keyedObservableHook`：`(key, selector, equal) => observableHook(source(key) ?? absentSource)(selector ?? identity, equal)`），shipped 的调用点也在用 selector 形式，比如 `dsh-client-ui-conversation/lib/client.js:15815`（`useProjection("plan", (plan) => …)`） |

### 问题 —— 轮次跑着的时候，横幅超前一轮

`dsh-mom-ui/lib/client.js:267-269` 读的是 `turns.at(-1).turn`，`:303` 渲染的是
`pickAffirmation(sessionId, turn + 1)`。而 host 注入用的是 `pickAffirmation(affirmations, agent.id, turn)`，
也就是**当前**这一轮（`dsh-mom-mode/index.js:168-187`、`:174`）。`turnOutline` 在 `turn/start`
落日志的那一刻就多了一条（`dsh-session-turn-outline/lib/index.js:84-96`），所以：

| 时刻 | `turns.at(-1).turn` | 横幅显示 | host 该轮注入的 | 同步吗？ |
| --- | --- | --- | --- | --- |
| 空闲，正在写第 T 轮 | T−1 | `AFF(T)` | T 一开始就是 `AFF(T)` | ✅ |
| 第 T 轮跑着 | **T** | `AFF(T+1)` | `AFF(T)` | ❌ 超前一轮 |
| 第 T 轮 `turn/end` 之后 | T | `AFF(T+1)` | T+1 一开始就是 `AFF(T+1)` | ✅ |

输入框那个 dock 在跑的时候是活的 —— `renderSlot("conversation.input.dock", zone)` 只要
`zone !== undefined` 就会渲染（`dsh-client-ui-conversation/lib/client.js:14869-14872`、`:14927`），
而 `zone` 只要有 session 和输入状态就行 —— 所以每一轮的全程，屏幕上挂的都是那句错的话。
`dsh-mom-ui/lib/client.js:255-269` 那段文档注释（"The last COMMITTED
turn"、"They stay in step"）因此是错的；`:295-300` 那句 `turn === 0` 的注释也只对了一半：
`turn === 0` 的意思是*还没有任何轮开始*，不是*还没有已完成的轮*。
真要算"最后已完成的轮"，得靠 `turn/end` 那个边界 —— 而既然 `turnBoundary` 是 host 专属的，
老实说只有两条路：要么新开一个带 wire 的投影，要么在客户端自己推"开着 vs 已完成"
（用 outline 里 `response`/`draft` 的区分，或者 session 自己的 running 标志），而不是假定
outline 最后一条就是已完成的。

## 10. `exports["./client"]` + `dsh.client.platform: 'web'` —— **对上了**

| 说法 | 结论 | 证据 |
| --- | --- | --- |
| 发现机制扫的是启用的 Loader entry | 对上了 | `dsh-client-modules/lib/index.js:775-781` —— `for (const entry of this.ctx.loader.entries()) { if (entry.options.name !== entryName \|\| entry.fiber === void 0 \|\| entry.disabled) continue; … }`；构造函数从所有 entry 播种脏集合（`:475`） |
| 判断的依据是：包声明了 `dsh.client`，且 `platform` 必须是 `'web'` | 对上了 | `dsh-client-modules/lib/index.js:648-653` —— `const decl = parseDshClient(packageName, dsh?.client); if (decl === void 0 \|\| decl.platform !== "web") { …return null }`；`parseDshClient` 要求 `platform` 是字符串，把 `inject`/`external`/`immediately` 当可选（`:140-154`）—— 所以 `dsh-mom-ui` 那个光秃秃的 `{"platform":"web"}` 是合法声明 |
| 包是按 entry 的 `name` 往上找最近的 `package.json` 解析出来的 | 对上了 | `dsh-client-modules/lib/index.js:679-726` —— `locatePkgJson`（类路径的名字会把 `expectedPackageName` 设成 `undefined`；`nearestPackage(moduleUrl, …)` 沿 `dirname` 往上找 `package.json`） |
| 绝对**文件**路径才是受支持的形式 | 对上了 | `:681-682`（`isAbsolute(loaderName)` → 类路径），以及 `:668-678` 的文档；`install.sh:36-39` 里 `PLUGIN_ENTRY="$REPO/dsh-mom-ui/lib/index.js"`。给目录路径会失败：它会走 `internal.resolveSync`（`:699-707`），而 Node 的 ESM 不接目录导入 —— 插件自己那句注释写的是 FILE 路径，写对了 |
| 被服务的文件就是 `exports["./client"]` 指的那个 | 对上了 | `dsh-client-modules/lib/index.js:654-659` —— `clientExportOf` 接受字符串或一层 `{default}` 形式（`:156-166`）；`clientPath: join(dirname(pkgPath), clientRel)`；`dsh-mom-ui/package.json:10` 里的字符串形式（`"./client": "./lib/client.js"`）是被接受的。声明了 `dsh.client` 却没有 `./client` 导出会抛 `declares dsh.client but exports no "./client" bundle`（`:655`） |
| bundle 是**原样**服务的，不假定有构建步骤 | 对上了，但有一处精度要补 | 字节是直接从磁盘读的（`:750-764`，`readFileSync(clientPath)`），但发出去的内容并不是逐字节相同：`comboSource` 会剥掉结尾的 `//# sourceURL=` / `//# sourceMappingURL=` trailer 并补一个 `;`（`:207-218`、`:292`），`comboScript` 再补一个合成的绝对 `//# sourceMappingURL=<combo map url>`（`:219-222`）。对这个文件（没有 trailer）来说，差别就只有补的那个 `;` 和那行合成 map 注释 |
| 没有来源 / sourcemap 校验 | 对上了 | `readSourceMapSnapshot`（`:766-773`）读 `${clientPath}.map`；**ENOENT ⇒ `undefined`**，格式坏 ⇒ `logger.warn` + `undefined`，而缺 map 只会生成一张带 `sourcesContent` 的恒等 map（`:266-276`、`:284`）。没有任何地方会拒绝一个未打包、手写、没有 map 的 `.js`。`dsh-mom-ui` 的 `files` 列表里没 ship `.map`，文件末尾也没有 `sourceMappingURL` 行 —— 一致 |
| 每个包只能有一个活跃 source | 对上了（而且相关，见问题三） | `:813-819` —— `if (sources.length > 1) throw new Error(\`client-modules: package ${packageName} resolves from multiple active Loader sources: …; remove one entry\`)` |

---

## 问题清单

### 问题一 —— 每一轮跑着的时候，横幅都超前一轮
`dsh-mom-ui/lib/client.js:255-269, 303` 假定 `turnOutline` 最后一条就是最后**已完成**的轮。
其实它是最后**开始**的轮（`dsh-session-turn-outline/lib/index.js:84-96`）。
*现象：* 轮次跑着的时候，输入框上方的横幅预览的是*下一*轮那句话，于是横幅和插件实际注入的
那句话，在整个运行期间都是岔开的；插件那个最要紧的"两边同一句"，只在两轮之间的空档里成立。

### 问题二 —— 两个 Tooltip 都不弹
`dsh-mom-ui/lib/client.js:280`（徽章）和 `:325-326`（抱抱按钮）把 `P.Tag` / `P.Button` 包进了
`P.Tooltip`。可 `Tooltip` 只能量一个接得住 ref 的子元素
（`index-BKQ_L1z6.js:61`：`if(B===null)return;` 然后 `g!==null && <span role="tooltip">`），
而这两个在 React 18.3.1 下都是普通函数组件（不是 `forwardRef`）。
*现象：* hover 也好、focus 也好，都不出气泡；`props.t('badgeTip')` / `props.t('hugTip')` 是活的
字符串，但从来没露过面。修法：外面包一个宿主 `<button>`/`<span>`（shipped 那 38 处都是这个形状），
或者干脆别用 Tooltip。

### 问题三 —— 那个「只留一个实例」的检查，防的是错的失败（注释被推翻；机制也说重了）
`dsh-mom-ui/lib/client.js:417-438` 声称两条安装路径都活着的时候，"Both live instances
would register the SAME slot ids at the same priority, and the slot registry THROWS … which would take
the whole web client down"，而那个令牌能把这事降级成一条警告。这里有两个毛病：
1. 同一个包的两个浏览器实例**不可能存在**：模块表和 boot graph 都是按包名索引的
   （`dsh-client-modules/lib/index.js:825` 的 `this.table.set(packageName, …)`、
   `:329-337` 的 `graphRow(id=packageName, …)`），而且 `parseBootManifest` 会拒掉重复的 entry id
   （`dsh-client-modules/lib/client.js:85-86`）。所以那道检查要防的插槽冲突，在那两条
   文档化的路径下**根本走不到**。
2. 真正走得到的那个失败，发生得更早，而且在**host** 那边：两条活的 Loader 行指向同一个包 ——
   `install.sh` 写的 `id: mom-ui → <abs path>`，加上 bundle patch 里的
   `id: mom-ui-bundle → 'dsh-mom-ui'` —— 会让 `reconcilePackage` 抛
   `package dsh-mom-ui resolves from multiple active Loader sources: …; remove one entry`
   （`dsh-client-modules/lib/index.js:813-819`），这个错会被收进 `ClientPackageCompositionError`，
   让 `clientModules` 服务直接失败（`:477-479`）。于是 `webserver/index-inject` 监听器压根没注册
   （`:489-491`），`window.__DSH_BOOT__` 永远不会发出去，页面起不来。浏览器侧那个令牌拦不住这事，
   只有"只留一行"能拦。插件自己的 `cordis.patch.yml` 头部本来就写着 "Prefer ONE route"，
   所以代码注释把那道检查说得太神了。令牌也不是*完全没用*（它还能覆盖"同一个包用两个不同名字"
   的情况，还有 HMR 重新注册那个窗口），但它不是注释描述的那个保护。

## 小毛病

1. `--dsh-composer-max-width` 在 DSH 里哪儿都没有（grep：`@deepseek-ai/` 下 0 命中）。
   所以 `var(--dsh-composer-max-width,860px)`（`dsh-mom-ui/lib/client.js:116`、`:127`）永远
   走 860px 那个兜底。旁边那个 `--dsh-content-font-size-secondary` **是**真的
   （`dsh-client-ui-theme/lib/client.js:1059` 定义了它）。
2. `Button` 有个 `icon` prop，会把图形包进 `ro.icon`
   （`index-BKQ_L1z6.js:56`：`{icon != null && <span className={ro.icon}>{icon}</span>}{children}`）；
   而 `MomHugAction` 是把图形当 child 传的（`dsh-mom-ui/lib/client.js:335`），所以没吃到
   按钮自带的图标间距。
3. `Tag` 渲染出来的是个不可聚焦的 `<span>`；拿它当 `Tooltip` 的触发器（问题二另说），
   意味着徽章那个气泡没有键盘能到达的触发点。
4. `Switch` 只给了 `label`（→ `aria-label`）；可见的标题和提示在隔壁一个 `<div>` 里
   （`dsh-mom-ui/lib/client.js:400-414`），所以控件和它的说明在读屏软件那边也没关联起来。
5. 六个 list 注册都用了 `order: 40`（`:497-502`）—— 无害，但相对于 shipped 里别的组件
   （队列 dock 是 `order: 20`，`dsh-client-ui-conversation/lib/client.js:14369-14372`）
   的次序意图没写出来。
6. `dsh.client` 没声明 `inject`（brand-official 声明了
   `inject:["@deepseek-ai/dsh-client-ui-renderer","@deepseek-ai/dsh-client-ui-sidebar"]`，
   `dsh-client-ui-brand-official/package.json:26-31`）。这里不是非有不可 —— 每个界面都由
   `ctx.slots.inject` 把关，而它会等声明 —— 但这意味着 mom 这个 bundle 有可能在 renderer 那行
   之前就物化；之所以安全，只是因为它在模块作用域里除了 `react` / primitives 那两个种子词
   什么都没碰。
7. 头部注释那段作用域总结（"session-scoped slots get `useProjection` … root-scoped slots
   get `useSessions`"，`dsh-mom-ui/lib/client.js:14-17`）不够准：根那套 hook 会被每种作用域继承，
   所以 `useSessions` *两边*都到得了；只有 `useProjection` 是 session 专属。注释自己那个
   脚注（"GlobalStandardProps reaches EVERY occupant, root included"）倒是说对了。

## 核对过、不用动的部分

`package.json` 的 `exports["./client"]` + `dsh.client.platform:'web'` + `dsh.bundle.patch`（这是个
真约定 —— 有 6 个 shipped bundle 声明了它，比如 `dsh-sdk-minimal/package.json`、
`dsh-web-app/package.json`）；host 那边那个空壳 `export function apply() {}`（形状跟
`dsh-client-ui-brand-official/lib/index.js:6-7` 等价）；`sidebar.brand.mark`/`sidebar.brand.name` 上
`priority:-1` 的盖法，配合自己渲染的官方样子；单 disposer 的 `inject` 回调；`locale` 只在读 `t`
的地方声明；25 个主题 token 全在；`'mom'` 这个预设 id；以及哪四个走 session、哪四个走 root，配对都是对的。
