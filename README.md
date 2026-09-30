# 妈妈模式 for DeepSeek Harness

说白了就是 **一个 agent 预设 + 两个半边插件**。你选「妈妈模式」开会话呢，它就有妈妈人设、一段贯穿全程的行为准则（先接住人再处理事、别拿否定词开头、把失败说小），顺带一整套按会话开关的暖色 Web UI。别的会话呀，一点都不受影响。

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

> **曾经还有第三层：每轮塞一句轮换的"鼓励语"（「全肯定」那套），已经整个删掉了。** 它做的是：读用户原话做关键词匹配，按情绪挑一个短语池（烦躁→`妈妈加油`，道谢→`谢谢妈妈`），再用 FNV-1a 哈希按 (会话, 轮次) 确定性地挑一句，作为一条 user 消息追加进去。删掉的原因：句子是**罐头**的，会话一长就开始重复；而且模型会**照着学**那个腔调，把它变成自己的收尾（"我在这儿呢，你说。"）——那种回复什么问题都没回答。想知道当时长什么样，看 [`dsh-mom-ui-audit.md`](dsh-mom-ui-audit.md) 顶上的存档说明。
>
> 一起删掉的还有为它服务的一整套：情绪表、关键词分类器、FNV-1a 轮换、notice summary 的长度约束，以及**浏览器里那份为了预测"会插哪句"而存在的情绪表副本**（连带那条贴输入框的横幅）。现在这个插件只做一件事：注册那一段 prompt。

## 目录

```
dsh-mom-mode/          agent 面插件（零 import）
  index.js             只注册行为准则那一段 prompt（约 80 行）
dsh-mom-ui/            Web UI 插件（手写 bundle，没有构建步骤）
  lib/index.js         host 半：一行空 apply（客户端插件必须作为 Loader entry 存在）
  lib/client.js        主题 + 6 个插槽界面（含内嵌的背景人物）
package.json           bundle 声明：name + dsh.bundle.patch -> ./cordis.patch.yml
cordis.patch.yml       唯一的 patch：插入预设声明 + 客户端行（composition 就在里面）
reply-style.md         回复风格控制表（改 agent 说话方式先看它）
assets/                背景人物素材
  mom-art.webp         处理好的成品（698×1536，164 KB）
  mom-art.json         尺寸旁挂，给 embed-art 读（这样它就不用依赖图像库了）
ds_mom.png             原图（素材真源；无 alpha 时由 prepare-art 抠掉底色）
tools/prepare-art.mjs  抠底 → 裁剪 → 缩放 → 编码，`--inspect` 只看诊断
tools/embed-art.mjs    把成品内嵌进 client.js（`--check` 校验是否过期）
test/smoke.mjs         137 项：逻辑 + 语气词表守卫
test/bundle.mjs        37 项：bundle 结构 + 名字解析（相对路径存在性、裸包名）
                        + policy 是否随声明下发
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

> **想让某个说法消失，就别把那个说法本身写进 `policy`。** policy 里只放**正面说法**（"问他有什么想做的"），被禁掉的原句留给 [`reply-style.md`](reply-style.md)——那张表模型读不到。已经踩过两次：`契约` 在禁用词表里，写进去 smoke 当场红；`说一声就行` 这类**求指示的收尾**则由 `SERVILE_VOCABULARY` 盯着。提示词里出现的每个例句都会反过来影响模型怎么说话，负面例句也一样。

> **收尾不许把球推回去。** 三种坏写法是同一件事——求指示（"说一声就行"）、反问要不要做（"要我一起做掉吗"）、**以及无意义地反问要做什么**（"你现在想让我看点啥？"）。policy 现在写的是**动作**，不是例句："一件事说完就说完了，别在末尾再接一句把话头递回去的问句——那等于这轮什么都没答，他还得重新说一遍想干什么。写完把末尾那句删掉试试：这轮少没少东西？没少，那句就是多余的。"**唯一准许的问法是手上有几条真实的路、且只有他能定的那种**；"你想先弄哪块"不算——他本来就知道。对照表在 [`reply-style.md`](reply-style.md) §3.6。
>
> ⚠️ **这条改过两次，原因值得记。** 第一版把禁掉的框架写成例句，模型就把它当**黑名单**满足：`session-4416bf36` 的推理原话是「别用"要不要我……"结尾」，然后它换个说法把同一件事说了出来（"你就直接说想干啥吧"）。所以现在 policy 里**一个可引用的坏例句都没有**，只有动作描述和一个模型自己跑得了的判断。"讨指示"这类例句只留在 [`reply-style.md`](reply-style.md) 的表里——那张表模型读不到。

> **也不许空转。** 没有明确目标、只是在等用户开口时，很容易冒出一句"你直接说，我先听着"——它回答了什么？没有。提出了什么？没有。只是拿一句话把这一轮填满了，**看着像陪着，其实什么都没给**。判断标准很土但很好用：**把这句话删掉，这轮回复还剩什么？** 什么都不剩，那它就是空转。policy 里写的是"实在没话可说，就说点实在的：刚查到什么、下一步打算怎么弄"。对照表在 [`reply-style.md`](reply-style.md) §3.7。
>
> 这条还顺带解决了一个老问题：以前每轮会注入一句旁白（"我在这儿呢，你说。"），模型天天看着就照着学。旁白整个删掉之后，这个腔调的来源没了。

> **回复要"把话讲完整"，不许压成词组。** 这是**方向反过一次**的地方：上一版 policy 写的是「句子短一点」，`reply-style.md` 开篇也写着「短句、碎念」，结果回复长成一串光杆动词——「查源码、改文件、跑命令、看日志、盯风险」，看着利索，没一句是人话。现在要求反过来：单动词（"查"）和合成词（"验证""排查"）都**展开成整句**（"我替你看看"／"我实际跑一遍，看看结果对不对"）。对照表在 [`reply-style.md`](reply-style.md) §2.5。
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

`ds_mom.png` 是妈妈版 DS 娘。要把它变成能用的背景，得解两件事。

**1. 先抠底，再裁剪 → 缩放 → 编码。** 源图有两种形态，工具按有没有 alpha 分道走：

- **自带 alpha**（现在这张就是，1024×1536）→ 一个像素都不碰，直接裁剪缩放编码。作者已经抠好了，再抠一遍只会把她的轮廓啃掉。
- **没有 alpha** → 先抠底。见过纯黑底（纯黑底 + 人物，占画布 88.4%）这类。

抠底**不是**全局按颜色抠。人物自己身上就有 1000～3600 个近黑像素——线稿、深蓝的头发和裙子——全局阈值会把它们当背景，在她身上打出一片洞。真正用的是**从画布四边往里泛洪**：只有*从边界能走到*的近底色像素算背景，内部的暗部因为被身体围住、走不到，全部留下。

**边缘要单独处理，否则会带底色边。** 压在底色上、跨在边界上的那些像素是被底色*压过*的（抗锯齿的必然结果）。直接给满 alpha，UI 在她背后刷什么色，都会露出一圈底色轮廓。所以 alpha 同时取两条：剪影做 2px 盒式模糊（抗锯齿），再叠一条按亮度爬升的斜坡（把过渡带收掉）。

抠完会打出两行诊断——抠掉的占比、**被保住的近底色像素数**——数字不对就该怀疑了。

> 纯白底最麻烦：亮度分不开浅色主体，只能靠**色度**，再加"先膨胀、后泛洪、再取交集"去跨过细发丝轮廓。纯黑底不需要色度，`max(通道) <= 20` 就够了。
>
> 还有一种更阴的：**烤进图里的棋盘格**。有人把透明图往白棋盘上一存就导出了，看着像透明，其实是画上去的——两种近白色调（241–246 / 253–255）交替，而人物的米色上衣只有 233，**中间只隔 6 级**。这种源图现在的 keyer 处理不了，会直接报错（它的判据是"底色"而非"黑"），要换就换一张真带 alpha 的。

**不过裁剪阈值还是个真陷阱呢。** 抠图或者作者自己都可能拖出一条 alpha 1–15 的**极淡噪声尾巴**——现在这张就有：

```
按 alpha>0   裁剪 → 930×1536   ← 被噪声撑大了
按 alpha>=16 裁剪 → 682×1524   ← 真实主体
```

这可不是好不好看的问题：宽高比要喂给组件的尺寸求解，**框被撑大，她画出来就只有应有的一半大**。所以 `ALPHA_FLOOR = 16` 把噪声忽略掉，而且诊断会把两个框都打出来——将来你换了带同样毛病的源图，能看见，而不是被悄悄坑掉。

抠不动的源图会**直接报错**（既没有 alpha、边界也不是纯色底），而不是悄悄产出一个矩形。成品是 698×1536、164 KB WebP。`node tools/prepare-art.mjs --inspect` 只出诊断，不写文件。

**2. 她该站在哪儿。** `shell.overlay` 这一层是 `z-index: 20`，而且在所有列之后渲染，所以**我没法把人物放到内容下面去**（那得改 DSH 自己的层）。那正确做法就不是铺满整屏盖住对话，而是放进**侧边栏和居中卡片之间那块空档**：

- 位置是 `left = 侧边栏实测宽度`，贴底 → 正好"紧靠侧边栏"。
- 尺寸解出来是 `空档 = (中列宽 − 860) / 2`，给她 `空档 + 24px` 的溢出；**溢出那部分由右侧渐变 mask 吃掉**，所以在卡片上永远不会留硬边。
- 高度按宽高比反推、上限 78vh；**空档不够（<126px）就干脆不渲染**——被压扁、或者压住对话的人物，比没有更糟呀。

**透明度是安全网，不是装饰。** 上面那个 `860` 是 `--dsh-composer-card-max-width`，也就是 **composer 卡片**的宽度——消息列的宽度可没保证跟它一样，所以空档估算有可能偏乐观。因此：

| 常量 | 默认 | 作用 |
|---|---|---|
| `ART_OPACITY` | `0.5` | 整体透明度，用来兜住"估算偏大"的后果 |
| `ART_FADE_LEAD` | `90` | 在卡片边缘**之前** 90px 就开始淡出，重叠区到文字上时基本已经没了 |
| `ART_BLEED` | `24` | 允许越过空档的最大距离（唯一可能盖到内容的部分） |
| `ART_MAX_WIDTH` / `ART_MIN_WIDTH` | `420` / `150` | 尺寸上下限 |
| `ART_MAX_HEIGHT_VH` | `78` | 高度上限（视口百分比） |

`ART_FADE_LEAD` 还顺手带来一个自适应：**空档宽的时候她整段实心，空档窄的时候，她恰好在最缺空间的地方自己变淡**——不用再写第二条规则了。

拿 1600px 窗口实测（空档 240、她 264 宽、`solidTo=150`、`fadeTo=264`）：她最多只压到卡片边缘 24px，而那儿 alpha 已经降到 ~21% 了（再乘上 0.5 的整体透明度，约 10%），文字完全读得清。

几何从哪儿来呢？`PanelInfo` 只有 `activePanelId`，没有尺寸；frame 的 class 又是 CSS-module 的 hash。但 AppFrame 把 `grid-template-columns` 写在**行内**呀，所以读它的 computed 值就是权威来源——用 `MutationObserver`（侧栏折叠、拖拽都会重写行内样式）加上 `ResizeObserver` 和 window resize 保持同步。

换素材的流程：换掉 `ds_mom.png` → `node tools/prepare-art.mjs` → `node tools/embed-art.mjs`。`embed-art --check` 会告诉你 bundle 里的图过期了没有。

## 安装

这是一个**标准 bundle**：`package.json` 声明了 `dsh.bundle.patch`，指向 `cordis.patch.yml`。
用 harness 自己的安装器装进 profile 就行（在 Web UI 里让 agent 装，或直接调 `plugin_manager`）：

```
plugin_manager  action: install_bundle   target: /Users/name/codes/mom_preset_dsh
```

它会做两件事：`pnpm add <这个目录>`，再把这个包加进 profile 的 `dsh.profile.bundles`。
**没有自定义安装脚本了**——以前的 `install.sh` 已经删掉。

> **为什么 pnpm 的 `link:` 很关键。** 本地目录装进来是**符号链接**（`dsh-mom-preset -> …/mom_preset_dsh`），
> 不是拷贝。所以 patch 和两个插件都是**原地读仓库**的：改完只要重启 host，
> 不用重装。这正是以前 `install.sh` 要费劲绕开的东西——它得把 `mom-mode.js` 拷到
> `$DSH_HOME/.agent-presets/mom/`，再往 home patch 里写绝对路径。

**装完重启 host，然后刷新一次浏览器页面。**

**两个名字，两套解析基底**（这是这个 bundle 里最容易搞错的地方，踩过）：

| 行 | 名字 | 相对谁解析 |
|---|---|---|
| 插入的客户端行 | `./dsh-mom-ui/lib/index.js` | **所在 patch 文件**（也就是这个包目录） |
| 预设里的 agent 行 | `dsh-mom-preset`（本包的包名） | **profile 目录**——`mountPreset` 用的是**声明者**（registry）的解析基底，不是这张 patch 的 |

第二条是实测出来的，不是推理出来的：写 `./dsh-mom-mode/index.js` 时 roster 直接把预设标成
`broken: mom-mode (./dsh-mom-mode/index.js): never started`，因为它去 `<profile>/dsh-mom-mode/…`
找了。裸包名会从 profile 的 `node_modules`（符号链接所在）解析，所以 agent 半边按**包名**引用。
为了让它成立，本包的 `main` / `exports` 指向 `dsh-mom-mode/index.js`——也就是
「一个包既是 profile 层、又是插件」，shipped 的 `@deepseek-ai/dsh-web-app` 正是这个形状。

**改源码之后呢**（都**不用**重装，只要重启）：

| 改了什么 | 怎么生效 |
|---|---|
| `cordis.patch.yml`（语气、composition） | **重启 host** + 新开会话 |
| `dsh-mom-mode/index.js` | **重启 host** |
| `dsh-mom-ui/lib/client.js` | **重启 host** + 刷新页面（bundle 由 host 启动时读进图里） |

**客户端半边仍然故意不声明 `dsh.bundle`。** 它只是个普通的 `dsh.client` 包，由 patch 里那一行按文件引入。
两条 entry 解析出同一个包名的话，`dsh-client-modules` 的 `reconcilePackage` 会抛错 → fiber 失败 →
`window.__DSH_BOOT__` 不注入，**整个 Web 客户端黑屏**，浏览器那边拦不住，因为 host 已经先死了。

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

- **改任何一边都要重启 host**：`dsh-mom-mode/index.js` 是 Loader 按模块名 import 的 ESM（被缓存，也没人盯源码），预设和 UI 插件则都住在 `cordis.patch.yml` 里，而这个版本的 web bundle 没挂 host 侧 patch 热重载。
- **插件现在一个字都不往会话里插**，所以「注入消息形状不对 → 整轮失败」那类坑（`format v4 message requires a producer-owned source kind`）连同它的多发地一起没了。真要在别处造消息，记住 v4 **没有**通用的 `plugin` 兜底 kind（`MessageSourceMap` 原话："there is no shared catch-all `plugin` kind"），每个 producer 得用自己的名字（`tool-jobs`、`tool-goal` 都是这么写的）。当年踩的时候 `test/smoke.mjs` 正好断言了那种错写法，测试把 bug 钉住了——所以 `install.mjs` 现在会拿 harness 自己的 `assertV4RowAdmission` 验消息，而不是自己重写一遍校验。
- UI 插件的代码本身对所有会话都可见——客户端平面没有按预设装配，这是固有限制。
- 预设是 `standard` 的快照：升级 DSH 不会同步内置预设的改动。
- **预设里的模块名必须是这个部署里真的装了的包，否则整条预设直接失效。** 这一条比它看起来严重：Loader 解析不出名字不是"少个工具"，而是挂载整个失败，roster 把「妈妈模式」标成 `broken`（`agentPresets/list` 里能看到 `broken: "<行 id> (<包名>): never started"`），于是**任何会话都选不中它**。而且它骗得过几乎所有的检查——YAML 是合法的、声明字段是齐的、路径也是绝对路径，看起来跟旁边的行一模一样。仓库里就踩过一次：`delegation` 组里写了 `@deepseek-ai/dsh-workflow-worker-thread`，那是别的版本的引擎，0.1.7-rc.2 里叫 `@deepseek-ai/dsh-workflow-ptc`。现在 `test/bundle.mjs` 会逐行解析所有模块名，红的就是这一条。
- `test/bundle.mjs` 里跟内置 `standard` 的漂移报告**只打印、不判失败**：这个预设本来就是快照，升级后跟新 `standard` 有出入是正常的；但漂移是上面那个坑的来源，所以它照样会响亮地打出来，照着改就行。
- 仓库可以随便搬家：bundle 是符号链接安装的，patch 里的两个名字**都不是绝对路径**（客户端行是 patch 相对，agent 行是包名），所以换个目录只要重装一次 `install_bundle`。
- `--dsh-composer-card-max-width` 才是真实存在的 token 名；写到不存在的变量名上只会悄悄地用兜底值（这个坑我自己踩过一次）。
- `shell.overlay` 的飘落爱心默认关着，持续动画容易干扰阅读。
