# 字幕

成片字幕用 ChatCut 的原生字幕（`edit_captions`），不是卡片里的字。

- **新项目先开启字幕**：`edit_captions` `action:"enable"`，然后 `read_captions` 才有卡片。
- **先查切点两侧的叠字。** 转写的词跨过切点时，ChatCut 可能把它在两边的字幕卡里各放一次。音频本身没重复，只是字幕叠字（会出现「对对了」「做做自媒体」这类）。到 `build_cut.py` 列出的「跨刀词」位置逐个核对，用 `set_card_text` 去掉多的那个字。这个列表会有误报，以卡片实际文字为准。
- **画面上已有同一句大字的地方，字幕隐藏**：`set_card_style` `{opacity:0}`（例如钩子大字、金句卡出现的那几秒）。
- **转写错字用 `set_card_text` 修**：同音字（「AI 位」→「AI 味」、「活」→「火」）、中英文之间加空格。`build_cut.py --words` 输出里的 ⚠ 行可以当改字清单，但仍要按语义通读一遍。
- **样式放在轨道上**（`set_track_style` / `update_track`），不要给每张卡片单独设样式；卡片样式只用于个别例外。
- **位置（这一条的数值没有在多条真实素材上验证过，先抽帧确认再批量用）**：字幕放在版式 A 的 y≈1325、B 的 y≈1478 附近的位置是演示合集里用的；ChatCut 原生字幕只有一个轨道位置，建议放在 B 版式字幕位（画布 y 约 1430–1530，即 `top` ≈ 1478 − 高度/2），A 版式下它在人物胸口，也能看；C 版式要避开左下圆窗（圆窗在 y 1290–1530、x 72–312），所以 C 版式时字幕在 x > 330 的区域能放下，或者把轨道字幕整体靠右放。
- 深色底的视频，字幕建议白字 + 深色描边，关键词用强调色。样式例子（放进一次 batch，A1 人声轨的轨道 id 就是字幕轨）：
  ```json
  [{"action":"set_track_style","trackId":"<人声轨 id>","style":{"fontFamily":"Noto Sans SC","fontStyle":{"variant":"normal","weight":"700"},"color":"#FFFFFF","strokeColor":"#12161C","strokeWidth":8,"fontSize":0.05,"maxCharactersPerLine":16}},
   {"action":"update_track","trackId":"<人声轨 id>","layout":{"left":81,"top":1420,"width":918,"height":110}}]
  ```
- 隐藏和改字都走 `edit_captions` 的 batch（一次最多 100 条，一条失败全部不写，要带最近一次读到的 `revision`）。
