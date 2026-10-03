# 妈妈模式 for DeepSeek Harness

一个 DeepSeek Harness **agent 预设**：温和、说人话的妈妈人设，外加一段贯穿全程的行为准则（先接住人再处理事、别拿否定词开头、把失败说小），以及它的浏览器半边——暖色配色、会话徽章、「抱抱」按钮和一位背景人物。

**只有选中这个预设的会话会变**，别的会话一点都不受影响。

> **English.** A DeepSeek Harness **agent preset** with a warm, plain-spoken persona,
> plus its browser half (warm palette, badges, a Hug action, a background figure).
> Everything is gated **per session** by selecting the preset; every other session
> renders the shipped UI untouched. Requires DSH `0.2.x`. The rest of this file is
> Chinese; the detailed design and maintenance notes are in [`docs/design.md`](docs/design.md).

---

## 安装

这是一个**标准 bundle**：`package.json` 声明 `dsh.bundle.patch` → `cordis.patch.yml`。装它只有一件事要做：**把这个目录交给 harness 的安装器**。

### 先确认三件事

| 前置 | 怎么确认 | 不对会怎样 |
|---|---|---|
| DSH 是 **`0.2.x`** | 见下面「支持范围」 | 版本门会拒绝安装，或预设挂载失败 |
| 你装的是**哪一个 profile** | Web/CLI → `web`；桌面应用 → `desktop` | 装错地方 = 在界面上看不到「妈妈模式」 |
| harness 在运行，或 `dsh` 可用 | 有会话就用路线 A；只有终端就用路线 B | 两者都没有就先起 harness |

> **`install_bundle` 也可以直接从 GitHub 装**（用 `github:` 规格），本地路径这条路则要先 clone，但**不要**在这台机器上跑 `pnpm install`：仓库没有依赖，而且 DSH 那个 peer 被 `autoInstallPeers: false` 挡着，否则会把 1.4 GB 的 harness 拖进 checkout。

### 路线 A：会话里让 agent 装（最省事，Web 和桌面都适用）

在任意会话里说一句，或直接用工具：

```
plugin_manager  action: install_bundle   target: <这个仓库的绝对路径>
```

直接从 GitHub 装也一样（安装器认 git 规格）：

```
plugin_manager  action: install_bundle   target: github:beyond-1234/dsh-mom-preset
```

`target` 必须是**仓库根目录**（有 `package.json` 的那一层），不是 `dsh-mom-ui/`。

### 路线 B：只有终端

```bash
dsh plugin --profile web add /绝对路径/to/dsh-mom-preset
```

`dsh` 不在 PATH 上时（harness 是 `npx` 起的）用 npx 形式，版本要和你的部署一致：

```bash
npx @deepseek-ai/dsh@0.2.0-rc.2 plugin --profile web add /绝对路径/to/dsh-mom-preset
```

⚠️ **桌面 profile 在这条路上是个例外。** CLI 对 `--profile desktop` **只跑 pnpm、不会**把包加进 `dsh.profile.bundles`，所以那条路要**两步**：先跑上面的 `add`，再手工把 `dsh-mom-preset` 追加到 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 末尾。桌面应用自己的「插件」页（走的是路线 A 那个装法）没有这个问题——**桌面端优先用它**。

### 然后重启

**重启 host**，再刷新一次浏览器页面，在新会话的选择器里选「妈妈模式」。

`install_bundle` 做两件事：`pnpm add <目录>`，再把这个包加进 profile 的 `dsh.profile.bundles`。**没有自定义安装脚本。** 本地目录装进来是**符号链接**不是拷贝，所以 patch 和插件都**原地读仓库**——以后改源码只要重启，不用重装。

**安装单元只有一个。** 仓库里是两个包——根包（bundle + agent 插件）和 `dsh-mom-ui`（浏览器半边）。后者保留自己的包名是**机制要求**，但它是根包的 workspace，不是第二个可安装单元。

### 装完长什么样 / 怎么确认装上了

profile 的 `package.json`（`~/.dsh/profiles/<名字>/`）会多出这两处——这是出问题时最该先看的地方：

```jsonc
{
  "dependencies": {
    "dsh-mom-preset": "link:/绝对路径/to/dsh-mom-preset"   // GitHub 装则是版本号
  },
  "dsh": { "profile": { "bundles": [
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    "dsh-mom-preset"          // ← 追加在末尾
  ] } }
}
```

还有 `node_modules/dsh-mom-preset` 应该是一个**符号链接**指回你的仓库。

三条自检：

```bash
# 1) 包装上了，而且是符号链接
ls -l ~/.dsh/profiles/web/node_modules/dsh-mom-preset

# 2) patch 是原地读你的仓库（两条路径应指向同一个文件）
realpath ~/.dsh/profiles/web/node_modules/dsh-mom-preset/cordis.patch.yml

# 3) 重启 host 之后，背景人物的路由在发货
curl -sI http://127.0.0.1:<端口>/mom/art.png    # 期待 200 + content-type: image/png
```

三条都正常但选择器里还是没「妈妈模式」→ 多半是**没重启 host**。

### 卸载

```
plugin_manager  action: remove_bundle   target: dsh-mom-preset
```

或 CLI `dsh plugin --profile web remove dsh-mom-preset`。

### 支持范围

需要 **DSH `0.2.x`**（`peerDependencies` 声明为 `^0.2.0-0`）。这不是装饰：预设的 composition 是内置 `standard` 预设的**快照**，里面的模块名必须是那个版本里真实存在的包；换到别的版本线，Loader 解析不出名字会让**整个预设挂载失败**，任何会话都选不中它。装在 `0.2.x` 上通过；装到 `0.3.0` 或更高会被**拒绝**，并告诉你怎么显式承担风险（`dsh plugin --profile web allow-version ...`）。

**升级 DSH 之后预设不见了**：`node test/bundle.mjs` 会打印与内置 `standard` 的漂移报告（哪些行多了、少了、改了），照着把 `cordis.patch.yml` 重新对齐即可。这一步不会自动发生——快照是故意的。

---

## 它会改你界面的什么

**它不止加东西，它还盖住了两个官方组件、改了两句官方文案。** 装之前值得先看一眼：

| 改的东西 | 性质 |
|---|---|
| 妈妈人设 + 一段行为准则 | **新增**（系统提示词里多一段），只在 mom 会话 |
| 暖色配色（25 个 `--dsw-alias-*` token） | **覆盖**主题 token，只在 mom 会话，退出即还原 |
| 侧栏标记 + 字标 | **盖住**官方鲸鱼和字标；非 mom 会话显示官方原样 |
| 会话徽章、「抱抱」、设置行、空会话大心心 | **新增**，只在 mom 会话 |
| `深度求索中` → `❤ 妈妈在想` | **改已渲染的文本**（没有正规接口，只能改 DOM），只在 mom 会话 |
| 输入框 placeholder | 同上，三处载体一起改，只在 mom 会话 |
| 背景人物（妈妈版 DS 娘） | **新增**，一条 `GET /mom/art.png` 路由 + 覆盖层，设置里可关 |

后两行是**没有正规接口**才退到 DOM 的，代价是：官方哪天改了那两句的字，改写就不再命中（那时它**什么都不做**，不会改错）。这也是为什么它按会话门控、并且离开 mom 会话要能**改回去**。

---

## 用法

### 调语气

行为准则的正文在 **`cordis.patch.yml`** 的 `mom-mode.config.policy`（不在 JS 里）。改完**重启 host**、新开会话生效，不用重装。

```yaml
- id: mom-mode
  config:
    policy: |-        # ← 行为准则正文，改这里
      ...
```

这段文字**是给模型读的，会直接影响模型怎么说话**：要用妈妈自己会说的话来写，别写成「底线／绝不可以／必须」那种清单——清单式的口气会渗进回复里。想删掉某个说法，**别把那个说法本身写进 policy**，只写正面说法；被禁的原句留给 [`docs/reply-style.md`](docs/reply-style.md)（那张表模型读不到）。

写之前请读 [`docs/design.md`](docs/design.md) §2——那三条约束都有测试盯着，其中两条是踩过坑才定下来的。

### 改界面

界面开关在 `dsh-mom-ui/lib/client.js` 顶部的 `SURFACES`（客户端插件拿不到 config，所以开关写在代码里）。默认关着的有满屏飘落爱心（`SURFACES.ambientOverlay`）。

### 换背景人物

**换掉 `ds_mom.png` 就完了**——刷新页面即可，没有工具要跑、没有东西要重建。

两条要求：

- **图必须自带 alpha**，否则人物会带一整块背景色出现在侧栏旁边。
- **宽高比要和现在这张一致**（1024×1536，2:3 竖图）。比例不同的话，还要同时改 `dsh-mom-ui/lib/client.js` 顶部声明画布的 `MOM_ART_WIDTH` / `MOM_ART_HEIGHT` 两个常量。

### 改源码之后

都**不用重装**，只要重启：

| 改了什么 | 怎么生效 |
|---|---|
| `cordis.patch.yml`（语气、composition） | 重启 host + 新开会话 |
| `mom-mode.js` | 重启 host |
| `dsh-mom-ui/lib/client.js` | 重启 host + 刷新页面 |
| `ds_mom.png` | **刷新页面**（不用重启） |

---

## 目录

```
mom-mode.js            agent 面插件（零 import），也是本包的根入口
cordis.patch.yml       唯一的 patch：预设声明 + composition + 行为准则正文
dsh-mom-ui/            Web UI 插件（手写 bundle，没有构建步骤）
  lib/index.js         host 半：发 /mom/art.png
  lib/client.js        主题 + 插槽界面 + 两处 DOM 文案改写
ds_mom.png             背景人物素材（唯一一份）
docs/                  design.md（维护者）· reply-style.md（语气对照表）· ui-audit.md（历史留档）
test/                  smoke.mjs（逻辑与几何）· bundle.mjs（结构与包边界）
```

---

## 验证

```bash
pnpm test              # smoke + bundle，除 Node 外无依赖
pnpm test:noharness    # 显式声明"这台机器没有 harness"，会跳过解析类检查并说明跳了什么
```

`test/bundle.mjs` 里那组**名字解析**是唯一能挡住整条预设失效的检查——预设里任何一个模块名解析不出来，挂载就整个失败，而其余检查全都照过。**没有 harness 时它默认失败**，不会静默跳过。

联机手验：

1. 新会话选择器里点「妈妈模式」→ 配色立刻变暖、侧栏字标变成「妈妈模式」（不用等第一轮对话；背景人物要等中间栏量出足够空档）。
2. 切回「标准模式」→ 暖色立刻还原、侧栏回到鲸鱼。
3. 说一句话 → 回复语气是妈妈的，左上出现徽章。
4. 开两个会话（一 mom 一 standard）来回切 → 配色和品牌跟着切。

---

## 已知限制

- **改任何一边都要重启 host**（`ds_mom.png` 除外）。这个版本的 web bundle 没挂 host 侧 patch 热重载。
- **UI 插件代码对所有会话可见**——客户端平面没有"按预设装配"，这是固有限制；它靠每个界面自己门控来保住 opt-in。
- **预设是 `standard` 的快照**，升级 DSH 不会自动同步（见上面的「支持范围」）。
- **「深度求索中」那条文案切换模式后不复原**：切回标准模式，思考中的标签会留着 `❤ 妈妈在想`。同一个毛病在 placeholder 上已经修了，这条还没修。
- **桌面端还没在真机上验过**——本机没装桌面应用。代码与 Web 完全共用，要改的只是**安装位置**（桌面有自己独立的 profile）；详见 [`docs/design.md`](docs/design.md) §9。
- 背景人物的设计约束（为什么不能裁剪、为什么 `no-store`、尺寸怎么解）见 [`docs/design.md`](docs/design.md) §4。
