# semantic_zoom 行为清单

来源：Flutter 包 semantic_zoom v0.4.0（作者 Roshen De Zoysa，MIT）。
仓库 https://github.com/Roshendz/semantic_zoom ，提交 `f5ae52f`。
读过的文件：`lib/src/*.dart`、`README.md`、`CHANGELOG.md`、`example/lib/main.dart`、`test/*.dart`。
在线演示 https://roshendz.github.io/semantic_zoom/ 用 Playwright（Chromium，393×852）实际操作过。

每条后面的 `[R-xx]` 是编号。React 版的实现和测试按这个编号对照。
“React 版”一列写实现状态：✅ 已做；≈ 做了但有差异；✗ 没做。最终状态见文末对照表。

---

## 1. 数据模型：一条 token 流

- [R-01] 一段多层级文字存成**一条 token 流**，不是 N 份字符串。
  每个 token 有 `text`、`minLevel`、`maxLevel`（可空）、`glued`、`style`、`link`。
  token 在层级 L 可见的条件：`L >= minLevel && (maxLevel == null || L <= maxLevel)`。
  （`leveled_text.dart` `LeveledToken.isVisibleAt`）
- [R-02] `maxLevel` 只在“被改写掉的词”上出现。长版本删掉某个词时，
  这个词的 `maxLevel = v-1`，在 v-1 → v 之间淡出。
- [R-03] `LeveledText.maxLevel` = 所有 token 中 `maxLevel==null ? minLevel : maxLevel+1` 的最大值。
- [R-04] `textAt(level)`：可见 token 用空格连接；`glued` 的不加空格；
  段落分隔符 `\n` 只在前面已有内容时才生效（连续或开头的分隔符被折叠）。
- [R-05] 段落分隔符 `\n` 在所有层级可见（`minLevel=0`），布局时多个段落之间加 `paragraphGap`（默认 6 逻辑像素）。

## 2. 标记解析 `LeveledText.parse`

- [R-06] 普通词 = 层级 0；`[...]` = 层级 1；`{...}` = 层级 2；`\n` = 段落分隔。
  嵌套或不配对的括号抛 `FormatException`。
- [R-07] 行内样式：`**粗体**`、`*斜体*`、`[文字](url)` 链接、`\` 转义任意字符。
  `[...]` 后面紧跟 `(url)`（url 中无空白）才算链接，否则是层级 1。
- [R-08] `*` 规则同 Markdown：开符号后面必须紧贴非空白，闭符号前面必须紧贴非空白。
  所以 `5 * 3` 里的 `*` 保持原样。
- [R-09] 标点 `.,;:!?…` 单独成一个 `glued` token。目的是让“Porto”和“Porto.”在对齐时算同一个词。
- [R-10] token 是否 `glued`：前面没有空白、且不是第一个 token 时为 true。

## 3. 分词：中日韩、泰文按字

- [R-11] 无空格书写的文字（泰、老挝、缅甸、高棉、CJK 部首、假名、注音、CJK 统一汉字及扩展、
  兼容字、全角半角形式）**每个字素簇（grapheme）一个 token**。
  其余连续字符（拉丁字母、数字、emoji）整段保留。`我用Flutter开发了3个App` → `我 用 Flutter 开 发 了 3 个 App`。
  （`_isUnspaced` 的码位范围 + `characters` 包做字素切分）
- [R-12] 切出来的第 2 个及之后的片段都是 `glued`。作者写的空格保留（`中文 English 中文`）。
- [R-13] 有空格的语言（英文、僧伽罗文、韩文）按空格切词。僧伽罗文的 ZWJ 连字留在词里。
- [R-14] 泰文按字素簇切，元音和声调符号跟着辅音走。

## 4. 多版本对齐 `LeveledText.fromVersions`

- [R-15] 输入是若干个纯文本版本，最短的在前。逐对相邻版本做**词级 LCS 对齐**。
- [R-16] 只拿“仍然存活”（`maxLevel==null`）的 token 和下一个版本做 diff。
  已在更早层级消失的 token 保持在流中原来的相对位置。
- [R-17] diff 结果三种操作：keep（保留，滑动）、delete（设置 `maxLevel=v-1`，淡出）、insert（`minLevel=v`，淡入）。
  同一处改动里，**delete 排在 insert 前面**，旧词在新词前面。
  回溯规则：`a[i]==b[j]` 就 keep；否则 `lcs[i+1][j] >= lcs[i][j+1]` 时 delete，再否则 insert。
- [R-18] 匹配大小写敏感：`Skin` 和 `skin` 是不同的词。
- [R-19] `requireSubsequence: true` 时，任何 delete 都抛 `ArgumentError`，错误信息带上第一个被删的词。
- [R-20] 空数组抛 `ArgumentError`。

## 5. 版本检查 `checkVersions`

- [R-21] 每对相邻版本算一次：`kept`（保留的非标点词数）、`added`（新增非标点词数）、`dropped`（被删的非标点词列表）。
  段落分隔不参与。标点集合额外包含中日文标点 `。、，．！？；：「」『』（）【】〈〉《》…・〜ー`。
- [R-22] `carryOver = kept / (kept + dropped)`，分母为 0 时为 1。
- [R-23] `isStrict` = 所有过渡都没有 dropped。`smoothness` = 所有过渡里 carryOver 的最小值；没有过渡时为 1。
- [R-24] `issues`（英文句子，原文照搬）：
  - 少于 2 个版本：`Provide at least two versions to morph between.`
  - 某层为空：`Level i is empty.`
  - 没有新增也没有删除：`Level v adds nothing to level v-1.`
  - 有删除：`Level v drops N word(s) of level v-1 ("a", "b", …); they will cross-fade.`（最多列 5 个，多了加 `, …`）
  - carryOver < 0.5：`Level v keeps only P% of level v-1; the change will look like a cross-fade, not a stretch.`

## 6. LLM 提示词 `LeveledPrompt`

- [R-25] `build({source, levels=3, levelDescriptions, instructions})`：
  - `levels < 2` 抛错；`levelDescriptions` 长度不等于 `levels` 抛错。
  - 默认描述：`a title of at most 6 words` / `one sentence of at most 25 words` / `the complete text`。
    超过 3 层时，中间层写 `a summary of about ${25*i} words`。
  - 正文结构：说明 → `Versions:` 编号列表 → `Rules:`（每个长版本包含前一版本的全部词、同序同拼写同标点，只插入；
    只用原文信息；纯句子可用 **粗体**；可选的额外说明；只回 JSON `{"levels": [...]}`）→ 生长示例（Knee review 4 句取前 levels 句）→
    `Source:` 和用 `"""` 包起来的去首尾空白的原文。
- [R-26] `parseResponse(reply)`：取第一个 `{` 或 `[` 到最后一个 `}` 或 `]` 之间的子串做 JSON 解析。
  所以 ```json 代码块和前后的闲聊都能容忍。
  接受 `{"levels": [...]}` 或裸数组。数组为空、含非字符串、JSON 无效都抛 `FormatException`。每个元素 trim。
- [R-27] 不内置模型调用。

## 7. 缩放值与层级

- [R-28] 控制器有一个**连续的浮点缩放值** `value`（0..maxLevel，回弹时可短暂越界）和一个**已提交的整数层级** `level`。
  默认 3 个层级，至少 2 个。
- [R-29] 控制器只在已提交层级变化时通知监听者（全局层级或单条层级）。`value` 每帧都变，不通过通知走。
- [R-30] 捏合映射：`raw = startZoom + log2(scale) × levelsPerDoubling`，`levelsPerDoubling` 默认 **1.6**。
  即两指距离翻倍走 1.6 级。
- [R-31] 越界回弹：`z<0` 时取 `z × 0.25`；`z>max` 时取 `max + (z-max) × 0.25`。
- [R-32] 速度：`v = 0.7·v + 0.3·(Δz/Δt)`（轻度平滑）。
- [R-33] 松手吸附：`projected = value + v × 0.12 s`，取 `round(projected)` 再夹到 [0, max]，
  然后用弹簧从当前值动画到目标，带入松手速度。
- [R-34] 弹簧：质量 1、刚度 320、阻尼比 0.9（略欠阻尼）。容差：距离 1e-3、速度 1e-3。
- [R-35] **松手那一刻就提交层级**（`animateToLevel` 先 `_commit` 再跑弹簧），监听者立刻收到新层级。
- [R-36] 层级变化时触发一次触感反馈（`HapticFeedback.selectionClick`）。
- [R-37] 系统“减少动态效果”打开时，`animateToLevel` 直接跳到目标值，不跑弹簧。
  （原版在捏合过程中仍然连续插值；见差异表）

## 8. 每帧的词过渡（`_Frame`）

- [R-38] 每个 (层级, 宽度) 只排版一次并缓存。每个词的位置从真实段落排版里读出来（`getBoxesForSelection`）。
  捏合过程中**不测量文字**。
- [R-39] 当前帧：`lo = floor(z)`，`hi = min(lo+1, max)`，`move = easeInOutCubic(z - lo)`。
- [R-40] 位置：两个层级都有的词，位置 = `lerp(pos_lo, pos_hi, move)`；只在一边有的词，固定在它那一边的位置（原地淡入淡出）。
- [R-41] 条目高度 = `lerp(h_lo, h_hi, move)`。宽度不变。
- [R-42] 透明度：
  - `tIn = clamp(z - minLevel + 1, 0, 1)`
  - 新词淡入：普通层级用 `Interval(0.25, 1)`（线性）；**这一层有改写（有词被删）时**用 `Interval(0.45, 1)`，让新词晚到。
  - 有 `maxLevel` 的词淡出：`fadeOut = 1 - Interval(0, 0.4, easeOut)(clamp(z - maxLevel, 0, 1))`，让旧词早走。
  - 最终透明度取 `min(fadeIn, fadeOut)`。这样被替换的旧词和新词不会重叠出现。
- [R-43] 同一透明度的词合成一层绘制（性能）。
- [R-44] 链接词之间画带下划线的空格，让下划线连续。
- [R-45] 静止时（`|z - round(z)| < 1e-3`）且在 `SelectionArea` 里，换成真实的可选择文字，外观完全一致。

## 9. 锚点（滚动位置保持）

- [R-46] 手势开始时记下锚点条目及其“前沿”在视口中的位置：
  有手指 → 取手指中点下的条目；找不到 → 取第一个可见条目（`captureLeadingAnchor`）。
- [R-47] 每次布局后，若锚点条目的前沿位置变了，用 `scrollOffsetCorrection` 在**同一帧**内补偿滚动偏移。
  小于 0.5px 的偏差忽略。每帧最多补偿 3 次，防止和滚动物理打架。
- [R-48] 补偿不越过列表开头（但不动已有的过度滚动）。
- [R-49] 按钮 / 键盘 / `animateToLevel` 时锚定第一个可见条目。单条 `setItemLevel` 也锚定第一个可见条目。
- [R-50] 松手后弹簧结束、最后一帧布局完成后才释放锚点（post-frame）。
- [R-51] 手势在弹簧进行中重新开始：停掉弹簧，接管锚点。
- [R-52] `holdAnchor()`：返回一个释放函数。可叠加，最后一个释放时才放开锚点。用于按需加载导致的高度变化。
- [R-53] `jumpTo(0)` 后真的回到列表开头（修复了离屏条目高度估计导致停在半路的问题）。

## 10. 输入方式（`SemanticZoomDetector`）

- [R-54] 触摸捏合：用原始 `Listener` 跟踪触点，**不用** scale 手势识别器（列表拖动识别器会抢走第一根手指）。
  两根手指落下就开始；`scale = 当前两指距离 / 起始距离`；少于两根手指就结束。
- [R-55] 捏合过程中禁止列表滚动（`isPinching` 时 `NeverScrollableScrollPhysics`）。
- [R-56] 第二根手指落下就赢下手势竞技场，取消手指下面条目的点击、水波纹、长按。单指时让路，不影响点击和滚动。
- [R-57] 触控板捏合（PanZoom 事件）：两指滚动也走这里但 scale=1。|log2(scale)| ≥ 0.03 才开始捏合，否则让它滚动。
- [R-58] 网页 Ctrl+滚轮 / Safari 捏合（scale 信号）：每个事件把 scale 累乘；最后一个事件后 **160 ms** 没有新事件就当作松手吸附。
- [R-59] 键盘：Ctrl 或 ⌘ 加 `=`、`+`、小键盘 `+` → 下一级；`-`、小键盘 `-` → 上一级；`0`、小键盘 `0` → 回到 0 级。
  列表获得焦点后才生效（点一下列表就获得焦点）。
- [R-60] 手势开始时把所有单条层级清回全局层级（`_clearItems`，带动画）。
- [R-61] 弹簧进行中有新的单指按下：视为用户接管，释放锚点。

## 11. 单条展开

- [R-62] 每条的缩放值 = 全局值 + 该条的偏移量。`setItemLevel(id, L)` 把偏移量用同一个弹簧动画到 `L - level`。
- [R-63] `itemLevel(id) = round(level + target偏移)`，夹到 [0, max]。
- [R-64] 下一次捏合或 `animateToLevel` 把所有单条拉回全局层级（偏移量动画到 0）。
- [R-65] 示例里的点击规则：`next = itemLevel+1`；超过最大层级就回到全局层级。
- [R-66] `ExpandableLeveledText`：不需要列表和控制器的“展开更多”。每次点击进入下一级，最后一级再点回到第一级（`wrap`）。
  提供 `expand()` / `collapse()` / `next()`、`footerBuilder`、`onLevelChanged`。不做锚定。

## 12. 列表形态

- [R-67] 普通列表：锚点用条目的上沿。
- [R-68] 聊天列表（`reverse: true`）：第 0 条是最新消息，画在最底部。
  “前沿”是底部，所以没有手指时锚定**最新的可见消息**，其他消息向上长。
  `jumpTo(0)` 准确落到最底部。
- [R-69] 网格：每行取最高的卡片作为行高，卡片顶部对齐。
  `crossAxisCount` 固定列数，或 `maxCrossAxisExtent`：列数 = `max(1, ceil((宽 + 间距) / (最大列宽 + 间距)))`。
  网格内部就是“一行一个条目”的列表，所以锚点和单条展开照常工作。

## 13. 按需加载

- [R-70] `LeveledTextLoader`：先给短版，`ensureLoaded()` 只加载一次，并发调用共用同一个 Promise；失败记在 `error`，再次调用会重试，不抛异常。
  `LeveledTextLoader.versions({brief, load})`：结果是 `fromVersions([brief, ...loaded])`。
- [R-71] `LazyLeveledTextView`：这一条的缩放值 > 0.01 时开始加载（捏合、按钮、点击、读屏）。
  失败后只在下一次新的缩放开始时重试。已经放大着出现时立即加载。`eager` 可在显示时就加载。
- [R-72] 加载中显示 `loadingBuilder` 的内容（演示里是 2px 进度条）；失败显示 `errorBuilder(error, retry)`。
- [R-73] 加载完成后用 350 ms（easeInOut）的“揭示”动画，把可显示的上限从 0 升到最大层级，新词按正常过渡长出来。
  减少动态效果时直接到位。
- [R-74] 加载行出现/消失、揭示动画期间，调用 `holdAnchor()` 保持第一个可见条目不动。

## 14. 无障碍

- [R-75] 每条文字是一个“可调节”控件：读屏读到的是**当前层级（round(z)）的完整文字**，不是一个个词。
  值是层级名（`levelLabels`，默认 `Detail i of n`），上下滑动可调。
- [R-76] 链接作为链接播报，可点击。
- [R-77] 捏合不好发现，示例每个页面底部都有分段按钮（Highlights / Summary / Full），驱动同一个动画。
- [R-78] 系统文字缩放会被尊重。

## 15. 性能（原版 README 数据）

- [R-79] Galaxy A36（120Hz），1000 条富文本：捏合 96.9% 帧在 8.3 ms 内，99.1% 在 16.7 ms 内。
  手段：每级排版缓存；捏合只移动和淡化词；同透明度合层。

## 16. 演示页实测（2026-10-17，Chromium 393×852）

- [R-80] 首页是 Travel（6 天游记），底部分段按钮 Highlights / Summary / Full，再下面是 5 个标签：Travel、Health（网格）、Inbox（按需加载）、Chat（倒序）、Reads（单条展开）。
- [R-81] 用 CDP 发 15 个 Ctrl+滚轮事件（deltaY=-30）：一次走到 Full。手指位置下的 “Thu 19 Sep” 条目屏幕位置基本不变（约 521px → 520px）。
  注意：Playwright 的 `keyboard.down('Control') + mouse.wheel` 没触发原版缩放，要用 CDP `Input.dispatchMouseEvent` 带 `modifiers: 2`。
- [R-82] 用 CDP 双指触摸（距离 80→200px）：同样走到 Full。逐帧看录屏：
  共有的词（Tram 28、Alfama、Sintra 等）平滑滑到新位置；新词在最终位置原地淡入；
  被插入词推到下一行的词会斜着滑过去；各条目同时长高，上方的头图被锚点补偿推出屏幕。
- [R-83] 在 Full 层级再做一次 240→60px 的向内捏合，原版没有回到 Highlights（只滚动了一点）。
  原因没确认，可能是我的合成事件问题，不作为原版行为。

---

## 对照表：React 版实现状态（2026-10-17）

✅ 已做并有测试；≈ 做了但和原版不同；✗ 没做。测试列写单元测试（U）或 E2E 测试（E）。

| 编号 | 状态 | 说明 | 测试 |
|---|---|---|---|
| R-01..R-04 | ✅ | `LeveledText` / `LeveledToken`，同一条 token 流 | U |
| R-05 | ≈ | 段落间距用 CSS 变量 `--sz-paragraph-gap`（默认 0.5em），不是固定 6px | E |
| R-06..R-10 | ✅ | 标记解析逐行移植；错误类型是 `SyntaxError`（原版 `FormatException`） | U |
| R-11..R-14 | ✅ | 码位范围照搬；字素切分用 `Intl.Segmenter`（无则退回码位） | U |
| R-15..R-20 | ✅ | LCS 和合并逻辑逐行移植；错误类型是 `RangeError`（原版 `ArgumentError`） | U |
| R-21..R-24 | ✅ | `checkVersions`，英文提示原文照搬 | U |
| R-25..R-27 | ✅ | `LeveledPrompt.build` / `parseResponse`，提示词原文照搬 | U |
| R-28..R-35 | ✅ | 控制器、1.6 级/倍、回弹 0.25、速度平滑、0.12 s 投射、弹簧（解析解） | U、E |
| R-36 | ≈ | 用 `navigator.vibrate(8)`；只有安卓 Chrome 有效，iOS 网页没有触感接口 | 无 |
| R-37 | ≈ | 按需求加强：减少动态时**捏合过程中也不做逐词动画**，直接按 round(z) 切换 | E |
| R-38 | ✅ | 浏览器在隐藏副本里排版，每 token 一个 span，读回位置；按 (层级, 宽度) 缓存；空闲时预测量 | E |
| R-39..R-42 | ✅ | 插值和透明度曲线逐项移植（easeInOutCubic、Interval 0.25/0.45、淡出 0.4 easeOut） | U、E |
| R-43 | ≈ | 不需要：每个词是独立 DOM 元素，`transform`/`opacity` 由合成器处理 | 无 |
| R-44 | ≈ | 静止时链接是一个连续的 `<a>`；**过渡中**链接词之间的空格没有下划线 | 无 |
| R-45 | ✅ | 静止时始终是真实文字，可选择、可复制（不需要 SelectionArea） | E |
| R-46..R-47 | ✅ | 手指中点下的条目；每帧先写高度，再读一次锚点位置，改 `scrollTop`，都在同一个 rAF 里 | E |
| R-48 | ≈ | 开头方向由浏览器夹住（同原版）。结尾方向：原版靠弹性滚动临时越界；React 版在内容后面借一段留白，释放锚点后 250 ms 收回 | E |
| R-49..R-52 | ✅ | 按钮/键盘锚定首个可见条目；弹簧结束后释放；`holdAnchor` 可叠加 | U、E |
| R-53 | ✅ | 不适用：浏览器原生滚动没有高度估算问题 | 无 |
| R-54 | ✅ | Pointer Events 跟踪两个触点 | E |
| R-55 | ≈ | 不切换 overflow（避免滚动条宽度变化导致重排），改为两指时 `touchmove.preventDefault()` | E |
| R-56 | ✅ | 捏合结束后 400 ms 内吞掉 click | E |
| R-57 | ≈ | 浏览器只在捏合时给 wheel 带 ctrlKey，两指滚动是普通 wheel，不需要阈值 | E |
| R-58 | ✅ | Ctrl+滚轮累乘 scale，160 ms 无事件即松手 | E |
| R-59 | ✅ | Ctrl/⌘ + `=` `+` `-` `0` 和小键盘；另加 `keyboardShortcuts="global"` | E |
| R-60..R-61 | ✅ | 手势开始清空单条层级；弹簧中新触摸释放锚点 | U、E |
| R-62..R-65 | ✅ | 单条偏移 + 弹簧；点击规则同示例 | U、E |
| R-66 | ≈ | `ExpandableLeveledText` 已做；没做 PageStorage / 状态恢复 | E |
| R-67..R-68 | ✅ | 普通列表；聊天列表用 `column-reverse`，DOM 顺序仍按时间正序（读屏顺序正确） | E |
| R-69 | ✅ | CSS Grid，列数公式同原版 | E |
| R-70..R-74 | ✅ | `LeveledTextLoader`、`LazyLeveledTextView`、350 ms 揭示、`holdAnchor` | E |
| R-75 | ≈ | 读屏读整段当前层级文字 ✅；**没有**做“每条是可调节控件”，改为单选按钮组 | E |
| R-76..R-77 | ✅ | 静止时链接是真实 `<a>`；`LevelSwitcher` 单选组，方向键可用 | E |
| R-78 | ≈ | 宽度变化和字体加载会重新测量；只改字号不改宽度的情况没处理 | 无 |
| R-79 | ≈ | 见报告的性能数据（Chromium，CPU 降速 4 倍，240 条） | E |

原版有、React 版没做：`maxLines` + 省略号、状态恢复（restorationId / PageStorage）、横向列表锚定、虚拟列表（只留了接口：`ZoomView`、`AnchorClient`、`data-sz-item`）。
