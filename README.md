# 妈妈模式 for DeepSeek Harness

> **English, briefly.** A DeepSeek Harness **agent preset** with a warm, plain-spoken
> persona, plus its browser half: warm palette, a badge, a Hug button, and a
> background figure — all switched on **per session** by selecting the preset, so
> every other session is untouched.
>
> ```
> plugin_manager  action: install_bundle   target: <absolute path, or github:owner/repo>
> ```
> Then **restart the host** and refresh the browser page once. Select 「妈妈模式」/
> "Mom mode" in the new-session picker.
>
> **Naming, because it is four words for one thing:** the preset id is `mom`, its
> display name is 妈妈模式 (mom mode), the bundle package is `dsh-mom-preset`, and
> the browser half is the `dsh-mom-ui` workspace inside it. One install unit.
>
> **What it changes in your UI:** the sidebar mark/wordmark, session badges, a Hug
> action beside each reply, a settings row, the warm palette, two rewritten strings
> (`深度求索中` → `❤ 妈妈在想`, and the composer placeholder), and the background figure.
> The strings and the mark **shadow** shipped components, which is why the browser
> half is gated per session and reversible. Requires DSH `0.2.x` (see 支持范围).
>
> **Verify it yourself:** `pnpm test` → 159 + 70 checks, no dependencies beyond
> Node. It asserts the preset's composition, the policy text, the per-session
> gating, the art route, and the shipped art's geometry.
>
> The rest of this file is Chinese, and it is the detailed one; `docs/` holds the
> reply-style table and the historical UI audit.

说白了就是 **一个 agent 预设 + 两个半边插件**。你选「妈妈模式」开会话呢，它就有妈妈人设、一段贯穿全程的行为准则（先接住人再处理事、别拿否定词开头、把失败说小），顺带一整套按会话开关的暖色 Web UI。别的会话呀，一点都不受影响。

## 它到底改了你界面的什么（装之前先看这段）

端上一句话:**它不止加东西，它还盖住了两个官方组件和两句官方文案。** 这身暖色是好事还是冒犯，取决于你想要什么，所以清单摆在这儿：

| 改的东西 | 性质 | 范围 |
|---|---|---|
| 妈妈人设 + 一段行为准则 | **新增**（系统提示词里多一段） | 只在 mom 会话 |
| 暖色配色（25 个 `--dsw-alias-*` token） | **覆盖**主题 token | 只在 mom 会话，退出即还原 |
| 侧栏标记 + 字标 | **盖住**官方鲸鱼和字标（`priority: -1`） | 非 mom 会话显示官方原样 |
| 会话徽章、「抱抱」按钮、设置行、空会话大心心 | **新增**（其中空会话那个座位 shipped 本来就是空的） | 只在 mom 会话 |
| `深度求索中` → `❤ 妈妈在想` | **改已经渲染出来的文本**（没有正规接口，只能改 DOM） | 只在 mom 会话 |
| 输入框 placeholder | 同上，三处载体一起改（可见文本 / `data-placeholder` / `aria-label`） | 只在 mom 会话，且只认出厂整句 |
| 背景人物（妈妈版 DS 娘） | **新增**，一条 `GET /mom/art.png` 路由 + 覆盖层 | 只在 mom 会话，设置里可关 |

最后两行是**没有正规接口**才退到 DOM 的，代价是:官方哪天改了那两句的字，改写就不再命中（那时它**什么都不会做**，不会改错）。这也是为什么它按会话门控、而且离开 mom 会话要能**改回去**。

## 为什么要做成预设 + 插件，而不是一个插件

你想啊，`dsh-mom-cheer` 那种装法（`dsh plugin add`）会把插件塞进 profile 的 bundle 层，结果就是**所有会话**都被注入。而预设呢，是**按会话**挑 Agent 装配的唯一机制。所以就这么分了：

- **agent 面** → 只由 `mom` 预设加载：它作为**预设声明里的一个子行**被挂载，不进 profile 层栈，所以别的会话连它的影子都看不到。bundle 本身是 profile 层（那是 patch 的来源），但**插件不是**。
- **Web UI 面** → 客户端插件没有"按预设装配"这个能力呀，只能全局装。所以它**每个界面都自己去读当前会话的 `agentPreset`**，不是 `mom` 就渲染 `null`——opt-in 就是这样保住的。

## 两层：人设 + 行为准则

| 层 | 落点 | 作用 |
|---|---|---|
| 1 · 人设 | 预设的 `persona.prefix` | 妈妈身份与语气基调，取代 standard 的通用身份 |
| 2 · 行为准则 | `ctx.systemPrompt.section('mom:policy', order 1)` | 先接住人再处理事、别用否定式开头、把失败说小、话说得像人话 |

**第 2 层最后那段是道保险**，写的是「有件事妈妈不做：不拣好听的哄他」，真出岔子照样说明白。嗯，这条不能去——少了它呀，暖就退化成谄媚了，模型开始瞒报错误。

> **曾经还有第三层：每轮塞一句轮换的"鼓励语"（「全肯定」那套），已经整个删掉了。** 它做的是：读用户原话做关键词匹配，按情绪挑一个短语池（烦躁→`妈妈加油`，道谢→`谢谢妈妈`），再用 FNV-1a 哈希按 (会话, 轮次) 确定性地挑一句，作为一条 user 消息追加进去。删掉的原因：句子是**罐头**的，会话一长就开始重复；而且模型会**照着学**那个腔调，把它变成自己的收尾（"我在这儿呢，你说。"）——那种回复什么问题都没回答。想知道当时长什么样，看 [`docs/ui-audit.md`](docs/ui-audit.md) 顶上的存档说明。
>
> 一起删掉的还有为它服务的一整套：情绪表、关键词分类器、FNV-1a 轮换、notice summary 的长度约束，以及**浏览器里那份为了预测"会插哪句"而存在的情绪表副本**（连带那条贴输入框的横幅）。现在这个插件只做一件事：注册那一段 prompt。

## 目录

```
mom-mode.js            agent 面插件（零 import），也是本包的根入口（exports["."]）
dsh-mom-ui/            Web UI 插件（手写 bundle，没有构建步骤）——子包，但不是第二份交付物
  lib/index.js         host 半：一行空 apply（客户端插件必须作为 Loader entry 存在）
  lib/client.js        主题 + 6 个插槽界面（含内嵌的背景人物）
package.json           bundle 声明：name + dsh.bundle.patch -> ./cordis.patch.yml；workspaces -> dsh-mom-ui
pnpm-workspace.yaml    把 dsh-mom-ui 声明成 workspace：边界写明，但不给它第二条安装路径
cordis.patch.yml       唯一的 patch：插入预设声明 + 客户端行（composition 就在里面）
docs/                  ① 回复风格控制表 ② UI 审计留档（历史，不是现行问题清单）
  reply-style.md       改 agent 说话方式先看它
  ui-audit.md          当初 UI 那一轮的审计证据，正文别当现状读
ds_mom.png             **素材唯一一份**：host 半边按 /mom/art.png 直接发它，client 里没有任何图片字节
test/smoke.mjs         159 项：逻辑 + 语气词表守卫 + 内联成品的几何契约
test/bundle.mjs        45 项：bundle 结构 + 名字解析（相对路径存在性、裸包名）
                        + policy 是否随声明下发
                        + 包边界契约（浏览器半边不得被独立安装/按包名引用）
                        + 与内置 standard 的漂移报告（只报不判）
```

## 一个关键设计决策

**侧栏品牌用 `priority: -1` 明着盖住别人的。**
`sidebar.brand.mark` 是个 `single` 插槽，`priority` 默认是 0，而 `brand-official` 正好就是拿默认值注册的——同优先级会**直接抛错**，整个客户端插件就挂了。测试里专门留了一条盯着这件事。

## 八个界面（默认注册七个）

| 插槽 | 类型 | 界面 |
|---|---|---|
| `conversation.session.header.utilities` | list/session | 「妈妈模式」徽章（💗 + 字） |
| `conversation.hero.brand.mark` | **single**/root | 空会话标题前的大心心（这个座位 shipped 是空的，纯新增、盖不到东西） |
| `conversation.chat.assistant-actions` | list/session | 每条回复旁边的「抱抱」 |
| `settings.general.item` | list/root | 装饰开关（存在浏览器本地） |
| `sidebar.brand.mark` | **single**/root | 妈妈标记（不是 mom 会话就显示官方鲸鱼） |
| `sidebar.brand.name` | **single**/root | 妈妈字标（同上） |
| `shell.overlay` | list/root | **背景人物：妈妈版 DS 娘，贴着侧边栏站着** |
| `shell.overlay` | list/root | 飘落爱心，**默认关**（`SURFACES.ambientOverlay`）——想要满屏飘心就把它改成 `true` |

**「深度求索中」那句被换掉了。** 它属于 shipped 的 `dsh-client-ui-chat`，而且**没有正规的改法**，三条路都堵死：

| 路 | 为什么不行 |
|---|---|
| 重新注册 `chat` 词典 | `register` 实现里有 `if (locales.has(localeKey(locale))) throw` —— **单占位**，`(ns, locale)` 只有一个主人 |
| 用 `ui-chat` 的 Config | schema 里只有 `transcriptView` / `performanceUsage` / `linkOpening`，**没有文案字段** |
| 覆盖渲染它的插槽 | **它根本不是插槽**——`RunningStatus` 由 chat 视图自己的组件树渲染 |

所以退到 DOM：`[data-chat-running]` 这个 data 属性是稳定钩子，只替换**前缀**，因此「，用时 3 秒」那一半**原样保留**（CSS 换字做不到这点，会把秒数一起吃掉）。整套改写只在 mom 会话里生效。文案在 `momUi` 的 `runningLabel`（zh/en 各一份）。

⚠️ **要改两份，不是一份。** `TextShimmer` 激活时把同一句话渲染**两次**：保留的那份是**文本节点**，而跑马灯（装饰层）那份**没有文本节点**——它把文字放进 `data-shimmer-text` **属性**，靠 CSS `content: attr(data-shimmer-text)` 画出来。只走文本节点的话，标签改好了、**跑马灯还在说「深度求索中」**（这个漏过一次）。所以改写要同时扫文本节点和这个属性。`test/smoke.mjs` 两种形状各盯一条。

主题走的是 `ctx.theme.overrideTokens()`（25 个 `--dsw-alias-*`，light 和 dark 各一套值），订阅 `ctx.sessions.list` 来切换——**不动注册表、不写用户偏好**，一离开 mom 会话就还原；**选中「妈妈模式」的那一刻就生效**，不用等第一轮对话。

> ⚠️ **判断"现在看的是哪个会话"必须用 `retainedBy.mainView`，不能用 `state.current`。**
> 会话列表快照的形状是 `{ids, byId, phase, projectionsBySession}`——**根本没有 `current` 这个字段**
> （`dsh-api-session-controller/lib/client.js:3166`）。当初那份审计文档写错了形状，代码和测试的假快照都跟着错，
> 于是 `state.current` 恒为 `undefined`：**暖色主题、侧栏品牌、背景人物、设置行全都永远不生效**，
> 而测试照样全绿——因为那个 `current` 是测试自己捏出来的。现在门闸走 `onScreenSession()`，
> 和 shipped 的 `dsh-client-ui-agent-preset` 同一个判据；`test/smoke.mjs` 的假快照也照着**生产形状**造，
> 还有一条专门盯着"快照里不许再冒出 `current`"。

## 调语气（最常改的地方）

**行为准则的正文，在 `cordis.patch.yml` 里**（预设声明的 `mom-mode.config.policy`），不在 JS 里：

```yaml
- id: mom-mode
  config:
    policy: |-        # ← 妈妈的行为准则正文，改这里
      ...
```

改完**重启 host**，再新开一个会话就生效了。（不用重装：bundle 是符号链接，patch 原地读仓库。）

> 更早的版本里这套是「roster 扫 `~/.dsh/.agent-presets/` 目录」的，装完刷新页面就能用。现在不扫了：roster 由**声明**构成，自定义预设就是 patch 里的一行 `@deepseek-ai/dsh-agent-preset`，它的 `config.plugins` 就是那份 composition。所以预设不见了，多半是**没重启 host**。

插件里的 `DEFAULT_POLICY` 只是**这一行缺失时的兜底**，写得短，语气一样，别拿它来调。

写这段文字要注意哈：**它是给模型读的，会直接影响模型怎么说话。** 要用妈妈自己会说的话来写——常用语、具体例子——别写成"底线／绝不可以／必须"那种清单。清单式的口气会顺着提示词渗进回复里，把本来要温暖的东西写得更硬。`test/smoke.mjs` 里有一条专门拦这类词（`门控/闸/底线/绝不可以/禁止/必须/契约…`）。

> **想让某个说法消失，就别把那个说法本身写进 `policy`。** policy 里只放**正面说法**（"问他有什么想做的"），被禁掉的原句留给 [`docs/reply-style.md`](docs/reply-style.md)——那张表模型读不到。已经踩过两次：`契约` 在禁用词表里，写进去 smoke 当场红；`说一声就行` 这类**求指示的收尾**则由 `SERVILE_VOCABULARY` 盯着。提示词里出现的每个例句都会反过来影响模型怎么说话，负面例句也一样。

> **收尾不许把球推回去。** 三种坏写法是同一件事——求指示（"说一声就行"）、反问要不要做（"要我一起做掉吗"）、**以及无意义地反问要做什么**（"你现在想让我看点啥？"）。policy 现在写的是**动作**，不是例句："一件事说完就说完了，别在末尾再接一句把话头递回去的问句——那等于这轮什么都没答，他还得重新说一遍想干什么。写完把末尾那句删掉试试：这轮少没少东西？没少，那句就是多余的。"**唯一准许的问法是手上有几条真实的路、且只有他能定的那种**；"你想先弄哪块"不算——他本来就知道。对照表在 [`docs/reply-style.md`](docs/reply-style.md) §3.6。
>
> ⚠️ **这条改过两次，原因值得记。** 第一版把禁掉的框架写成例句，模型就把它当**黑名单**满足：`session-4416bf36` 的推理原话是「别用"要不要我……"结尾」，然后它换个说法把同一件事说了出来（"你就直接说想干啥吧"）。所以现在 policy 里**一个可引用的坏例句都没有**，只有动作描述和一个模型自己跑得了的判断。"讨指示"这类例句只留在 [`docs/reply-style.md`](docs/reply-style.md) 的表里——那张表模型读不到。

> **也不许空转。** 没有明确目标、只是在等用户开口时，很容易冒出一句"你直接说，我先听着"——它回答了什么？没有。提出了什么？没有。只是拿一句话把这一轮填满了，**看着像陪着，其实什么都没给**。判断标准很土但很好用：**把这句话删掉，这轮回复还剩什么？** 什么都不剩，那它就是空转。policy 里写的是"实在没话可说，就说点实在的：刚查到什么、下一步打算怎么弄"。对照表在 [`docs/reply-style.md`](docs/reply-style.md) §3.7。
>
> 这条还顺带解决了一个老问题：以前每轮会注入一句旁白（"我在这儿呢，你说。"），模型天天看着就照着学。旁白整个删掉之后，这个腔调的来源没了。

> **回复要"把话讲完整"，不许压成词组。** 这是**方向反过一次**的地方：上一版 policy 写的是「句子短一点」，`reply-style.md` 开篇也写着「短句、碎念」，结果回复长成一串光杆动词——「查源码、改文件、跑命令、看日志、盯风险」，看着利索，没一句是人话。现在要求反过来：单动词（"查"）和合成词（"验证""排查"）都**展开成整句**（"我替你看看"／"我实际跑一遍，看看结果对不对"）。对照表在 [`docs/reply-style.md`](docs/reply-style.md) §2.5。
>
> ℹ️ 曾经还加过一条「话多一点不碍事」，**已经撤回**：它和 §3.7 的「不许空转」互相拉扯，模型只能在"话多"和"别凑数"之间猜。现在留下的只有**关于用词**的要求，**长短不再规定**。

其余能调的地方：`dsh-mom-ui/lib/client.js` 顶部的 `SURFACES`（客户端插件拿不到 config，所以界面开关写在代码里）。

### 两处只能改文本的文案

有些字**不属于这个插件**，也没法用正规接口覆盖，只能在 mom 会话里把已经渲染出来的文本换掉。两条都是同一个套路，`client.js` 里各有一个 `ctx.effect`：

| 字 | 归谁 | 为什么不能正规覆盖 |
|---|---|---|
| `深度求索中`（思考中） | `dsh-client-ui-chat` | 在 `chat` 这个 locale 命名空间里，而注册表**每个 (命名空间, 语言) 只能一个占用者**——`register` 会直接抛 `locale namespace "chat" already has locale "zh"`；它的 Config 没有文案字段；`RunningStatus` 由 chat 视图自己渲染，不是插槽占用者 |
| `发消息或创建任务, / 调用指令, @ 文件或对话`（输入框 placeholder） | `dsh-client-ui-conversation` | `InputBar` 从它自己的命名空间取；composer bar 是 `single` 座位，没有占用者能顶掉它；Config 同样没有文案字段 |

所以两条都只剩**改文本节点**这一根杠杆，靠 `[data-chat-running]` / `[data-composer-placeholder]` 这类稳定 data 属性定位，外加一个 `MutationObserver` 盯着。几条要记住的：

- **新会话那句也要一起改。** 空会话里 composer 走的是 `variant: 'hero'`，`ConversationContent` 传的是 `placeholder.hero`（`描述你想要构建的内容, …`），**不是** `placeholder.default`。只改后者，新会话的输入框就还是出厂那句——这张表里两条都得在。
- **只换前半句。** 引导语换成 `想要妈妈做什么`，后面 `, / 调用指令, @ 文件或对话` 那一截是**从 host 原句里切下来的**，不是在这儿重打一遍——`/` 和 `@` 的说法归 host 管。
- **比的是整句，不是前缀。** 只有和出厂整句一模一样时才换，所以那些**情境 placeholder**（会话不可用 / plan / 选工作区 / 插话提示）全都原样留着；它们尾巴一样、句子不一样。
- **三处都得改。** 可见的 `[data-composer-placeholder]` 文本节点、编辑区的 `data-placeholder`、以及它的 `aria-label`——contenteditable 没有 placeholder 属性，**那串字就是它的无障碍名**，只改前两处，读屏软件念出来的还是出厂那句。
- **改完要能改回去。** 这是**踩过的坑**：切到别的模式，placeholder 不复原。React 帮不上忙——切换会话时 host 用出厂那句重新渲染，可那**正是它上一次渲染写过的内容**，reconcile 认为没变，**一个字都不写**，所以这个插件改过的 DOM 活过了切换，妈妈的文案留在标准模式里。修法是每个载体（文本节点 / 两个属性）各自记住**改之前** host 写的是什么，离开妈妈模式时原样写回去。
  - 记住的**只能是 host 出厂那句**：只有值确实命中出厂表才记，所以 host 中途把 default 换成 hero（会话启动）时记录会跟着更新，不会留下一个过期的、复原时写回错误变体的记录。
  - 复原写回也会再触发 observer 一次；这时值已经是出厂那句、记录也已丢弃，所以**收敛，不会打转**。
  - ⚠️ **「深度求索中」那条现在还没做复原**，是同一个毛病的另一处。切换模式后思考中的标签同样会留着 `❤ 妈妈在想`，还没修。
- **思考中那条要连装饰层一起改。** `TextShimmer` 把文案放在 `data-shimmer-text` **属性**里、靠 `content: attr(...)` 画出来，只走文本节点会漏掉它——只走文本节点的时候，标签对了、跑马灯还在说「深度求索中」。
- **中英各一份。** 占位符那张表里存的是各语言的**出厂整句**，因为两种语言的引导语和尾巴都不一样。

## 人称

人称完全由**模型**在回复时按 `policy` 正文里的规则判断——插件不参与，代码侧也没有第二份称呼表。所以改这里就是唯一入口：

- 他正难受、正上火 → 叫**孩子**
- 他话里不客气、冷冰冰，或者听不出什么情绪 → 叫**宝宝**
- 其余时候 → 照平常说「你」

> 以前的「情绪注入」是另一套机制：插件在 `agent/pre-step`（**模型还没跑**的那一刻）用关键词匹配猜情绪，再注入一句短语。那套已经删了——见上面「两层」那节的说明。人称这一层不受影响，它一直是模型自己判断的。

## 背景人物

`ds_mom.png` 是妈妈版 DS 娘，也是这份素材**唯一的一份**——仓库里不再有任何派生物。要让它上屏，得解三件事：**发出去**、**渲染成对的比例**、**放在不挡字的地方**。

**1. 图必须自带 alpha。** 现在这张是（RGBA，1024×1536），作者抠好的。

> ⚠️ **换成不带 alpha 的图，人物会带一整块背景色（通常是黑或白）出现在侧栏旁边。** 以前有一条抠底流水线（从四边泛洪、近黑判据 `max(通道) <= 20`、2px 剪影模糊 + 亮度斜坡收边，专门对付"纯黑底 + 人物"这种源图）——那条流水线连同工具一起删掉了，因为它的产物是一份**派生物**，而这份设计里派生物正是要被消掉的东西。所以抠底现在得在**你这边**做完再放进仓库。
>
> 附带一个当年的实测数字，留着有用：**烤进图里的棋盘格**最难办——有人把透明图往白棋盘上一存就导出，看着像透明，其实是画上去的（两种近白色调 241–246 / 253–255 交替，而人物米色上衣只有 233，**只差 6 级**）。这种源图不要用。

**2. 图由 host 半边当文件发出去,client 里一个字节都不留。**

`ds_mom.png` 是这份素材的**唯一一份**。`dsh-mom-ui/lib/index.js`（这个包的 host 半边）用 `ctx.webServer.register({ kind: 'exact', path: '/mom/art.png', handler })` 把它发出去；`lib/client.js` 只留**一个路径**：

```js
const MOM_ART_PATH = '/mom/art.png'   // 没有 query、没有版本号
```

**换成现在这个形态，是因为要"换图自动生效"。** 这条要求连着两个决定:

- **URL 不能带缓存令牌。** `?v=<hash>` 这种写法本身就是"图变了要改代码",那还是构建步骤。所以路径是裸的，**新鲜度由服务端负责**：响应头是 `cache-control: no-store, no-cache, must-revalidate, max-age=0`，而且**故意不发 `ETag`/`Last-Modified`**——给了校验器就会换来 304，而 304 意味着浏览器继续用旧的图。
- **handler 每次请求都重新读盘**（不是启动时读一次）。所以：换掉 `ds_mom.png` → 刷新页面 → 就是新图。**不用重启 host、不用重装、不用跑任何工具。**

> 这条路由**挂在 bundle 层（profile 层）**，不是挂在预设里。预设是**按会话**挂载的，浏览器完全可能开在一个 `standard` 会话上——那种时候图会 404。所以它在没有 mom 会话时也一直开着；内容是内容不敏感的（就一张图），代价只是多一条路由。

**3. 为什么可以不裁了。** 之前那套要裁剪，是因为图片编码进 bundle 时**编码后的宽高比会喂给组件的尺寸求解**，而裁剪框的 aspect（0.454）和整幅画布（0.667）差很多，用错就把她画成 68% 大小。

改成"host 发原图 + CSS 渲染"之后这条约束换了位置，而且**现在是自洽的**：

- 组件建的那个盒子，本来就是**按图片自己的宽高比**算的（`byHeight = heightCap × W / H`，`height = width × H / W`）；
- CSS 用的是 `background-size: contain`，所以图片**正好铺满**那个盒子，没有信箱边、没有二次缩放。

于是几何变成：`W/H = 1024/1536 = 0.667`，设计宽 280 → `宽 280 × 高 420`。**和裁剪时代渲染出来的尺寸是同一个数**——因为 `ART_MAX_WIDTH` 约束的是"她"的宽度，而她在画布里的宽度占比（682/1024 = 0.666）和 `698/1024` 基本一样。所以除了画布自带的**透明边距**，视觉结果和裁剪版一致。

> ⚠️ **换素材时唯一要注意的：保持画布的宽高比。** 图片尺寸**不参与构建**，只有 `lib/client.js` 顶部那两个常量声明画布是 `1024×1536`。换一张同比例（2:3 竖图）的图，什么都不用改；换成别的比例，盒子会按图片比例重算、而常量没跟上——所以要**同时改那两个常量**。它们**不在任何缓存路径上**（`lib/client.js` 走正常的模块 rev 机制），但改完要**刷新页面**。

**代价，说准。** 图片不再进 bundle，所以 `client.js` 只有 45 KB；代价是那 1.6 MB 改成走一次 HTTP：

| | 之前（内联） | 现在（走路由） |
|---|---|---|
| `client.js` | 2449 KB（gzip 1837 KB） | **45 KB** |
| 图片 | 在其中 | 1.6 MB，`no-store` **每次都重新取** |

`no-store` 是这条功能的代价，不是疏忽——它是"换图自动生效"能成立的**唯一**方式。要省这 1.6 MB 就得允许缓存，那也就回到了"换图要改版本号"。这两件事你只能选一个。

**那两个工具没了。** `tools/prepare-art.mjs`、`tools/embed-art.mjs`、`tools/` 整个目录、以及 `assets/`（`mom-art.webp` + 旁挂 json）都删掉了:没有编码、没有裁剪、没有内联，也就没有需要跑的构建步骤；`ds_mom.png` 是唯一一份真相，第二份派生物没有了，漂移也就无从谈起。


**2. 她该站在哪儿。** `shell.overlay` 这一层是 `z-index: 20`，而且在所有列之后渲染，所以**我没法把人物放到内容下面去**（那得改 DSH 自己的层）。那正确做法就不是铺满整屏盖住对话，而是放进**侧边栏和居中卡片之间那块空档**：

- 位置是 `left = 侧边栏实测宽度`，贴底 → 正好"紧靠侧边栏"。
- 尺寸解出来是 `空档 = (中列宽 − 860) / 2`，给她 `空档 + 24px` 的溢出；**溢出那部分由右侧渐变 mask 吃掉**，所以在卡片上永远不会留硬边。
- 高度按宽高比反推、上限 = 视口高度（也就是「正好触顶」）；**尺寸只有触顶才会变**，空档不管尺寸（下一节专门讲这个）。

**透明度是安全网，不是装饰。** 上面那个 `860` 是 `--dsh-composer-card-max-width`，也就是 **composer 卡片**的宽度——消息列的宽度可没保证跟它一样，所以空档估算有可能偏乐观。因此：

| 常量 | 默认 | 作用 |
|---|---|---|
| `ART_OPACITY` | `0.5` | 整体透明度，用来兜住"估算偏大"的后果 |
| `ART_FADE_LEAD` | `90` | 在卡片边缘**之前** 90px 就开始淡出，重叠区到文字上时基本已经没了 |
| `ART_BLEED` | `24` | 允许越过空档的最大距离（唯一可能盖到内容的部分） |
| `ART_MAX_WIDTH` | `280` | 宽度上限（= 她的设计尺寸）。**高度上限就是它**：280 ÷ 0.667 = **420px** |
| `ART_MIN_WIDTH` | `150` | **淡出下限**：空档再窄，透明度也只按 150/280 衰减，不会淡到看不见 |
| `ART_MAX_HEIGHT_VH` | `100` | 高度上限 = 视口高度，即「正好触顶」。**不要改回百分比**，那会重新变成无脑缩放 |

`ART_FADE_LEAD` 还顺手带来一个自适应：**空档宽的时候她整段实心，空档窄的时候，她恰好在最缺空间的地方自己变淡**——不用再写第二条规则了。

### 尺寸只跟"顶端"走（桌面端同理）

**她的尺寸由高度决定，而高度只有一条约束：不能高过父级。** 她是 `bottom: 0` 贴底的，所以唯一可能撞到的地方就是**顶端**。于是：

```
宽高比 = MOM_ART_WIDTH / MOM_ART_HEIGHT = 1024 / 1536 = 0.667
高度上限 = min(420（= ART_MAX_WIDTH ÷ 宽高比）, 视口高度（100vh，不是百分比)）
她的宽度 = 高度上限 × 宽高比
```

**420px 就是她的最大高度**（画布 1024×1536，280 宽 → 420 高）。

**视口比她高多少都先不动**——只要还装得下，她一直是 280×420。**触顶之后**才跟着窗口一起缩：

| 视口高度 | 她的尺寸 | 状态 |
|---|---|---|
| 1200 / 1440 / 2000 | 280×420 | 满尺寸，底下留白 |
| 420 | 280×420 | 正好触顶 |
| 820（桌面默认） | 280×420 | 满尺寸，不触顶 |
| 400 | 267×400 | 触顶，随窗口缩 |

> ⚠️ 这里以前是 `ART_MAX_HEIGHT_VH = 78`，也就是**按视口比例缩**。问题在于"视口变矮了"和"她装不下了"这两件事它分不开，所以两种情况都会缩——**屏幕明明还有富余她也变小了**，这就是你说的"无脑的缩小"。改成 100 之后，比例上限只能在她真的触顶时生效。

**空档只管一件事：她盖到卡片上多少，以及因此要暗多少。** 不再决定尺寸：

| 中列宽 | 空档 | 她的尺寸 | 透明度 |
|---|---|---|---|
| 1020（桌面 1280 默认） | 80 | 280×420 | 0.27 |
| 1200 | 170 | 280×420 | 0.35 |
| 1350 | 245 | 280×420 | 0.48 |
| 1372 | 256 | 280×420 | 0.5（正好让开卡片） |
| 1400 及以上 | ≥256 | 280×420 | 0.5 |

**代价是重叠，安全性得由 mask 兜住。** `shell.overlay` 是 `z-index: 20`，她画在对话**上面**、躲不到卡片后面去——这是唯一没法绕开的一条。所以淡出必须**在文字开始的位置就归零**：`fadeTo = 空档 + ART_BLEED`（那 24px 就是卡片自己的内边距）。实测各尺寸下**文字所在列的 alpha 都是 0.0%**，可读性没有被"不缩小"这件事花钱买掉。

> 顺带记一笔：淡出**不能**拉满她整个 280px 那样做——试过，文字列会剩 ~18% 的 alpha。终点定在文字列，既守住可读性，又让她保持满尺寸（她画得宽，但读起来仍然停在卡片边缘）。

几何从哪儿来呢？`PanelInfo` 只有 `activePanelId`，没有尺寸；frame 的 class 又是 CSS-module 的 hash。但 AppFrame 把 `grid-template-columns` 写在**行内**呀，所以读它的 computed 值就是权威来源——用 `MutationObserver`（侧栏折叠、拖拽都会重写行内样式）加上 `ResizeObserver` 和 window resize 保持同步。

换素材的流程：**换掉 `ds_mom.png` 就完了**——刷新页面即可，没有工具要跑、没有东西要重建。唯一例外是新的图**宽高比不同**，那要同时改 `lib/client.js` 顶部那两个画布常量。

## 安装

这是一个**标准 bundle**：`package.json` 声明了 `dsh.bundle.patch`，指向 `cordis.patch.yml`。
用 harness 自己的安装器装进 profile 就行（在 Web UI 里让 agent 装，或直接调 `plugin_manager`）：

```
plugin_manager  action: install_bundle   target: <这个仓库的绝对路径>
```

> 等价 CLI：`dsh plugin --profile <profile> add <这个仓库的绝对路径>`。

**也可以直接从 GitHub 装**（`plugin_manager` 认 git 规格，而且 pnpm 从远端装出来是**真实目录**不是符号链接——路由读包内文件这条路我验证过）:

```
plugin_manager  action: install_bundle   target: github:<owner>/<repo>
```

### 支持范围（重要）

`peerDependencies` 声明的是 **`@deepseek-ai/dsh: ^0.2.0-0`**，也就是**这个 0.2.x 线**。这不是装饰:

- 预设的 composition 是内置 `standard` 预设的**手抄快照**，里面每个模块名都必须是那个版本里真实存在的包。换到别的线，有些名字不存在——而 Loader 解析不出名字**不是少个功能**，是**整个预设挂载失败**，roster 把它标成 `broken`，于是**任何会话都选不中它**。
- 有了这个范围，host 的兼容性检查才生效（它读的就是 `peerDependencies`；没有这个字段它会**直接返回 undefined**，等于永不报警）。装在 `0.2.x` 上通过；装到 `0.3.0` 或更高会被**拒绝**并告诉你怎么显式承担风险（`dsh plugin allow-version`）。

> ⚠️ **为什么写 `^0.2.0-0` 而不是 `^0.2.0`。** semver 的预发布规则下，`^0.2.0` **不接受** `0.2.0-rc.2` 这样的运行时版本——我实测过，那样写会让所有人都装不进去。加 `-0` 才能覆盖 `0.2.0-*` 预发布以及之后的 `0.2.0` 正式版。这种地方不能靠猜。

**升级 DSH 之后如果预设不见了**：`node test/bundle.mjs` 会打印与内置 `standard` 的漂移报告（哪些行多了、少了、改了），照着把 `cordis.patch.yml` 重新对齐一遍就行。这一步**不会**自动发生——快照是故意的，因为自动跟随时上游一改就可能悄悄换掉它的行为。

它会做两件事：`pnpm add <这个目录>`，再把这个包加进 profile 的 `dsh.profile.bundles`。
**没有自定义安装脚本了**——以前的 `install.sh` 已经删掉。

> **为什么 pnpm 的 `link:` 很关键。** 本地目录装进来是**符号链接**（`dsh-mom-preset -> …/mom_preset_dsh`），
> 不是拷贝。所以 patch 和两个插件都是**原地读仓库**的：改完只要重启 host，
> 不用重装。这正是以前 `install.sh` 要费劲绕开的东西——它得把 agent 半边的插件文件拷到
> `$DSH_HOME/.agent-presets/mom/`，再往 home patch 里写绝对路径。

**安装单元只有一个。** 仓库里是**两个包**——根包（bundle + agent 插件）和 `dsh-mom-ui`
（浏览器半边）。后者保留自己的包名是**机制要求**（见下面「两个名字」那节），但它是根包的
workspace，**不是第二个可安装单元**：`install_bundle` 只指向这个仓库目录一次，两个半边永远同版本。

**装完重启 host，然后刷新一次浏览器页面。**

**两个名字，两套解析基底**（这是这个 bundle 里最容易搞错的地方，踩过）：

| 行 | 名字 | 相对谁解析 |
|---|---|---|
| 插入的客户端行 | `./dsh-mom-ui/lib/index.js` | **所在 patch 文件**（也就是这个包目录） |
| 预设里的 agent 行 | `dsh-mom-preset`（本包的包名） | **profile 目录**——`mountPreset` 用的是**声明者**（registry）的解析基底，不是这张 patch 的 |

第二条是实测出来的，不是推理出来的：写 `./dsh-mom-mode/index.js` 时 roster 直接把预设标成
`broken: mom-mode (./dsh-mom-mode/index.js): never started`，因为它去 `<profile>/dsh-mom-mode/…`
找了。裸包名会从 profile 的 `node_modules`（符号链接所在）解析，所以 agent 半边按**包名**引用。
为了让它成立，本包的 `main` / `exports` 指向 **`mom-mode.js`**——也就是
「一个包既是 profile 层、又是插件」，shipped 的 `@deepseek-ai/dsh-web-app` 正是这个形状。

> 所以 agent 半边**不需要自己的包**：它没有包名，也没人按名字 import 它，只是这个包的入口文件。
> 早先那个 `dsh-mom-mode/` 目录（连同一个 `"type": "module"` 的占位 manifest）因此删掉了——
> 根包自己就是 ESM，那份 manifest 是多余的。现在的形状是**两个包**：根包（bundle + agent 插件）
> 和 `dsh-mom-ui`（浏览器半边，只提供边界，不是第二份交付物）。

**改源码之后呢**（都**不用**重装，只要重启）：

| 改了什么 | 怎么生效 |
|---|---|
| `cordis.patch.yml`（语气、composition） | **重启 host** + 新开会话 |
| `mom-mode.js` | **重启 host** |
| `dsh-mom-ui/lib/client.js` | **重启 host** + 刷新页面（bundle 由 host 启动时读进图里） |

**客户端半边仍然故意不声明 `dsh.bundle`。** 它只是个普通的 `dsh.client` 包，由 patch 里那一行按文件引入。
两条 entry 解析出同一个包名的话，`dsh-client-modules` 的 `reconcilePackage` 会抛错 → fiber 失败 →
`window.__DSH_BOOT__` 不注入，**整个 Web 客户端黑屏**，浏览器那边拦不住，因为 host 已经先死了。

> ⚠️ **这就是 `dsh-mom-ui` 必须是一个独立包名的原因——但仅此而已。** 它跟根包一起写在
> `pnpm-workspace.yaml`（和根 `package.json` 的 `workspaces`）里，是为了把这条边界**写明**，
> 不是把它变成第二个可安装单元：它在 mom 会话之外**什么都不渲染**（门控读的是当前会话的
> `agentPreset`），单独装上去就是一份死代码；而第二条安装路径本身就等于上面那条双 entry 错误。
> `test/bundle.mjs` 现在有专门的契约段盯着它：不得声明 `dsh.bundle`、不得带 patch 文件、
> 不得被任何 Loader 行或源码按**包名**引用、workspace 声明必须和目录同名。

### 桌面端

**代码不用改。** 桌面应用是同一份 Web 前端外面的一层 Electron 壳：`apps/desktop/src/main.ts` 对
`app://app` 这个源直接把 `@deepseek-ai/dsh-web-frontend/dist` 端出去，其余请求转发给同一个 Host。
所以客户端插件、插槽、`window.__ModuleLoader__`（由 `dsh-client-modules` 自己注入，跟 Web 应用无关）
全都一样。

两个容易误判的点：

- **`"platform": "web"` 不是"只能在网页用"。** `dsh-client-modules` 只认这一个值
  （`decl.platform !== 'web'` 就跳过），shipped 的客户端插件**全都**写 `web`，桌面端也不例外。
- **桌面 profile 的 `pnpm-workspace.yaml` 没有 `cordis` / `schemastery` 的 `overrides`**，Web profile 有。
  本插件两个 host 半边**一个包都不 import**（`dsh-mom-ui/lib/index.js` 是空 `apply`，`mom-mode.js` 同样无依赖），
  所以那份 overrides 是给别人防"两份 cordis 实例"的，对我们没有意义。

**要改的是安装位置：桌面有自己独立的 profile。**

| profile | 给谁用 | 装了吗 |
|---|---|---|
| `~/.dsh/profiles/web` | Web / CLI | ✅ `link:` + 在 `dsh.profile.bundles` 里 |
| `~/.dsh/profiles/desktop` | 桌面应用 | ✅ 同样两样 |
| `<harness>/.dsh-build/home/…` | `pnpm dev:desktop` | ❌ `dev` 把 `DSH_HOME` 指到仓库里，是第三个 home |

**别指望在 Web 会话里装到桌面去。** 插件管理器**明确不能改别的 profile**——它只能动启动器给它的那个。
所以有两条路：

1. **桌面应用自己的「插件」页**（走同一个管理器，最稳），或
2. **CLI**：`dsh plugin --profile desktop add /Users/name/codes/mom_preset_dsh`
   —— 注意这条**只跑 pnpm**，`dsh.profile.bundles` 还得另外加，两步。

已经手动装好的桌面 profile 长这样（和 Web profile 完全一致，`link:` 是绝对路径，符号链接指回本仓库，
所以改完照样**只重启、不重装**）：

```jsonc
// ~/.dsh/profiles/desktop/package.json
"dependencies": { "dsh-mom-preset": "link:/Users/name/codes/mom_preset_dsh" },
"dsh": { "profile": { "bundles": [
  "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app",
  "dsh-mom-preset"            // ← 追加到列表末尾
] } }
```

追加到**末尾**是管理器自己的规矩：开 bundle 就是往列表尾部加，这会改变配置优先级。

> ⚠️ 桌面 profile 必须**先启动过一次桌面应用**才会被创建；CLI 拒绝在不存在的 profile 上操作。
> 另外装之前**完全退出应用**——包操作要拿 profile 写锁，并发写入会被挡。

**装完的验证顺序**（重启应用，然后新开一个妈妈模式的会话）：

| 看什么 | 期望 |
|---|---|
| 侧栏品牌 | 变成「妈妈模式」+ 💗，切到别的模式**变回官方标记**（这是 `single` 座位 shadows 出厂占用者，本插件自己渲染官方标记） |
| 背景人物 | 贴在侧栏右侧、贴底，**最大 280×420**，只在触顶时随窗口缩小。默认 1280px 窗口下她是满尺寸、透明度 0.27（空档只有 80px，所以偏暗），**盖到卡片上的部分在文字列之前就淡到 0**（见上面「尺寸只跟顶端走」） |
| 暖色主题 | 面板转暖粉/暖褐；深浅色都读过（每个 token 都给了两套） |
| 输入框 placeholder | `想要妈妈做什么, / 调用指令, @ 文件或对话`；**新会话**（hero 变体）也是这句 |
| 切到别的模式 | placeholder **复原**成 `发消息或创建任务, …`（hero 那句也复原） |
| 思考中 | `❤ 妈妈在想，用时 3 秒`——标签和跑马灯装饰层都要对 |
| 「设置 → 插件 → 妈妈模式装饰」开关 | 关掉后装饰全停 |

**装饰开关是按 origin 存的**（`localStorage` 里 `dsh-mom-ui:decor`），Web 是 `localhost:3080`、桌面是
`dsh-app://app`，所以**两个端各有一份开关状态**，互不影响。

## 验证

```bash
npm test                 # 两个都跑
node test/smoke.mjs      # 114 项：逻辑 + 语气词表守卫
node test/bundle.mjs     # 37 项：bundle 结构、名字解析、policy、漂移
```

`test/bundle.mjs` 里那组**名字解析**是唯一能挡住整条预设失效的检查：预设里任何一个模块名
解析不出来，挂载就整个失败，roster 把「妈妈模式」标成 `broken`，会话根本选不中它——而其余的检查
（YAML 合法、声明字段齐全）全都照过。它拿**装好的 harness** 逐行解析名字，另外验证每个相对路径
**在 patch 旁边真的存在**（这正是上面那条实测踩出来的）。它跟 harness 版本无关，只有真的坏了才红。

联机上再看一眼：

1. **在新会话的选择器里点「妈妈模式」→ 配色立刻就变暖、侧栏字标变成「妈妈模式」**，不用等第一轮对话（背景人物要等中间栏量出足够空档才画）。
2. 再切回「标准模式」→ 暖色立刻还原、侧栏回到鲸鱼：override 层加得对，也拆得掉。
3. 会话里随便说一句 → 回复的语气是妈妈的，但**不会**多出任何「鼓励语」那种罐头句子（那个功能已经删了），左上出现徽章。
4. 开两个会话（一 mom 一 standard）来回切 → 配色和品牌跟着切，证明 opt-in 是真的按会话走的。

## 已知限制

- **改任何一边都要重启 host**：`mom-mode.js` 是 Loader 按模块名 import 的 ESM（被缓存，也没人盯源码），预设和 UI 插件则都住在 `cordis.patch.yml` 里，而这个版本的 web bundle 没挂 host 侧 patch 热重载。
- **插件现在一个字都不往会话里插**，所以「注入消息形状不对 → 整轮失败」那类坑（`format v4 message requires a producer-owned source kind`）连同它的多发地一起没了。真要在别处造消息，记住 v4 **没有**通用的 `plugin` 兜底 kind（`MessageSourceMap` 原话："there is no shared catch-all `plugin` kind"），每个 producer 得用自己的名字（`tool-jobs`、`tool-goal` 都是这么写的）。当年踩的时候 `test/smoke.mjs` 正好断言了那种错写法，测试把 bug 钉住了——所以 `install.mjs` 现在会拿 harness 自己的 `assertV4RowAdmission` 验消息，而不是自己重写一遍校验。
- UI 插件的代码本身对所有会话都可见——客户端平面没有按预设装配，这是固有限制。
- 预设是 `standard` 的快照：升级 DSH 不会同步内置预设的改动。
- **预设里的模块名必须是这个部署里真的装了的包，否则整条预设直接失效。** 这一条比它看起来严重：Loader 解析不出名字不是"少个工具"，而是挂载整个失败，roster 把「妈妈模式」标成 `broken`（`agentPresets/list` 里能看到 `broken: "<行 id> (<包名>): never started"`），于是**任何会话都选不中它**。而且它骗得过几乎所有的检查——YAML 是合法的、声明字段是齐的、路径也是绝对路径，看起来跟旁边的行一模一样。仓库里就踩过一次：`delegation` 组里写了 `@deepseek-ai/dsh-workflow-worker-thread`，那是别的版本的引擎，0.1.7-rc.2 里叫 `@deepseek-ai/dsh-workflow-ptc`。现在 `test/bundle.mjs` 会逐行解析所有模块名，红的就是这一条。
- `test/bundle.mjs` 里跟内置 `standard` 的漂移报告**只打印、不判失败**：这个预设本来就是快照，升级后跟新 `standard` 有出入是正常的；但漂移是上面那个坑的来源，所以它照样会响亮地打出来，照着改就行。
- 仓库可以随便搬家：bundle 是符号链接安装的，patch 里的两个名字**都不是绝对路径**（客户端行是 patch 相对，agent 行是包名），所以换个目录只要重装一次 `install_bundle`。
- `--dsh-composer-card-max-width` 才是真实存在的 token 名；写到不存在的变量名上只会悄悄地用兜底值（这个坑我自己踩过一次）。
- **桌面端的代码与 Web 完全共用**（同一个前端 bundle、同一套插槽），所以这里列的每一个限制对桌面端同样成立，一条都不用改。唯一和桌面有关的是**安装位置**：它有自己的 profile，详见上面「桌面端」那节。
- ⚠️ **桌面端还没在真机上验过。** 本机 `/Applications` 里没有装桌面应用，`dsh` 也不在 PATH 上，所以「装进 `~/.dsh/profiles/desktop`」这步是按管理器 `installBundle` 的等价做法手工做的（`pnpm add` + 追加 `dsh.profile.bundles`），**跑起来是什么样没有实测**。上面那张验证表就是等桌面能跑了以后逐条对用的。
- `shell.overlay` 的飘落爱心默认关着，持续动画容易干扰阅读。
