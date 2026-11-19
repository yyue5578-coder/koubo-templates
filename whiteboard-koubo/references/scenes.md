# 场景模板：只填内容，不现写动效

`assets/whiteboard-mg/scenes.jsx` 有 12 个预制场景（清单另有便签墙样式），提炼自实际做片中反复出现的画面。长什么样由风格包决定（见 [theme.md](theme.md)）。
版面、安全区（避开圆圈和字幕）、字号适配、换行都在场景里做好了，每段动效只写一个 `SPEC`。
*为什么*：每段现写时，抽帧发现的问题有一半是排版类（竖排、出屏、进圆圈、半遮挡），
聊天窗也容易留半屏空白；场景模板把这些一次修在模板里。

## 用法

1. 把 `lib.jsx`、`scenes.jsx`、`ring.jsx`、`board.jsx` 和用户保存的风格包 `~/.whiteboard-koubo/theme.jsx`（见 [theme.md](theme.md)「存在哪」）复制到项目工作目录（`read_project` 的 `projectHome.workspacePath`）下的 `mg/`，并把项目里那份 `theme.jsx` 的 `seed` 改成这条视频的名字。
2. 每段动效一个文件，固定写法（`SPEC` 必须是**纯 JSON**：键加双引号、颜色写名字，`scene_cues.py` 要读它）：
   ```jsx
   import React from "react";
   import { Scene } from "./scenes.jsx";

   const SPEC = /*SPEC*/ {"scene":"list","title":"把 5 件事说清楚","hl":"5 件事","items":[{"text":"我要什么结果？","at":0.05}]} /*END*/;
   export default function Seg() { return <Scene spec={SPEC} />; }
   ```
3. 所有时间是**动效内秒**，对着口播里那个字（换算见 motion-graphics.md）。
4. `push_asset` 推上去、放到时间线后（整板运镜时 V1 上放的是 `scene_cues.py` 生成的 `cam_*.jsx`，见 motion-graphics.md「整板运镜」），跑 `scene_cues.py`：它会检查放不放得下、时间在不在段内，并生成音效（见 sfx-and-captions.md）。⚠ 都处理掉再出样图。

## 按口播的句式选场景

每种句式都有 2–3 个可选场景。同一条片子里按下面的轮换规则挑，别让观众连着看到同一种画面。

| 口播在说 | 可选场景 | 版式 |
|---|---|---|
| 开头钩子、强调一句话、「关键就在这儿」 | `topcard`（A）· `quote`（B，整屏金句） | A／B |
| 「不是 X，而是 Y」「X 不行，要 Y」，或一串词逐个删掉 | `strike` · `topcard` 带 `strikeAt` + `to`（A）· `compare`（两栏，带输赢） | B／A |
| 「以前…现在…」「A 和 B 比」「用之前/用之后」 | `compare` · `strike` | B |
| 「有 N 件事」「第一…第二…」、体检/打分逐项 ✓ ✗ | `list` · `list` 的 `style:"notes"` 便签墙 · `mindmap`（几件事同属一个主题时） | B |
| 「第一步／第二步」，每步一个要点 | `step` · `list` | B |
| 说出一个数字、倍数、百分比、时长、价格 | `number`（可带横条对比） · `topcard` 大字 | B／A |
| 「你看这个后台/这条评论/这个界面」，指向一张截图 | `shot`（用户提供的截图） | B |
| 一个主题下有几个方面、几个要素 | `mindmap` · `list` 便签墙 | B |
| 讲和 AI 怎么对话、发什么、回什么 | `chat` | B |
| 「评论区有人问…」「很多人问我…」 | `comment` · `chat` | B |
| 结尾提问、让观众评论（**只在口播里真说了才用**） | `outro` | B |

**轮换规则**

- 相邻两段动效不用同一个场景；同一个场景一条片子里最多用 3 次。
- 清单类内容超过两段时，编号清单和便签墙交替用。
- 版式 A（人物全屏）和版式 B（全屏动效）交替出现，连续的版式 B 不超过约 12 秒，中间切回人物全屏。
- 人物全屏的段落里，说到重点句时加一次推镜头（见 motion-graphics.md「人物镜头」），一条片子 2–4 次就够，不要每句都推。

控件要符合含义：划线只用在口播确实在否定的词上，✓/✗ 只用在口播确实在判断对错的地方，输赢圈只用在口播确实下了结论的地方。没有一个场景合适时（例如心电图、扫描、提示词全文上屏），照旧用 `lib.jsx` 手写，它的音效写进 `--extra`。

## 各场景字段

### 时间优先用 say

**不要自己算秒数。** 任何写时间的地方都可以改写成「口播里说到哪几个字」，`scene_cues.py --words tl_words.json` 会按成片时间线换算成段内秒数，写回段落文件：

| 写 | 换算成 |
|---|---|
| `"say":"先删重复"` | `at`（说到这几个字前 0.1 秒出现） |
| `"markSay"` `"strikeSay"` `"toSay"` `"hlSay"` `"circleSay"` … | `markAt` `strikeAt` `toAt` `hlAt` `circleAt` …（`xxxSay` → `xxxAt`） |
| `"outSay"` | `out` |
| `hand` / `sub` 里的 `"say"` | `at` 和 `end`（说完那一刻） |

- 照转写原文抄 3–6 个字（错别字也照抄），越独特越好；同一段里说了两次的，写 `"去AI味#2"` 取第 2 次。
- 找不到会报 ⚠；只找到相近的会告诉你口播里实际是哪几个字。
- 改了人物片段（切分、挪动、删）后，先重跑 `timeline_words.py`，再重跑 `scene_cues.py`，时间会跟着更新。

```json
{"scene":"list","title":"去 AI 味的 3 步","hl":"3 步","items":[{"text":"删掉套话","say":"先把套话删掉"},{"text":"加入自己的经历","say":"自己的经历","mark":"circle","markSay":"这一步最重要"},{"text":"读一遍再发","say":"读一遍"}],"stamp":{"text":"踩坑","say":"我踩过坑","pos":"bl"}}
```

通用：`at` 系列都是秒（建议用上面的 say 写）；颜色可选 `noteY` `noteB` `noteG` `noteP` `white`（默认按顺序轮换）。

**list**：`title`、`hl`（标题里要划荧光笔的字）、`titleAt`；`items[]`: `text`、`at`、`mark`、`markAt`（默认 at+0.4）、`color`；`numbered`（默认 true）。1–6 条，正在说的那条编号变红。加 `"style":"notes"` 变成两列便签墙（1–6 张）。

`mark` 可选：`tick` 打勾 · `x` 打叉 · `circle` 手绘圈住这一条（「重点是这个」）· `erase` 橡皮擦把这一条擦掉（「这个不要了」「忘掉它」）。便签墙的条目还可以给 `out`（秒）：那一刻便签被撕下飞走（「划掉」「下一个」）。音效 `scene_cues.py` 自动配。
```json
{"scene":"list","style":"notes","title":"这些都不要了","items":[{"text":"日更","at":0.2},{"text":"追热点","at":0.3,"out":1.2},{"text":"买课","at":0.4,"mark":"erase","markAt":1.4},{"text":"先发出去","at":0.5,"mark":"circle","markAt":2.2}]}
```
```json
{"scene":"list","title":"AI 稿子体检表","hl":"体检表","numbered":false,"items":[{"text":"情绪 0","at":0.45,"mark":"x","markAt":0.7},{"text":"信息点","at":3.0,"mark":"tick","markAt":3.3}]}
```

**strike**：`title`、`hl`；`from`（一个词，或词数组逐个出现）、`fromAt`；`strikeAt`（必填）；`to`（必填）、`toAt`（默认 strikeAt+0.7）、`toColor`；`hand`: `text`、`at`、`end`。
```json
{"scene":"strike","title":"写出爆款脚本的关键","hl":"关键","from":"去AI味","fromAt":0.5,"strikeAt":1.3,"to":"+ 人味","toAt":2.2,"hand":{"text":"关键根本就不是去AI味，而是要加人味儿","at":3.0,"end":4.6}}
```

**step**：`n`、`sub`（小字）、`label`（步骤名）、`at`；`note`: `text`、`at`（大便签）；`chips[]`: `text`、`at`（小气泡）；`hand`。
```json
{"scene":"step","n":1,"sub":"先说最简单的","label":"第一步","at":0.05,"note":{"text":"加废话","at":1.2},"chips":[{"text":"啊","at":2.7},{"text":"吧","at":3.13}],"hand":{"text":"这些语气词","at":3.5,"end":4.0}}
```

**chat**：`title`、`hl`、`window`（窗口标题）、`winAt`；`messages[]`: `who`（`"me"` 右侧蓝 / `"ai"` 左侧白）、`text`、`at`、`typing`（true 时逐字打出）、`typeDur`；`notes[]`（窗下结论标签）: `text`、`at`、`color`、`mark`、`markAt`。窗口高度按消息自动算。
```json
{"scene":"chat","title":"聊天最典型的模式","hl":"聊天","window":"聊天窗口","winAt":0.45,"messages":[{"who":"me","text":"你：出一个题目","at":2.0},{"who":"ai","text":"AI：来回答","at":3.14}],"notes":[{"text":"错了 → 就改","at":4.12,"color":"noteP","mark":"x","markAt":4.3}]}
```

**topcard**（版式 A 叠层，放 V3）：`at`（卡片出现）、`rot`；单阶段直接写，多阶段写 `phases[]`，第 2 阶段起要 `start`（换阶段的时刻）。每阶段：`label`（顶部小字）、`big`: `text`、`at`、`hl`、`hlAt`、`strikeAt`；`to`: `text`、`at`（划掉后换成的便签）；`notes[]`: `text`、`at`、`color`（排在大字右边）；`hand`。卡片高度不超过 420，不会挡脸。
```json
{"scene":"topcard","at":0.6,"rot":1,"phases":[{"big":{"text":"不是 AI 不行","at":0.6,"hl":"AI 不行","hlAt":1.4}},{"start":2.8,"label":"而是你只会","big":{"text":"去AI味","at":3.0,"strikeAt":4.3},"to":{"text":"+ 人味","at":5.05}}]}
```

**compare**（两栏对比）：`title`、`hl`；`left` / `right`: `label`（栏名）、`at`、`items[]`（`text`、`at`）、`mark`（`"tick"`/`"x"`，画在栏名旁）、`markAt`、`color`（栏头颜色）；`vs`（默认 true，中间盖一个 VS 章）、`vsAt`；`verdict`: `side`（`"left"`/`"right"`，圈出赢的一栏，输的一栏变淡）、`at`、`text`（结论便签，可省）、`textAt`。每栏 1–4 条。
```json
{"scene":"compare","title":"手动剪 vs AI 剪","hl":"AI 剪","left":{"label":"手动剪","at":0.4,"items":[{"text":"3 小时","at":0.8}],"mark":"x","markAt":1.6},"right":{"label":"AI 剪","at":1.9,"items":[{"text":"10 分钟","at":2.3}],"mark":"tick"},"verdict":{"side":"right","at":3.4,"text":"差了 18 倍"}}
```

**number**（数字大字）：`title`、`hl`；`value`（字符串，纯数字时会从 `from` 滚动到它，小数位数跟 `value` 一致）、`from`（默认 0）、`prefix`、`suffix`（小一号，如 `%`、`倍`）、`at`、`countDur`（滚动秒数，默认 0.9）；`label`（数字下面一行说明）、`labelAt`；`circleAt`（手绘圈住数字）；`bars[]`（可选横条对比，最多 4 根）: `label`、`value`（数字）、`unit`、`at`、`color`；`note`: `text`、`at`；`hand`。
```json
{"scene":"number","title":"省下来的时间","value":"90","suffix":"%","at":0.4,"label":"剪辑时间减少","circleAt":1.7,"bars":[{"label":"手动","value":180,"unit":"分钟","at":2.3},{"label":"AI","value":18,"unit":"分钟","at":2.7}]}
```

**shot**（截图展示）：`title`、`hl`；`image`（用 `push_asset` 推上去的图片返回的 assetId）、`ratio`（图宽 ÷ 图高，必填，不然会裁错）、`at`、`rot`；`marks[]`: `kind`（`circle` 手绘圈 · `box` 红框 · `hl` 荧光笔 · `arrow` 箭头，可带 `text` 手写字）、`x` `y` `w` `h`（**图内比例 0–1**，不是像素）、`at`；`zoom`: `x` `y` `w` `h`（要推近的区域，图内比例）、`at`、`dur`（默认 0.6）、`out`（几秒时拉回，可省）；`caption`: `text`、`at`（图下手写一句）。截图只用用户自己提供的，不要编造界面。
```json
{"scene":"shot","title":"后台数据","image":"<图片 assetId>","ratio":0.46,"at":0.3,"marks":[{"kind":"circle","x":0.1,"y":0.42,"w":0.5,"h":0.08,"at":1.6}],"zoom":{"x":0.05,"y":0.38,"w":0.9,"h":0.2,"at":3.0},"caption":{"text":"一周涨了 3 倍","at":4.0}}
```

**quote**（金句整屏）：`text`（最多两行）、`at`、`writeDur`（逐字写出的秒数，默认按字数）；`hl`（要划荧光笔的那几个字）、`hlAt`；`wavyAt`（最后一行下面画波浪线）；`by`（手写署名，可省）、`byAt`；`card`（默认 true，衬一张大便签）、`color`。金句必须是口播里原话。
```json
{"scene":"quote","text":"不是 AI 不行，是你只会去 AI 味","at":0.3,"hl":"只会去 AI 味","hlAt":2.4,"wavyAt":3.0}
```

**mindmap**（思维导图）：`center`: `text`、`at`；`nodes[]`（2–6 个）: `text`、`at`、`color`，分支线在 `at` 前 0.25 秒开始画；`hand`（左下角手写一句）。节点位置固定，避开右下角人物圆圈。
```json
{"scene":"mindmap","center":{"text":"爆款脚本","at":0.3},"nodes":[{"text":"有情绪","at":0.9},{"text":"有信息量","at":1.4},{"text":"有反差","at":1.9}],"hand":{"text":"缺一不可","at":3.0,"end":3.6}}
```

**comment**（评论区问答）：`title`、`hl`；`comments[]`: `user`（昵称，头像取第一个字）、`text`、`at`、`likes`（点赞数文字，可省）；`reply`: `text`、`at`、`typing`（逐字打出）、`typeDur`、`label`（默认「作者回复」）；`hand`。评论内容要是口播里说到的，不要编造网友评论。
```json
{"scene":"comment","title":"评论区问得最多的","hl":"最多","comments":[{"user":"小鱼","text":"国产模型能做到吗？","at":0.5,"likes":"2.1w"}],"reply":{"text":"能做，但动效会差一截","at":2.2,"typing":true}}
```

**outro**（结尾互动）：`text`（大字提问，最多两行）、`at`；`sub`: `text`、`at`、`end`（手写一句 + 波浪线）；`icons[]`: `kind`（`question` `heart` `star` `bulb` `fire` `exclaim` `bolt` `check` `eyes`）、`at`。**只有口播里真的说了这句互动才用**，没说就不加。
```json
{"scene":"outro","text":"你踩过哪个坑？","at":0.3,"sub":{"text":"评论区告诉我","at":1.2},"icons":[{"kind":"question","at":2.2},{"kind":"heart","at":2.6}]}
```

## 所有场景通用：小图标和印章

任何场景的 SPEC 都可以加这两个字段，位置用预设名，不用算坐标：

- `doodles[]`: `kind`（`bulb` 灯泡 · `question` 问号 · `exclaim` 感叹号 · `star` · `fire` 火 · `heart` · `bolt` 闪电 · `check` 打勾圈 · `eyes` 眼睛）、`at`、`pos`
- `stamp`: `text`（2–4 个字，如「踩坑」「重点」「亲测」「NEW」）、`at`、`pos`

`pos`：`title` 标题右边 · `tr` 右上 · `tl` 左上 · `mr` 右侧中间 · `ml` 左侧中间 · `bl` 左下 · `mid` 正中偏右（右下是人物圆圈，没有 `br`）。

```json
{"scene":"list","title":"去 AI 味的 3 步","items":[…],"doodles":[{"kind":"bulb","at":1.2,"pos":"title"}],"stamp":{"text":"踩坑","at":2.4,"pos":"tr"}}
```

规则：图标只在口播说到对应意思时加（说「想法」才放灯泡，说「火了」才放火），**一段最多 1–2 个**；印章一段最多 1 个。加完抽帧看一眼有没有压到内容，压到就换个 `pos`。

## 文字放不下时

场景按这个顺序自动处理：在字号范围内缩小 → 在标点处断成两行（标点处放得下就一定在标点断）→ 仍放不下时 `scene_cues.py` 报 ⚠。
看到 ⚠ 时先拆成两段动效；还不行就改写文字并请用户确认。否定词、条件、数字和单位不能删。

## 改模板

改 `scenes.jsx` 的测量或换行规则（`charW` / `fit` / `wrap`）时，`scripts/scene_cues.py` 里的同名函数要一起改，否则检查结果和画面对不上。
