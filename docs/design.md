# 设计说明（维护者文档）

README 面向使用者;这份面向**改这个仓库的人**。里面每一条都是改动时会被踩到的约束,不是历史考证——历史留在提交信息和 [`ui-audit.md`](ui-audit.md) 里。

---

## 1. 为什么是「预设 + 两个半边」

`dsh plugin add` 会把插件塞进 profile 的 bundle 层,结果是**所有会话**都被注入。而预设是**按会话**挑 Agent 装配的唯一机制。所以:

- **agent 面** —— 只由 `mom` 预设加载。它作为**预设声明里的一个子行**被挂载,不进 profile 层栈,别的会话连它的影子都看不到。bundle 本身是 profile 层(那是 patch 的来源),但**插件不是**。
- **Web UI 面** —— 客户端平面**没有**「按预设装配」这个能力,只能全局装。所以它每个界面自己读当前会话的 `agentPreset`,不是 `mom` 就渲染 `null`。opt-in 就是这样保住的,这也是为什么 UI 插件全体都是**按会话门控**而不是按安装门控。

推论(改任何 UI 界面时都要记住):**这个 UI 是 mom 预设的影子,不是独立产品。** 它在 mom 会话之外什么都不渲染,所以:

- 它必须和预设同时在场、同版本演进;
- 单独安装它是死代码(见 §6 的边界契约);
- 门控判据一旦写错,表现是**整个 UI 静默不生效**,而不是报错(见 §7)。

---

## 2. 两层:人设 + 行为准则

| 层 | 落点 | 作用 |
|---|---|---|
| 1 · 人设 | 预设的 `persona.prefix`(`cordis.patch.yml`) | 妈妈身份与语气基调,取代 standard 的通用身份 |
| 2 · 行为准则 | `ctx.systemPrompt.section('mom:policy', order 1)` | 先接住人再处理事、别用否定式开头、把失败说小、话说得像人话 |

**第 2 层最后那段是道保险**——「有件事妈妈不做:不拣好听的哄他」。**这条不能去**:少了它,暖就退化成谄媚,模型开始瞒报错误。`test/smoke.mjs` 有一条专门断言它在。

### 为什么 policy 文本是**稳定**的

它是系统提示词里的一段,从第一轮起就固定。会随轮次变化的段落会作废 provider 的前缀缓存(从第一个变化 token 开始)。

这条也是下面那条设计的前车之鉴:这个插件曾经在 `agent/pre-step` 里读用户原话做关键词匹配、按情绪挑一句「鼓励语」注入成 user 消息。删掉它有两个原因:句子是**罐头**的,会话一长就重复;而且模型会**照着学**那个腔调,把它变成自己的收尾("我在这儿呢,你说。")——那种回复什么问题都没回答。一起删掉的还有情绪表、关键词分类器、FNV-1a 轮换、notice summary 长度约束,以及浏览器里那份为了预测"会插哪句"而存在的情绪表副本(连带贴输入框的横幅)。**现在这个插件只做一件事:注册那一段 prompt。** 别把注入层加回来。

### policy 正文在哪、怎么改

正文在 `cordis.patch.yml` 的 `mom-mode.config.policy`,**不在 JS 里**。改完重启 host、新开会话生效(不用重装)。插件里的 `DEFAULT_POLICY` 只是**这一行缺失时的兜底**,写得短,别拿它来调。

写这段文字的三条硬约束(每一条都有测试盯着,踩过两次):

1. **它是给模型读的,会直接影响模型怎么说话。** 用妈妈自己会说的话来写——常用语、具体例子。**别写成规则清单**:`门控/闸/底线/绝不可以/禁止/必须/契约…` 这类词会顺着提示词渗进回复里,把要温暖的东西写得更硬(`STIFF_VOCABULARY`)。
2. **想让某个说法消失,就别把那个说法本身写进 policy。** policy 里只放**正面说法**;被禁掉的原句留给 [`reply-style.md`](reply-style.md)——那张表模型读不到。踩过:把禁掉的框架写成例句,模型就把它当**黑名单**满足,推理里念着「别用"要不要我……"结尾」,然后换个说法把同一件事说了出来。所以现在 policy 里**一个可引用的坏例句都没有**。
3. **不许求指示、不许空转、不许把球推回去。** 三种坏写法是同一件事:求指示("说一声就行" `SERVILE_VOCABULARY`)、反问要不要做、无意义地反问要做什么。判断标准写进了 policy 本身:"把末尾那句删掉试试,这轮少没少东西?" 唯一准许的问法是**手上有几条真实的路、且只有他能定**的那种。空转则是 `IDLE_VOCABULARY` 盯的:整轮只有"我听着呢"这类话,删掉它这轮就什么都不剩。

> 「话多一点不碍事」那条**已撤回**:它和"不许空转"互相拉扯,模型只能在"话多"和"别凑数"之间猜。现在只规定**用词**,不规定长短。
>
> 反向也踩过:上一版 policy 写的是「句子短一点」,结果回复长成一串光杆动词(「查源码、改文件、跑命令」)。现在要求反过来——单动词和合成词**展开成整句**。改这一节之前先读 [`reply-style.md`](reply-style.md)。

---

## 3. 界面:插槽、主题、以及两处只能改 DOM 的文案

### 八个界面(默认注册七个)

| 插槽 | 类型 | 界面 |
|---|---|---|
| `conversation.session.header.utilities` | list/session | 「妈妈模式」徽章(💗 + 字) |
| `conversation.hero.brand.mark` | **single**/root | 空会话标题前的大心心(shipped 本来就空,纯新增) |
| `conversation.chat.assistant-actions` | list/session | 每条回复旁边的「抱抱」 |
| `settings.general.item` | list/root | 装饰开关(存在浏览器本地) |
| `sidebar.brand.mark` | **single**/root | 妈妈标记(不是 mom 会话就渲染官方鲸鱼) |
| `sidebar.brand.name` | **single**/root | 妈妈字标(同上) |
| `shell.overlay` | list/root | 背景人物(见 §4) |
| `shell.overlay` | list/root | 飘落爱心,**默认关**(`SURFACES.ambientOverlay`) |

界面开关在 `dsh-mom-ui/lib/client.js` 顶部的 `SURFACES`——**客户端插件拿不到 config**,所以开关只能写在代码里。

### `priority: -1` 是必须的,不是风格

`sidebar.brand.mark` 是 `single` 插槽,`priority` 默认 0,而官方 `brand-official` 正好拿默认值注册。**同优先级会直接抛错**,整个客户端插件就挂了。所以本插件用 `-1` 明着盖住它。`test/smoke.mjs` 有一条盯着这件事。

### 主题

走 `ctx.theme.overrideTokens()`(25 个 `--dsw-alias-*`,light/dark 各一套值),订阅 `ctx.sessions.list` 切换——**不动注册表、不写用户偏好**,离开 mom 会话即还原;**选中「妈妈模式」的那一刻就生效**,不用等第一轮对话。

> ⚠️ **token 名必须真实存在。** 写到不存在的变量上只会悄悄用兜底值,不报错。`--dsh-composer-card-max-width` 是真实存在的那一个。

### 两处只能改文本的文案

| 字 | 归谁 | 为什么没有正规改法 |
|---|---|---|
| `深度求索中`(思考中) | `dsh-client-ui-chat` | 在 `chat` locale 命名空间里,而注册表**每个 (命名空间, 语言) 只能一个占用者**(`register` 直接抛);它的 Config 没有文案字段;`RunningStatus` 由 chat 视图自己的组件树渲染,**不是插槽** |
| 输入框 placeholder | `dsh-client-ui-conversation` | `InputBar` 从自己的命名空间取;composer bar 是 `single` 座位,没有占用者能顶掉;Config 同样没有文案字段 |

所以只剩**改已渲染的文本**这一根杠杆:靠 `[data-chat-running]` / `[data-composer-placeholder]` 这类稳定 data 属性定位,外加 `MutationObserver`。两条都在 `client.js` 里各有一个 `ctx.effect`。要记住的:

- **思考中那条要连装饰层一起改。** `TextShimmer` 把同一句话渲染**两次**:保留那份是**文本节点**,跑马灯那份**没有文本节点**——文字在 `data-shimmer-text` **属性**里,靠 CSS `content: attr(...)` 画出来。只扫文本节点的话,标签对了、**跑马灯还在说「深度求索中」**(漏过一次)。`test/smoke.mjs` 两种形状各盯一条。
- **只换前半句。** 引导语换成 `想要妈妈做什么`,后面 `, / 调用指令, @ 文件或对话` 那一截是**从 host 原句里切下来的**,不是重打一遍——`/` 和 `@` 的说法归 host 管。
- **比的是整句,不是前缀。** 只有和出厂整句一模一样才换,所以情境 placeholder(会话不可用 / plan / 选工作区 / 插话提示)全部原样保留。
- **新会话那句也要改。** 空会话里 composer 走 `variant: 'hero'`,`ConversationContent` 传的是 `placeholder.hero`(「描述你想要构建的内容, …」),**不是** `placeholder.default`。只改后者,新会话输入框还是出厂那句。
- **三处载体都得改。** 可见的 `[data-composer-placeholder]` 文本节点、编辑区的 `data-placeholder`、以及它的 `aria-label`——contenteditable 没有 placeholder 属性,**那串字就是它的无障碍名**;只改前两处,读屏软件念的还是出厂那句。
- **改完要能改回去。** 这是踩过的坑:切到别的模式 placeholder 不复原。React 帮不上忙——切换时 host 用出厂那句重新渲染,可那**正是它上一次写过**的内容,reconcile 认为没变,**一个字都不写**,于是插件改过的 DOM 活过了切换。修法是每个载体各自记住**改之前 host 写的是什么**,离开 mom 模式时写回去。记的**只能是出厂那句**(只有值确实命中出厂表才记),所以 host 中途把 default 换成 hero 时记录会跟着更新。复原写回会再触发 observer 一次,那时值已是出厂句、记录已丢,所以**收敛**。
- **中英各一份。** 占位符表里存的是各语言的**出厂整句**,两种语言的引导语和尾巴都不一样。

> ⚠️ **「深度求索中」那条现在还没做复原。** 切换模式后思考中的标签会留着 `❤ 妈妈在想`。同一个毛病的另一处,还没修。

---

## 4. 背景人物与图片路由

`ds_mom.png` 是这份素材**唯一的一份**,仓库里没有任何派生物。三件事必须同时对。

### 4.1 图必须自带 alpha

现在是 RGBA 1024×1536,作者抠好的。**换成不带 alpha 的图,人物会带一整块背景色出现在侧栏旁边**——抠底那条流水线(从四边泛洪、近黑判据 `max(通道) <= 20`、2px 剪影模糊 + 亮度斜坡收边,专门对付"纯黑底 + 人物")连同工具一起删掉了,因为它的产物是一份**派生物**,而这份设计里派生物正是要消掉的东西。抠底现在是作者的活。

> 留一个实测数字备用:**烤进图里的棋盘格**最难办——有人把透明图往白棋盘上一存就导出,看着像透明,其实是画上去的(两种近白色调 241–246 / 253–255 交替,而人物米色上衣只有 233,**只差 6 级**)。这种源图不要用。

### 4.2 图由 host 半边发,client 里零字节

`dsh-mom-ui/lib/index.js` 用 `ctx.webServer.register({ kind: 'exact', path: '/mom/art.png', handler })` 把它发出去;`lib/client.js` 只留一个**裸路径**(`MOM_ART_PATH`,没有 query、没有版本号)。

**为什么必须这样,而不是内联**:`dsh-client-modules` 每个插件只发**一个**文件(`exports["./client"]`),没有静态资源路由,模块表也只暴露别的插件行。所以第二份文件**只能**内联,或者由 host 自己发。用户要的是"换图自动生效",内联做不到。

**两个决定支撑"自动生效",都是承重的:**

1. **URL 不能带缓存令牌。** `?v=<hash>` 本身就是"图变了要改代码",那还是构建步骤。所以新鲜度归服务端:响应头 `cache-control: no-store, no-cache, must-revalidate, max-age=0`,**故意不发 `ETag`/`Last-Modified`**——给了校验器就会换来 304,而 304 意味着浏览器继续用旧图。
2. **handler 每次请求都重新读盘**(不是启动时读一次)。

于是:换掉 `ds_mom.png` → 刷新页面 → 就是新图,**不用重启 host、不用重装、不用跑工具**。

> 路由**挂在 bundle 层(profile 层),不能挂预设里**。预设是**按会话**挂载的,浏览器完全可能开在 `standard` 会话上——那时图会 404。所以它在没有 mom 会话时也一直开着;代价是多一条常驻路由,内容不敏感(就一张图)。

**代价,说准。** 图不再进 bundle,`client.js` 只有 45 KB;代价是那 1.6 MB 走一次 HTTP:

| | 内联时代 | 现在 |
|---|---|---|
| `client.js` | 2449 KB(gzip 1837 KB) | **45 KB** |
| 图片 | 在其中 | 1.6 MB,`no-store` **每次都重新取** |

`no-store` 是这条功能的代价,不是疏忽——它是"换图自动生效"能成立的**唯一**方式。要省这 1.6 MB 就得允许缓存,那也就回到"换图要改版本号"。**这两件事只能选一个。**

### 4.3 为什么不裁了,以及几何为什么自洽

内联时代必须裁:编码后的宽高比会喂给组件的尺寸求解,而裁剪框 aspect(0.454)与整幅画布(0.667)差很多,用错就把她画成 68% 大小。

改成"host 发原图 + CSS 渲染"后这条约束换了位置,而且现在自洽:

- 组件建的那个盒子**本来就按图片自己的宽高比**算(`byHeight = heightCap × W / H`,`height = width × H / W`);
- CSS 是 `background-size: contain`,图片**正好铺满**那个盒子,没有信箱边、没有二次缩放。

几何:`W/H = 1024/1536 = 0.667`,设计宽 280 → **280×420**。**和裁剪时代渲染出来的数一样**——`ART_MAX_WIDTH` 约束的是"她"的宽度,而她在画布里的宽度占比(682/1024 = 0.666)和 698/1024 基本相同。除了画布自带的**透明边距**,视觉结果一致。

> ⚠️ **换素材唯一要注意的:保持画布宽高比。** 图片尺寸**不参与构建**,只有 `client.js` 顶部那两个常量声明画布是 `1024×1536`。同比例(2:3 竖图)直接换;换别的比例要**同时改那两个常量**。它们不在任何缓存路径上(`client.js` 走正常模块 rev),但改完要**刷新页面**。

### 4.4 她站在哪儿

`shell.overlay` 是 `z-index: 20`,而且在所有列之后渲染,所以**没法把人物放到内容下面去**(那得改 DSH 自己的层)。正确做法不是铺满屏幕盖住对话,而是放进**侧边栏和居中卡片之间那块空档**:

- 位置 `left = 侧边栏实测宽度`,贴底 → "紧靠侧边栏";
- 溢出部分(`ART_BLEED`)由右侧渐变 mask 吃掉,卡片上永远不留硬边;
- 高度按宽高比反推、上限 = 视口高度(「正好触顶」);**尺寸只有触顶才会变**,空档不管尺寸。

| 常量 | 默认 | 作用 |
|---|---|---|
| `ART_OPACITY` | `0.5` | 整体透明度,兜住"空档估算偏大"的后果 |
| `ART_FADE_LEAD` | `90` | 在卡片边缘**之前** 90px 开始淡出 |
| `ART_BLEED` | `24` | 允许越过空档的最大距离(唯一可能盖到内容的部分) |
| `ART_MAX_WIDTH` | `280` | 宽度上限(= 设计尺寸)。高度上限就是它:280 ÷ 0.667 = **420px** |
| `ART_MIN_WIDTH` | `150` | **淡出下限**:空档再窄,透明度也只按 150/280 衰减 |
| `ART_MAX_HEIGHT_VH` | `100` | 高度上限 = 视口高度。**不要改回百分比** |

**尺寸只跟"顶端"走。** 她 `bottom: 0` 贴底,所以唯一可能撞到的是**顶端**:

```
高度上限 = min(420, 视口高度)      // 100vh,不是百分比
她的宽度 = 高度上限 × 0.667
```

| 视口高度 | 尺寸 | 状态 |
|---|---|---|
| 1200 / 1440 / 2000 | 280×420 | 满尺寸 |
| 420 | 280×420 | 正好触顶 |
| 820(桌面默认) | 280×420 | 满尺寸 |
| 400 | 267×400 | 触顶,随窗口缩 |

> ⚠️ 这里曾是 `ART_MAX_HEIGHT_VH = 78`(按视口比例缩)。问题是"视口变矮了"和"她装不下了"这两件事它分不开,所以两种情况都缩——**屏幕还有富余她也变小**。改成 100 之后,比例上限只在她真的触顶时生效。

**空档只管一件事:她盖到卡片多少、因此要暗多少。** 中列宽 1020(桌面 1280 默认)/1200/1350/1372 对应透明度 0.27/0.35/0.48/0.5。**代价是重叠,安全性由 mask 兜住**:淡出必须在**文字开始的位置就归零**(`fadeTo = 空档 + ART_BLEED`),实测各尺寸下**文字所在列的 alpha 都是 0.0%**。

> 淡出**不能**拉满她整个宽度那样做——试过,文字列会剩 ~18% alpha。终点定在文字列,既守住可读性,又让她保持满尺寸。

**几何从哪来**:`PanelInfo` 只有 `activePanelId` 没有尺寸,frame 的 class 是 CSS-module hash。但 AppFrame 把 `grid-template-columns` 写在**行内**,所以读它的 computed 值就是权威来源——`MutationObserver`(侧栏折叠、拖拽会重写行内样式)+ `ResizeObserver` + window resize 保持同步。

---

## 5. 两个名字,两套解析基底

这是这个 bundle 里最容易搞错的地方,实测出来的:

| 行 | 名字 | 相对谁解析 |
|---|---|---|
| 插入的客户端行 | `./dsh-mom-ui/lib/index.js` | **所在 patch 文件**(这个包目录) |
| 预设里的 agent 行 | `dsh-mom-preset`(本包包名) | **profile 目录**——`mountPreset` 用的是**声明者**(registry)的解析基底,不是这张 patch 的 |

写 `./dsh-mom-mode/index.js` 时 roster 把预设标成 `broken: mom-mode (./dsh-mom-mode/index.js): never started`,因为它去 `<profile>/dsh-mom-mode/…` 找了。裸包名会从 profile 的 `node_modules`(符号链接所在)解析,所以 agent 半边按**包名**引用。

为了让它成立,本包 `main` / `exports["."]` 指向 **`mom-mode.js`**——「一个包既是 profile 层、又是插件」,shipped 的 `@deepseek-ai/dsh-web-app` 正是这个形状。所以 agent 半边**不需要自己的包**:它没有包名,也没人按名字 import 它,只是这个包的入口文件(早先那个 `dsh-mom-mode/` 目录连同 `"type": "module"` 占位 manifest 因此删掉了)。

**两个名字都不是绝对路径**,所以仓库可以随便搬家,只要重装一次 `install_bundle`。

---

## 6. 包边界(`dsh-mom-ui` 为什么必须独立命名)

`dsh-client-modules` 对**每个声明了 `dsh.client` 的包名**保留一个活跃 Loader 源,`reconcilePackage` 在同一个名字解析出**第二个源**时直接抛错:

```
client-modules: package <name> resolves from multiple active Loader sources: …; remove one entry
```

而这个 bundle 有**两条同时活跃**的行:bundle 层插入的 `mom-ui`(`./dsh-mom-ui/lib/index.js`)和预设的 `mom-mode` 子行(本包包名)。今天安全,是因为**两条都不解析到声明了 `dsh.client` 的包**——浏览器半边活在自己的名字下,Loader 只看见它一次。

**把浏览器半边合进根包,就会让两条行指向同一个 client 包**:fiber 失败 → `window.__DSH_BOOT__` 不注入 → **整个 Web 客户端黑屏**。浏览器侧拦不住,host 已经先死了。

所以那个包名是**承重的**。但它**不能**变成可独立安装/发布的单元:它在 mom 会话之外什么都不渲染,单独装是死代码;而第二条安装路径**正是**上面那个双 entry 错误。

它跟根包一起写在 `pnpm-workspace.yaml`(和根 `package.json` 的 `workspaces`),是把边界**写明**,不是加一条路。`test/bundle.mjs` 有专门的契约段盯着:不得声明 `dsh.bundle`、不得带 patch 文件、不得被任何 Loader 行或源码按**包名**引用、workspace 声明必须和目录同名。

---

## 7. 会话门控:必须用 `retainedBy.mainView`

⚠️ **判断"现在看的是哪个会话"必须用 `retainedBy.mainView`,不能用 `state.current`。**

会话列表快照的形状是 `{ids, byId, phase, projectionsBySession}`——**根本没有 `current` 这个字段**(见 `@deepseek-ai/dsh-api-session-controller` 的 `lib/client.js`)。当初那份审计文档写错了形状,代码和测试的假快照都跟着错,于是 `state.current` 恒为 `undefined`:**暖色主题、侧栏品牌、背景人物、设置行全都永远不生效**,而测试照样全绿——因为那个 `current` 是测试自己捏出来的。

现在门闸走 `onScreenSession()`,和 shipped 的 `dsh-client-ui-agent-preset` 同一个判据。`test/smoke.mjs` 的假快照也照**生产形状**造,还有一条专门盯着"快照里不许再冒出 `current`"。

**这类 bug 的形状值得记住**:门控写错不报错,是静默失效;而如果测试的假数据比生产"更宽容",测试会一直是绿的。改门控时先确认快照形状。

---

## 8. 版本门与快照策略

`peerDependencies` 声明 **`@deepseek-ai/dsh: ^0.2.0-0`**,这不是装饰:

- 预设的 composition 是内置 `standard` 预设的**手抄快照**,里面每个模块名都必须是那个版本里真实存在的包。换到别的线,有些名字不存在——**Loader 解析不出名字不是"少个功能",是整个预设挂载失败**,roster 标成 `broken`,于是任何会话都选不中它。
- host 的兼容性检查读的就是 `peerDependencies`;**没有这个字段它会直接返回 `undefined`**,等于永不报警。

> ⚠️ **为什么是 `^0.2.0-0` 而不是 `^0.2.0`。** semver 的预发布规则下 `^0.2.0` **不接受** `0.2.0-rc.2` 这样的运行时版本(实测:`evaluatePluginCompatibility` 判拒绝)。加 `-0` 才能覆盖 `0.2.0-*` 预发布以及之后的正式版。这种地方不能靠猜。

> ⚠️ **`autoInstallPeers: false` 也是承重的。** 声明 peer 会让 pnpm 12 默认把整个 harness(~1.4 GB,带原生构建脚本)**装进本仓库的 checkout**,而 `peerDependenciesMeta.optional` **挡不住**。仓库里读一个预设不该拖这个。设上之后 checkout 稳定在 16K,而且装进用户 profile 时也只加 `dsh-mom-preset` 一个包。

**漂移是只报不判的。** `test/bundle.mjs` 会打印与内置 `standard` 的漂移(哪些行多了、少了、改了),但它**不判失败**:快照是故意的,自动跟随时上游一改就可能悄悄换掉它的行为。升级 DSH 之后照着报告把 `cordis.patch.yml` 重新对齐。

---

## 9. 桌面端

**代码不用改。** 桌面应用是同一份 Web 前端外面一层 Electron 壳:`apps/desktop/src/main.ts` 对 `app://app` 这个源直接把 `@deepseek-ai/dsh-web-frontend/dist` 端出去,其余请求转发给同一个 Host。所以客户端插件、插槽、`window.__ModuleLoader__`(由 `dsh-client-modules` 注入,与 Web 应用无关)全都一样。

两个容易误判的点:

- **`"platform": "web"` 不是"只能在网页用"。** `dsh-client-modules` 只认这一个值(`decl.platform !== 'web'` 就跳过),shipped 的客户端插件**全都**写 `web`。
- **桌面 profile 的 `pnpm-workspace.yaml` 没有 `cordis` / `schemastery` 的 `overrides`**,Web profile 有。本插件两个 host 半边**一个包都不 import**,所以那份 overrides 对我们没意义。

**要改的是安装位置:桌面有自己独立的 profile。**

| profile | 给谁用 |
|---|---|
| `~/.dsh/profiles/web` | Web / CLI |
| `~/.dsh/profiles/desktop` | 桌面应用 |
| `<harness>/.dsh-build/home/…` | `pnpm dev:desktop`(**第三个 home**,`dev` 把 `DSH_HOME` 指到仓库里) |

**别指望在 Web 会话里装到桌面去**:插件管理器**明确不能改别的 profile**,只能动启动器给它的那个。两条路:桌面应用自己的「插件」页(走同一个管理器,最稳),或 CLI `dsh plugin --profile desktop add <路径>`(**这条只跑 pnpm,`dsh.profile.bundles` 还得另外加**,两步)。

> ⚠️ 桌面 profile 必须**先启动过一次桌面应用**才会创建;CLI 拒绝在不存在的 profile 上操作。另外装之前**完全退出应用**——包操作要拿 profile 写锁。

**装饰开关是按 origin 存的**(`localStorage` 的 `dsh-mom-ui:decor`),Web 是 `localhost:3080`、桌面是 `dsh-app://app`,所以**两端各有一份开关状态**,互不影响。

---

## 10. 测试怎么跑、为什么这样设计

```bash
pnpm test              # smoke + bundle
pnpm test:noharness    # 显式声明"没有 harness",会跳过解析类检查并说明跳了什么
```

`test/bundle.mjs` 里那组**名字解析**是唯一能挡住整条预设失效的检查:任何一个模块名解析不出来,挂载整个失败,而其余检查(YAML 合法、声明字段齐全)全都照过。它拿**装好的 harness** 逐行解析名字,另外验证每个相对路径**在 patch 旁边真的存在**。

⚠️ **harness 缺失时默认是失败,不是跳过。** 没有 harness 时它以前打印一个绿色的通过数,而实际上一条解析都没跑——这正是历史上真出过事的地方。现在默认 `FAIL`,只有显式 `--allow-missing-harness`(或 `test:noharness`)才能过,而且会**逐条列出跳过了什么**。CI 会先尝试装 harness,装不上才用这个开关,并打一条 warning 点名跳过了什么。**CI 不会手滑带这个开关。**

联机手验:在新会话选择器里点「妈妈模式」→ 配色立刻变暖、侧栏字标变成「妈妈模式」(背景人物要等中间栏量出足够空档);切回「标准模式」→ 立刻还原、侧栏回到鲸鱼;开两个会话(一 mom 一 standard)来回切 → 配色和品牌跟着切。
