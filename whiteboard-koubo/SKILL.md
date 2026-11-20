---
name: whiteboard-koubo
description: 在 ChatCut 里把口播/出镜讲话视频剪成白板便签风竖屏短视频：从音频包络定剪辑点粗剪、紧气口、多遍里挑一遍，配白板便签风 Remotion 动效和右下人物圆圈，字幕改同音错字与隐藏，真实录音加合成的音效，导出后实测。用户要用白板便签风剪口播，或点名 whiteboard-koubo 时使用。不用于其他视觉风格（如科技风、发布会风）的口播、没有人声的视频、纯 AI 生成视频，也不用于只要转写或只加字幕的请求。
license: CC BY-NC 4.0（详见仓库根目录 LICENSE）
metadata:
  version: "1.0.1"
---

# 口播剪辑 · 白板便签风

版本 1.0.1（2026-11-20）。用户问版本时照这里回答。更新方法：把整个 Skill 文件夹换成新版（不要新旧混放），再新开对话；用户的风格包存在文件夹外面，不会丢。

成片由四层组成：按**实际说出来的话**粗剪的人声；白板便签风动效（版式 A：人物全屏 + 顶部卡片；版式 B：全屏动效在底、人物缩成右下圆圈在上）；字幕；短音效（真实纸张/文具录音 + 代码合成）。口播默认不铺 BGM。

## 开始

用户说「引导我开始」或没给素材时：用一两句话说明能做什么，然后只问缺的东西——素材文件在哪、有没有脚本原文（可选）。素材要求见 [materials.md](references/materials.md)，不符合时先说清楚再动手。

需要的环境：ChatCut Desktop（已登录）、Python 3、ffmpeg（macOS 可用系统自带的 afconvert 代替）。开工前依次检查，缺什么就引导用户装，**每次安装前先问**：

1. **ChatCut**：当前对话里能调用 ChatCut 的工具（如 `get_active_project`）就算装好了。没有时按 [setup.md](references/setup.md) 引导安装和登录。装好后 ChatCut 的工具要在**新对话**里才会出现，所以要给用户一段能直接粘贴到新对话的提示，写清素材路径和要做的事。
2. **Python 3**：`python3 --version`（Windows 上试 `python --version` 或 `py --version`）。
3. **ffmpeg**：`ffmpeg -version`；macOS 上有 `afconvert` 也行。

## 流程

按顺序做，每完成一个阶段给用户一句进展。调 ChatCut 任何工具前先读 [chatcut-notes.md](references/chatcut-notes.md)。**所有路径都从 ChatCut 工具的返回里取，不要自己拼。**

1. **核对素材，定画幅、版式和风格包。** 用户说「重新用某某视频剪」时，先比对源文件的修改时间和时长与项目里已导入的素材，变了就当新素材从头来。**第一次用时让用户挑风格包**（纸张、配色、字体、相框、便签款式、出场方式、书写音效；先给用户看 `assets/previews/combos.jpg` 里 6 套推荐组合的样图再挑），保存到 Skill 文件夹外面的 `~/.whiteboard-koubo/theme.jsx`（Skill 更新时整个文件夹会被替换，存在里面会丢），以后每条视频复制它来用；Skill 里的 `theme.jsx` 只是默认值，不要改。每条视频把项目里那份的 `seed` 改成视频名。读 [theme.md](references/theme.md)。用 `search_fonts` 确认风格包里的字体可用。细节读 [workflow.md](references/workflow.md)。
2. **人声粗剪。** 导入、转写 → `words_from_project.py` → `envelope.py` → `islands.py` → 写选条表 → `build_cut.py`（处理每个 ⚠ 和「重复」，记下「跨刀词」留给字幕核对）→ 铺到 V2 → 导出一次音频，用 `measure_mix.py --src-env --cut` 核对声音偏移 → `timeline_words.py` 生成成片时间线上的逐词时间 `tl_words.json`（之后每次改动人物片段都重跑一次）。方法、气口数值和取舍规则都在 workflow.md。
3. **内容对照表和版式样图。** 动效动手之前，先按口播逐段列一张表给用户确认：**这段讲到了哪些具体的东西，画面上就必须出现哪些东西**（讲「6 种纸张」就要看到 6 种纸张，讲到某个工具就出现这个工具的截图或界面，逐个点名的要逐个出现），每行写「口播原话 → 画面上出现什么 → 用哪个场景」。先把要展示的东西定下来，再选场景和版式，不要先照文字铺好版式再回头想画面动什么。然后出一张样图让用户确认圆圈和字幕位置，再做第一段动效给用户看，确认后才批量铺。等确认期间可以继续粗剪和转写。读 [motion-graphics.md](references/motion-graphics.md)。
4. **动效。** 说到哪个就演示哪个，卡在那个字上；口播指向脚本原文时上原文，不自己概括。**能用场景模板的段落只写 SPEC，不现写；SPEC 里的时间用 `say`（口播原话的几个字）写，不要自己算秒数**（清单/便签墙、划掉替换、步骤、聊天、顶部卡片、对比、数字、截图展示、金句、思维导图、评论问答、结尾互动），按 [scenes.md](references/scenes.md) 的轮换规则挑，相邻两段不用同一个场景；没有合适场景的才用 `lib.jsx` 手写（可用圈重点、波浪线、橡皮擦、手绘图标等小动作）。人物全屏段落说到重点句加推镜头，版式切换用缩进圆圈/放大回全屏，见 motion-graphics.md「人物镜头」。风格包开了整板运镜（`camera: "board"`）时，V1 上放 `scene_cues.py` 生成的 `cam_*.jsx` 而不是段落文件，讲到小结处可加一段整板总览，见 motion-graphics.md「整板运镜」。每段写完跑 `scene_cues.py … --words tl_words.json`，它会把 `say` 换算成秒数写回文件，并检查字段、文字、时间先后和轮换规则；**⚠ 全部处理完才往下做**。每段做完按 motion-graphics.md 的排查清单抽帧。
5. **字幕。** 新项目要先开启字幕；到「跨刀词」位置查叠字，按语义通读、改同音错字；画面上已有同一句大字的地方隐藏字幕；样式设在轨道上，位置固定在人物圆圈正上方 y 1200–1290（底部 y≈1440 以下是抖音/小红书的博主 ID 和标题区，不能放）。读 [sfx-and-captions.md](references/sfx-and-captions.md)。
6. **音效。** `scene_cues.py` 从各段 SPEC 自动生成 cues（手写段落的另写）→ `sfx_bed.py` 把响度烘焙进 WAV → 放 A1。读 sfx-and-captions.md。
7. **抽帧复查。** 每改一轮都抽：字幕、动效、圆圈、脸之间有没有互相遮挡，文字有没有重复，动画过程中元素有没有重叠。时间线用 `preview_timeline`，成片文件用 `inspect_asset` 的 `sources` + `sourceTimes`。**中途检查只用抽帧，不要反复导出成片来看**：整条流程只导出两次——粗剪后导一次音频核对偏移，验收前导一次成片（验收没过修完再导）。
8. **验收和交付。** 导出后跑 `final_check.py <成片> --project <projectPath> --cues cues.json --bed bed.wav`，**有 ❌ 不能交付**：修好、重新导出、再跑，直到通过；把验收单原样贴给用户（⚠ 项逐条说明）。然后 导出到用户的工作目录（`export` 的 `outputPath`），宿主能嵌入视频就嵌入。说明取舍（多遍里选了哪一遍、删了什么、脚本里有但没说的没加），**如实列出没验证的部分**，请用户听一遍音效。

## 硬规矩

- 剪辑点只从音频包络取。转写的词级时间可偏 ±0.5 s，只当「这附近说了什么」。
- 粗剪、字幕、动效文字都以实际说出来的话为准。脚本里有但没说的内容不加；转写的同音字（活/火、位/味）按语义改。
- 风格固定为白板便签风。用户要别的风格时说明本 Skill 不覆盖，不要把其他风格塞进这套模板。
- 字体只写名字，由 ChatCut 自动加载；不要随包附带字体文件或写 `@font-face`。
- 音效响度烘焙进 WAV，从「点击类 ≈ 人声 +2～+6 dB，持续类 ≈ 人声 −1～−5 dB」起步，不要从 −15～−20 dB 起步。
- 不生成付费内容（音乐、音效、图片、视频）；确实需要时先报价并得到明确同意。音效用 `sfx_bed.py` 生成（自带的 CC0 录音 + 合成）。
- 时间、字段、放不放得下交给脚本：SPEC 用 `say` 定时，`scene_cues.py` 的 ⚠ 清零才往下；交付前 `final_check.py` 必须通过，验收单原样给用户看。没跑过验收单，不能说「做好了」。
- **ChatCut 的工具没出现时，不要自己写 MCP 客户端或脚本去连 ChatCut。** 停下来按 setup.md 第 3 步处理（确认已登录、新开对话），连不上就如实告诉用户。
- **写文件用宿主自带的文件工具**，不要用 `python3 -c`、heredoc、`cat >` 写文件；跑脚本用 `scripts/` 里的固定命令。有的宿主会对 shell 命令逐条请求授权，零碎命令越多，用户被打断越多。
- **不要删除文件。** 要替换就直接覆盖写入（项目 `mg/` 里的 `theme.jsx`、段落文件也一样，不要先删再建）；临时文件、抽帧图、试渲染留在工作目录里，不用清理，交付时告诉用户哪些可以删。WorkBuddy 等宿主会把删除操作拦下来等用户点同意，剪辑就停住了。
- 安装第三方依赖前先问。
- 失败、阻塞、需要重试时，用简体中文说清发生了什么和下一步。

## 脚本

都在 `scripts/`，只用 Python 标准库，完整用法见各文件顶部注释（`python3 <脚本> -h`）。Windows 上命令名可能是 `python` 或 `py`。

| 阶段 | 命令 |
|---|---|
| 转写逐词 | `python3 scripts/words_from_project.py <workspacePath> <assetId> -o words.json` |
| 包络 | `python3 scripts/envelope.py <媒体> env.json` |
| 找切点 | `islands.py list env.json --words words.json --from T0 --to T1`；岛内硬切用 `islands.py fine env.json T0 T1` |
| 生成片段 | `build_cut.py pieces.json --words words.json --asset <assetId> --src-dur <源时长秒> --out-dir .` → `cut.json` / `adds.json` |
| 圆圈 | 找脸（见 chatcut-notes.md「人物圆圈」）→ `circle_layout.py <脸cx> <脸cy> --face-w <脸宽> --src <源宽>x<源高>`（拍立得相框加 `--radius 8`） |
| 人物镜头 | `person_moves.py push/shake/shrink/grow …` → 作为 `edit_item` 的 `keyframes` |
| 成片逐词时间 | `timeline_words.py <projectPath> --words words.json -o tl_words.json`（人物片段改过就重跑） |
| 场景检查 + 定时 + 音效点 | `scene_cues.py mg/段.jsx@起始帧+时长帧 … [overview@起始帧+时长帧] --words tl_words.json --voice-median <dB> [--extra 手写.json] -o cues.json` |
| 音效 | `sfx_bed.py cues.json bed.wav --voice-median <dB> [--demo demo.wav] [--sound marker\|pencil\|synth]` |
| 实测 | `measure_mix.py <成片>`；`--src-env env.json --cut cut.json` |
| 验收单 | `final_check.py <成片> --project <projectPath> --cues cues.json --bed bed.wav` → ✅/⚠/❌ 表，有 ❌ 退出码 1 |

只在 macOS 上能用的加速脚本（其他系统用括号里的 ChatCut 工具代替）：`faces.swift` 找脸中心和脸宽（`inspect_asset` 抽帧后看图估）、`framesheet.swift` 抽帧拼图（`preview_timeline` / `inspect_asset`）。运行时会刷一屏弃用警告，加 `2>/dev/null`。

动效模板在 `assets/whiteboard-mg/`：`theme.jsx`（风格包）、`scenes.jsx`（12 个预制场景）、`lib.jsx`（纸张、配色、字体、出场方式、公共组件和小动作）、`ring.jsx`（圆圈相框）、`board.jsx`（整板运镜）、`example_overlay.jsx`（版式 A）、`example_background.jsx`（版式 B）、`example_fulltext.jsx`（整段原文上屏）。三个 example 的文字来自作者自己的视频，只演示写法。

风格样图在 `assets/previews/`（`combos.jpg` 6 套推荐组合，`options-*.jpg` 每一项的全部选项）。

音效素材在 `assets/sfx/`：马克笔、铅笔、盖章、纸张、撕纸、胶带、揉纸、笔帽的真实录音（Freesound CC0，来源见 `SOURCES.md`），`sfx_bed.py` 直接读取，不用联网。
