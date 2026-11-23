---
name: premium-talk-edit
license: CC BY-NC 4.0（详见本文件夹的 LICENSE）
description: 在 ChatCut 里把口播/出镜讲话视频剪成「高级感干货风」竖屏短视频（9:16）：按实际说出的话粗剪、紧气口，配 28 种信息卡（钩子、名词、大数字、对比表、时间轴、步骤、清单、法条原文、截图标注、聊天记录、流程图、折线图、片尾收藏等）和一套可换的风格包（6 种强调色 × 4 种底色 × 4 种卡片质感 × 字体 × 进场方式），卡片按口播原话自动定时，音效从 8 类 24 个声音里按规则自动挑，导出后自动验收。适合律师、医生、财税、保险、教育、职场等专业干货口播。用户说「高级感干货风」「干货风剪口播」「用 premium-talk-edit」，或要把口播剪成克制、专业、可信的信息卡风格时使用。不用于卡通、综艺、搞笑、科技发布会风格，没有人声的视频，纯 AI 生成视频，也不用于只要转写或只加字幕的请求。
---

# 口播剪辑 · 高级感干货风

成片由四层组成：按**实际说出来的话**粗剪的人声；信息卡动效（28 种，一张卡一个 SPEC）；字幕；短音效。**人是主角，卡片讲清楚就退场**：克制、专业、可信，只有一个强调色，不用弹跳、旋转、花字、emoji。口播默认不铺 BGM。

三种版式（场景自己决定，不用手选）：

| 版式 | 画面 | 人物 |
|---|---|---|
| A | 卡片叠在人物全屏画面的上方（钩子、名词卡、金句、提示条） | 不动 |
| B | 顶部深色底 + 卡片（数据、对比、步骤、清单、原文、截图） | 整体下移 200 px，进出各 13 帧缓动 |
| C | 整屏底色 + 内容（流程图、片尾、内容很多的表格/时间轴） | 缩进左下角圆窗 |

## 轨道分工

轨道分工：**V1 人物**（`build_cut.py --track V1`，B 版式靠关键帧下移）· **V2 卡片叠层**（每段一个 motion-graphic）· **V3 C 版式的人物圆窗**（必须在叠层之上）· **A1 人声**（与 V1 联动，也是字幕轨）· **A2 音效** · **A3 圆窗人物的联动音频**（必须静音）。

## 开工前

1. 先读 [references/chatcut-notes.md](references/chatcut-notes.md)（调用方式和坑）。**ChatCut 的工具没出现时，不要自己写 MCP 客户端或脚本去连它**：停下来请用户确认 ChatCut 已打开并登录，再新开对话；连不上就如实说。
2. 本机要有 Python 3.9 以上（只用标准库）。字体靠 ChatCut 联网下载（Noto Sans/Serif SC、Barlow Condensed、Oswald、Bebas Neue、DM Serif Display）。安装任何第三方依赖前先问用户。
   - **macOS**：音频转换用系统自带的 `afconvert`，找脸和抽帧用 `swift`，都不用装。
   - **Windows**：音频转换要 `ffmpeg`（没有就先问用户，同意后用 `winget install Gyan.FFmpeg` 装）；Python 命令可能叫 `python` 或 `py` 而不是 `python3`；**运行脚本前先设 `PYTHONUTF8=1`**（PowerShell：`$env:PYTHONUTF8=1`；cmd：`set PYTHONUTF8=1`），否则中文 JSON 和 ✓/⚠ 输出会乱码或报错。两个 `.swift` 小工具在 Windows 上不能用，替代办法见第 5、8 步。
3. 命令里的 `scripts/`、`assets/` 指本 Skill 目录下的，用**绝对路径**调用；产物（`words.json`、`cues.json`、`bed.wav` 等）统一放在一个**工作目录**里（建议放在对话的工作目录下新建 `work/`），不要把它们写进 Skill 目录或用户的素材目录。
4. 名词：**SPEC** 是每段卡片 `.jsx` 里的一行 JSON，写这张卡的内容和时间；**`say`** 是 SPEC 里写口播原话的几个字，脚本按口播实际说到的时刻换算成秒数；**`tl_words.json`** 是成片时间线上的逐词时间；**`cues.json`** 是 `gk_cues.py` 的输出，含每段的起始帧、版式和音效点，后面的 `gk_layout.py` / `gk_bed.py` / `final_check.py` 都读它；**`projectPath`** 是 `read_project` 返回的 `projectHome.projectPath`（形如 `~/Library/Application Support/ChatCut/projects/<projectId>/project.chatcutproject`）；**联动音频** 是视频片段自带的、和它绑在一起的音频片段。

## 流程

按顺序做，每完成一个阶段给用户一句进展。

1. **核对素材，定风格。** 9:16、1080×1920、30fps，人物脸在画面中上部、正对镜头；素材有硬字幕时看 [references/theme.md](references/theme.md) 末尾「素材自带字幕」。风格先给用户看 `assets/previews/themes.jpg`（6 套推荐组合），用户选定后改项目里 `workspace/mg/theme.jsx` 的值（`column` 写栏目名，`seed` 写视频名）。新建项目：`create_project` 画布 1080×1920；`scripts/install_mg.py <projectPath>` 把组件库复制进 `workspace/mg/`。细节读 [references/workflow.md](references/workflow.md)。
2. **人声粗剪。** 导入、转写 → `words_from_raw.py` → `envelope.py` → `islands.py` → 写选条表 → `build_cut.py --track V1` → 铺到 V1 → 导出一次音频，用 `measure_mix.py --src-env --cut` 核对声音偏移 → `timeline_words.py` 生成成片时间线上的逐词时间 `tl_words.json`（之后每次改动人物片段都重跑）。方法、气口数值和取舍规则都在 workflow.md。
3. **内容对照表，先给用户确认。** 动手前按口播逐段列一张表：**口播原话 → 画面上出现什么 → 用哪张卡**，讲到几个具体的东西，画面就逐个出现。按 [references/scenes.md](references/scenes.md)「按口播挑场景」选卡，遵守轮换规则（相邻两段不同卡，除非是连着的两张上卡下人；同一张卡一条片子最多 3 次；60 秒内卡片不超过 5 张；人物露脸尽量 ≥ 55%，脚本不检查，自己估）。再出一张版式样图让用户确认字幕位置，做第一段给用户看（做法同第 4 步），确认后才批量铺。
4. **写动效段落，用 say 定时。** 每段一个文件 `workspace/mg/<段名>.jsx`，只写 SPEC，**时间不要自己算秒数，用 `say`（口播原话的几个字）写**：
   ```jsx
   import React from "react";
   import { Scene } from "./scenes.jsx";
   const SPEC = /*SPEC*/ {"scene":"number","dur":5,"kicker":"普通诉讼时效","title":"借出去的钱，最多能等多久","value":3,"unit":"年","countSay":"三年"} /*END*/;
   export default function Seg() { return <Scene spec={SPEC} />; }
   ```
   `push_asset`（`type:"motion-graphic"`，`duration` 微秒，1080×1920）推到人物轨之上的叠层轨，`startFrame` 约等于这句话开口前 0.3 秒，`durationFrames = SPEC.dur × fps`（一般 3–8 秒）。然后**所有段一起**跑：
   `python3 <Skill>/scripts/gk_cues.py <项目 workspace/mg>/段1.jsx@起始帧+时长帧 <…>/段2.jsx@… --words tl_words.json --mg <项目 workspace/mg> -o cues.json`（**一定带 `--mg`**，否则会用包里默认风格而不是你选好的 theme.jsx）
   它把 `say` 换算成秒数写回段落文件，检查字段拼写、时间先后、文字放不放得下、轮换规则，并生成音效点。**⚠ 全部处理完才往下**。场景字段和写法见 scenes.md，每张卡都有示例 SPEC。
5. **版式切换。** `python3 scripts/gk_layout.py cues.json --project <projectPath> --face <脸cx,cy,脸宽> --out-dir <工作目录>`：生成 B 段人物下移的关键帧（分批 `edit_item`）和 C 段人物圆窗片段（`adds` 到圆窗轨，写入后把联动音频全部静音）。脸中心和脸宽用 `swift scripts/faces.swift <视频> <宽> <高> t1 t2 … 2>/dev/null` 量（Windows 上没有 swift：用 `preview_timeline` 抽几帧人物全屏的画面，看图估脸中心和脸宽的像素值；或者不给 `--face`，脚本按画面中上部估算。写入后都要抽帧确认圆窗里是头肩）。
6. **字幕。** 新项目先开启字幕；在「跨刀词」位置查叠字，按语义通读、改同音错字；样式设在轨道上。读 [references/captions.md](references/captions.md)。
7. **音效。** 人声中位数用第 2 步导出的那份音频（那时还没有音效）跑 `measure_mix.py` 得到；人声改过才重导一次。然后
   `python3 scripts/gk_bed.py --pool <Skill 目录>/assets/sfx-pool/pool.json --cues cues.json bed.wav --seed <视频名> --voice-median <dB> --total <片长秒>`，`push_asset` 推 WAV 放音频轨。**不要让用户逐个挑声音**：8 类各 3 个变体由规则按场合自动分配，换视频名就换一套组合。规则和人工调整见 [references/sfx.md](references/sfx.md)。
8. **抽帧复查。** 每改一轮都抽：字幕、卡片、人物脸之间有没有互相遮挡，文字有没有重复，动画过程中元素有没有重叠。**中途检查只用 `preview_timeline` 抽帧（`framesheet.swift` 只在 macOS 能用，Windows 上就用 `preview_timeline`），不要反复导出成片**：整条流程只导出两次——粗剪后一次音频（核对偏移）、验收前一次成片。
9. **验收和交付。** 导出成片，跑 `python3 scripts/final_check.py <成片> --project <projectPath> --cues cues.json --bed bed.wav`，**有 ❌ 不能交付**：修好、重新导出、再跑；把验收单原样给用户（⚠ 逐条说明）。交付时说明取舍（取了哪一遍、删了什么、脚本里有但没说的没加），**如实列出没验证的部分**，请用户听一遍音效，附上 `bed_CREDITS.txt` 里需要署名的音效。
10. **标题、封面（可选）。** 用户的环境里有标题/封面类 Skill 时，交付后提一句「要不要接着出标题和封面」，用户要再做，材料只用视频里实际说出来的话。没有这类 Skill 就跳过，不要凭空编。

## 硬规矩

- 剪辑点只从音频包络取。转写的词级时间可偏 ±0.5 s，只当「这附近说了什么」。
- 粗剪、字幕、卡片文字都以**实际说出来的话**为准。脚本里有但没说的内容不加；转写的同音字（活/火、位/味）按语义改。卡片上的数字、法条、金额必须是口播里说的，**不编造数据**，示例 SPEC 里的内容只是演示版式。
- 风格固定为高级感干货风；用户要卡通、综艺等别的风格时说明本 Skill 不覆盖。不要在卡片里写死颜色，颜色一律来自风格包。
- 音效响度跟人声走：每类 = 人声 + 固定差值（`pool.json` 的 `rules.rel_db`，点击类 +2～+6 dB，持续类 −1～−5 dB），不要从 −15～−20 dB 起步。音效是规则挑的，AI 听不到，交付时请用户听一遍。
- 抖音界面遮挡：顶部 0–200、底部 1560 以下、右侧 x>960 且 y 820–1560 不放内容（场景已按此设计，自写段落时遵守）。
- 不生成付费内容（音乐、音效、图片、视频）；确实需要时先报价并得到明确同意。
- 时间、字段、放不放得下交给脚本：`gk_cues.py` 的 ⚠ 清零才往下；交付前 `final_check.py` 必须通过，没跑过验收单不能说「做好了」。
- 失败、阻塞、需要重试时，用简体中文说清发生了什么和下一步。
- 要整体调整人物片段时，把人物轨整条删掉按 `adds.json` 一次重铺，不要一段一段挪（见 chatcut-notes.md）。

## 脚本

都在 `scripts/`，完整用法看各文件顶部的注释（`-h` 只列参数名；`gk_bed.py` 要写 `gk_bed.py --pool x -h` 才会显示音效池模式的参数）。两个 swift 脚本只在 macOS 能用，运行时会刷一屏弃用警告（功能正常），加 `2>/dev/null`。Windows 上把命令里的 `python3` 换成 `python` 或 `py`，并先设 `PYTHONUTF8=1`。

| 阶段 | 命令 |
|---|---|
| 装组件库 | `install_mg.py <projectPath> [--demo]` |
| 转写 → 逐词 | `words_from_raw.py raw-result.json -o words.json` |
| 包络 | `envelope.py <媒体> env.json` |
| 找切点 | `islands.py list env.json --words words.json --from T0 --to T1`；岛内硬切 `islands.py fine env.json T0 T1` |
| 生成片段 | `build_cut.py pieces.json --words words.json --asset <assetId> --src-dur <源时长秒> --track V1 --out-dir .` → `cut.json` / `adds.json`（人物放 V1） |
| 成片逐词时间 | `timeline_words.py <projectPath> --words words.json -o tl_words.json` |
| 找脸 | `swift faces.swift <视频> <宽> <高> t1 t2 … 2>/dev/null` |
| 场景检查 + 定时 + 音效点 | `gk_cues.py mg/段.jsx@起始帧+时长帧 … --words tl_words.json --mg <mg 目录> -o cues.json` |
| 版式切换 | `gk_layout.py cues.json --project <projectPath> --face cx,cy,w --out-dir .` |
| 音效轨 | `gk_bed.py --pool assets/sfx-pool/pool.json --cues cues.json bed.wav --seed <视频名> --voice-median <dB> --total <秒>`（`--plan` 只看分配） |
| 实测 | `measure_mix.py <成片或音频>`；`--src-env env.json --cut cut.json` |
| 验收单 | `final_check.py <成片> --project <projectPath> --cues cues.json --bed bed.wav` |
| 抽帧 | `swift framesheet.swift <视频> sheet.jpg <列数> t1 t2 … 2>/dev/null` |
| 扩充音效池 | `make_pool.py`（见 references/sfx.md） |
| 组件库自检 | `gk_cues.py --check-jsx`、`gk_cues.py --gallery`（演示合集的 cues） |

组件库在 `assets/mg/`（`theme.jsx` 风格包、`lib.jsx` 底座、`scenes*.jsx` 28 种卡片）；想新增卡片读 [references/authoring.md](references/authoring.md)。音效池在 `assets/sfx-pool/`。预览图在 `assets/previews/`。遇到问题先看 [references/troubleshooting.md](references/troubleshooting.md)。
