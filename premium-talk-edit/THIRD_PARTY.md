# 第三方内容与许可

本包里不是原创的部分，和它们的许可。

## 音效（assets/sfx-pool/*.wav，24 个）

全部来自 [Freesound](https://freesound.org)。CC0 的可随意使用；**CC BY 的使用时必须署名**（见下表「署名文字」）。
`gk_bed.py` 每次生成音轨时，会把这条视频实际用到的、需要署名的写进 `<输出名>_CREDITS.txt`，发布时贴进视频简介或片尾。

| 文件 | 名称 | 作者 | 许可 | 来源 |
|---|---|---|---|---|
| whoosh_1.wav | Broomstick whoosh 2 - Soft low OKM1 | Sadiquecat | CC0 1.0 | https://freesound.org/s/816261/ |
| whoosh_2.wav | Stick - Whoosh 7 (Soft) | Sadiquecat | CC0 1.0 | https://freesound.org/s/802465/ |
| whoosh_3.wav | Transition,action,jump,pitch-shift,short,shimmer,whoosh,positive,soft.wav | CJDeets | CC0 1.0 | https://freesound.org/s/449645/ |
| pop_1.wav | Pop (Soft UI SFX Free) | heyheytheree | CC BY 4.0 | https://freesound.org/s/871926/ |
| pop_2.wav | Click pop (Soft UI SFX Free) | heyheytheree | CC BY 4.0 | https://freesound.org/s/871910/ |
| pop_3.wav | UI Hover Micro Swish | Qvantor | CC0 1.0 | https://freesound.org/s/878248/ |
| tick_1.wav | Soft UI Button Click | Jummit | CC0 1.0 | https://freesound.org/s/528561/ |
| tick_2.wav | Click_Soft_01.wav | LittleRobotSoundFactory | CC BY 4.0 | https://freesound.org/s/288911/ |
| tick_3.wav | Heater Fan Snap Button 1_3 | Joao_Janz | CC0 1.0 | https://freesound.org/s/477620/ |
| hit_1.wav | soft-hit.wav | Krokulator | CC0 1.0 | https://freesound.org/s/653910/ |
| hit_2.wav | Metal Impact 5 {Soft}.wav | Sophia_C | CC BY 4.0 | https://freesound.org/s/525175/ |
| hit_3.wav | Impact Hit at soft but big material | doudar41 | CC0 1.0 | https://freesound.org/s/728515/ |
| swipe_1.wav | SlidePaperOnPaper.mp3 | Korczu | CC0 1.0 | https://freesound.org/s/648387/ |
| swipe_2.wav | paper slide.wav | semccab | CC0 1.0 | https://freesound.org/s/154403/ |
| swipe_3.wav | paper slide | pauliperez1999 | CC BY 3.0 | https://freesound.org/s/428744/ |
| ok_1.wav | Success Chime | Qvantor | CC0 1.0 | https://freesound.org/s/878601/ |
| ok_2.wav | UI Toast Notification | Qvantor | CC0 1.0 | https://freesound.org/s/878254/ |
| ok_3.wav | Triple_Ping_Notification_Sound_Mobile_Optimized | PiesHelpfulOven | CC0 1.0 | https://freesound.org/s/842513/ |
| no_1.wav | UI Interaction Error Beep - Ghost Metro Ticket | TommasoMotteran | CC0 1.0 | https://freesound.org/s/859155/ |
| no_2.wav | Beep1: Resonant Error Beep | tcpp | CC BY 4.0 | https://freesound.org/s/151309/ |
| no_3.wav | Beep error | SamsterBirdies | CC0 1.0 | https://freesound.org/s/581602/ |
| key_1.wav | FUJITSU Computers Keyboard - P key Press Mono | Sadiquecat | CC0 1.0 | https://freesound.org/s/799117/ |
| key_2.wav | FUJITSU Computers Keyboard - A key Press Mono | Sadiquecat | CC0 1.0 | https://freesound.org/s/799114/ |
| key_3.wav | FUJITSU Computers Keyboard - T key Press Mono | Sadiquecat | CC0 1.0 | https://freesound.org/s/799118/ |

### 署名文字（CC BY 的 6 个）

- `pop_1.wav`："Pop (Soft UI SFX Free)" by heyheytheree ( https://freesound.org/s/871926/ ) licensed under CC BY 4.0
- `pop_2.wav`："Click pop (Soft UI SFX Free)" by heyheytheree ( https://freesound.org/s/871910/ ) licensed under CC BY 4.0
- `tick_2.wav`："Click_Soft_01.wav" by LittleRobotSoundFactory ( https://freesound.org/s/288911/ ) licensed under CC BY 4.0
- `hit_2.wav`："Metal Impact 5 {Soft}.wav" by Sophia_C ( https://freesound.org/s/525175/ ) licensed under CC BY 4.0
- `swipe_3.wav`："paper slide" by pauliperez1999 ( https://freesound.org/s/428744/ ) licensed under CC BY 3.0
- `no_2.wav`："Beep1: Resonant Error Beep" by tcpp ( https://freesound.org/s/151309/ ) licensed under CC BY 4.0

注意：CC BY 3.0 / 4.0 允许商用，但要署名、标明是否做过修改（本包会截取片段、调整音量和音高）。上面的署名文字没有写「已修改」，发布时建议加一句「音效经裁剪和音量调整」。

## 字体（不随包分发，ChatCut 联网按名字下载）

| 字体 | 许可 |
|---|---|
| Noto Sans SC / Noto Serif SC | SIL Open Font License 1.1 |
| Barlow Condensed | SIL Open Font License 1.1 |
| Oswald | SIL Open Font License 1.1 |
| Bebas Neue | SIL Open Font License 1.1 |
| DM Serif Display | SIL Open Font License 1.1 |

字体许可来自它们在 Google Fonts 上的公开说明；本包不含字体文件，不重新分发。

## 脚本的来源

`scripts/` 里的 `envelope.py`、`islands.py`、`build_cut.py`、`timeline_words.py`、`measure_mix.py`、`final_check.py`、`faces.swift`、`framesheet.swift` 是和同仓库的另一套模板「白板便签风」（`whiteboard-koubo/`）共用的工具（已按本包的版式改过 `final_check.py`、`build_cut.py`）。同一作者（吃token的皮卡秋），随本包一起按 CC BY-NC 4.0 授权（见 LICENSE）。

## 预览图和示例

`assets/previews/` 里的图是用占位人物（纯剪影）和虚构的示例文字渲染的，不含真人、不含他人版权画面。示例文字里的法律、医疗、财税内容只是演示版式，**不是专业建议，也不是真实数据**。
