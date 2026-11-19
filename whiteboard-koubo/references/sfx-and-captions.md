# 音效与字幕

## 音效

口播默认不铺 BGM，只在讲到相关内容、动效出现时补短音效。音效由 `scripts/sfx_bed.py` 生成整条 WAV，不用付费生成：

- **真实录音**（`assets/sfx/`）：手写/划线（马克笔或铅笔笔画）、盖章、纸张、撕纸、胶带、揉纸、笔帽。全部来自 Freesound，许可 CC0（可商用、不用署名），来源清单在 `assets/sfx/SOURCES.md`。每种 3–6 条，每次出现随机挑一条，音高、音量轻微浮动。
- **代码合成**：弹出、小弹出、打勾、嗖声、打字、心电图、下滑音、橡皮擦。

### 让每条片子听起来不一样

- `theme.jsx` 的 `sound` 选书写声：`marker` 马克笔（默认）、`pencil` 铅笔、`synth` 回到旧的纯合成音。
- `theme.jsx` 的 `seed`（每条视频改成视频名）决定挑哪几条录音；同一个 seed 每次生成结果完全一样，重剪不会变。
- `scene_cues.py` 会自动读段落文件旁边的 `theme.jsx`，把 `sound`、`seed` 写进 cues.json，不用另外传。

### 音色一览

| 音色 | 声音 | 用在 |
|---|---|---|
| `pop` / `tiny` | 合成弹出 | 标题、卡片、气泡弹出；连续的小元素 |
| `scribble <秒>` | 马克笔/铅笔笔画拼接（`synth` 时为合成） | 手写、划线、打叉、画圈、荧光笔、箭头、手绘图标 |
| `tick` | 合成 | 打勾 |
| `stamp` | 真实盖章（`synth` 时为合成） | 盖章、VS 章、重点落下 |
| `paper` | 纸张拍下、翻过 | 截图/照片贴上、便签墙的便签贴上 |
| `tear` | 撕纸 | 便签被撕走（`Note` 的 `out`） |
| `crumple` | 揉纸 | 「这个扔掉」「不要了」 |
| `tape` | 撕胶带 | 胶带把东西贴上 |
| `cap` | 拔马克笔帽 | 一大段手写开始前（可选，别每段都用） |
| `erase <秒>` | 合成擦除声 | `Erase` 橡皮擦 |
| `whoosh` | 合成嗖声 | 版式切换、顶部卡片换阶段、截图推近 |
| `typing <秒>` | 合成键盘 | 打字 |
| `beep flat\|beat`、`fall` | 合成 | 心电图平线/心跳、泄气 |

*为什么手写声只拼笔画、不用长录音*：长录音的节奏和动画对不上；短笔画按动画时长拼起来，每次组合都不一样。
*为什么橡皮擦是合成的*：Freesound 上没找到干净的 CC0 橡皮擦录音（2026-11 查过）。

### 响度目标（默认值，可按口味调）

以「人声」为基准：语音段 50 ms RMS 的中位数（实测一条手机/领夹麦录的口播成片约 −27 至 −28 dBFS）。

| 类别 | 音色 | 相对人声（峰值 50 ms RMS） |
|---|---|---|
| 点击类 | pop +4、tiny +2、stamp +6、tick +3 | +2～+6 dB |
| 持续类 | scribble −2、whoosh −1、beep −1、fall 0 | −1～−5 dB |
| 纸张类（真实录音，起步值） | paper −1、tear 0、tape 0、crumple −1、cap 0、erase −3 | −3～0 dB |
| 打字 | typing | 按峰值定：人声中位 +17 dB，且不超过 −9 dBFS |

- 全片峰值不高于约 −6 dBFS，不削波（人声本身峰值高时以人声为准）。
- **响度直接烘焙进 WAV，不靠轨道音量。** *为什么*：靠轨道音量 +15 dB 去补，结果不稳定。
- 打字声是稀疏的短促点击，按 RMS 归一会让峰值飙到爆音，所以单独按峰值定（`sfx_bed.py` 已处理）。
- *为什么从这个值起步*：按常见做法「压在人声下 15–20 dB」放，在手机上几乎听不见，前后加了 +7、+8 dB 两轮才合适。直接从上表起步，别从 −15～−20 起步。觉得吵或太小，改 `sfx_bed.py` 顶部的 `OFFSETS`。

### 步骤

1. 人声时间线铺好后，导出一版不含音效的音频，用 `measure_mix.py <导出>` 得到人声中位数（`voiceMedian`）。
   **音频导出（WAV）整体比视频导出低约 3 dB**：实测 WAV −31.6，成片 −28.9，源素材 −29.0；另一条 cues 用 −30.4，成片实测 −27.2。人声和音效一起抬，相对值不变，所以照常用 WAV 测得的值；成片里 `measure_mix.py --sfx` 报「音效轨增益 ≈ +3 dB」属正常，看各音色相对人声的 dB 即可。
2. 生成 `cues.json`：把**所有**动效段落按时间线位置列给 `scene_cues.py`（`段.jsx@起始帧+时长帧`，手写段落末尾标 `:A` 或 `:B`），它从场景 SPEC 自动配音效：弹出 pop、连续小元素 tiny、手写/划线/荧光笔 scribble（时长跟动画）、打勾 tick、打字 typing、版式切换和顶部卡片换阶段 whoosh（提前 0.22 s）。这套规则对照过人工逐个配的 cue：25 个里 22 个时间对得上。
   截图贴上、便签墙的便签用 `paper`，对比的 VS 章用 `stamp`。
   手写段落的音效另写成 `--extra` 文件（`sfx_bed.py` 的 groups 格式）：每段一个 group，`startFrame` 是起始帧，cue 时间写成**该段动效内的相对秒**——重剪后只改 `startFrame` 就能整体平移。音色列表见 `sfx_bed.py` 顶部注释；`scribble` 的时长可写 0.3–3 秒。
   个别需要盖章声等特殊音色的，直接改生成的 `cues.json`。
3. `sfx_bed.py cues.json bed.wav --voice-median <dB>`；`--demo demo.wav` 可另存每种音色各响一次的试听文件。临时想换书写声可以加 `--sound pencil`，不改 theme.jsx。
4. `push_asset` 推 WAV，放 A1。
5. 导出成片后实测：`final_check.py <成片> --project <projectPath> --cues cues.json --bed bed.wav`（验收单里的「音效响度」一项；要看每种音色的具体数值用 `measure_mix.py <成片> --sfx bed.wav --cues cues.json`），看音效轨增益、各音色相对人声的 dB、峰值、削波。个别压字的只降那一类（`cues.json` 里的 `offsets` 覆盖，例如 `{"stamp": 5}`），不要整体降。
6. 数值只能说明响度，主观听感测不出来：交付时请用户听一遍。

素材库里没有音乐类音效；演示用的短旋律可以本机合成。

## 字幕

- **新项目先开启字幕**：`edit_captions` `action:"enable"`，然后 `read_captions` 才有卡片。
- **先查切点两侧的叠字。** 转写的词跨过切点时，ChatCut 可能把它在两边的字幕卡里各放一次。音频本身没重复，只是字幕叠字，实际出现过「对对了」「AI Agent Agent」「做做自媒体」「这这 5 条」。到 `build_cut.py` 列出的「跨刀词」位置逐个核对，用 `set_card_text` 去掉多的那个字。这个列表会有误报（「或」「就」被列出但没叠字），以卡片实际文字为准。
- **画面上已有同一句大字的地方，字幕隐藏**：`set_card_style` `{opacity:0}`。一条 2 分钟的片子通常要隐藏二三十张。
- **转写错字用 `set_card_text` 修**（一条 2 分钟的片子通常十几到二十处）：同音字（「AI 位」→「AI 味」、「活」→「火」）、中英文之间加空格。`build_cut.py --words` 输出里的 ⚠ 行可以当改字清单，但仍要按语义通读一遍。
- **样式放在轨道上**（`set_track_style` / `update_track`），不要给每张卡片单独设样式；卡片样式只用于个别例外。
- 字幕配色跟风格走。白板便签风定稿的轨道样式（字幕轨的 trackId 就是人声轨 A2 的 id），可直接放进一次 batch：
  ```json
  [{"action":"set_track_style","trackId":"<A2 的 id>","style":{"fontFamily":"Noto Sans SC","fontStyle":{"variant":"normal","weight":"700"},"color":"#22252B","strokeColor":"#FFFFFF","strokeWidth":8,"fontSize":0.045,"maxCharactersPerLine":16}},
   {"action":"update_track","trackId":"<A2 的 id>","layout":{"left":81,"top":1716,"width":918,"height":90}}]
  ```
- 隐藏和改字都走 `edit_captions` 的 batch（坑见 chatcut-notes.md）。
