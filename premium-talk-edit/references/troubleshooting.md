# 常见问题

| 现象 | 原因 / 办法 |
|---|---|
| `push_asset` 报 "must export exactly one root component" | 一个动效文件只能 `export default` 一个根组件，不能再写别的 `export const`。段落文件按 scenes.md 的写法就不会有这个问题。 |
| 卡片文字缩得很小、挤成一团 | 内容太多。`gk_cues.py` 会报「放不下」：删字，或表格/时间轴加 `"layout":"C"`（全屏，一页放更多）。正文最小 28 px。 |
| 卡片出场后音效才响 / 音效比动画早 | `gk_cues.py` 会报。通常是 `dur` 和时间线上这段的长度不一致，或 `say` 取到了后面一次说的（写 `#1`/`#2` 指定）。 |
| `say` 找不到 | 照口播原话抄几个字，别用书面语；`gk_cues.py` 会提示口播里实际是哪几个字。转写把同音字写错时，`say` 写转写里的字。 |
| 一张卡的内容在时间线上被拉长了，动画变慢 | 不要拉伸动效片段。改 SPEC 的 `dur`，同时改片段的 `durationFrames`。 |
| 导出后卡片文字是方块或字体变了 | 字体靠联网下载；断网或没加载完会回退。联网后重新导出。 |
| B 版式卡片盖到了人的脸 | 人物没下移（`gk_layout.py` 的关键帧没写进去，或被后来的 `edit_item` 清掉了）；`final_check.py` 会报「上卡下人时人物下移」。素材里人脸太靠上时，把 `--shift` 调小，同时检查卡片高度。 |
| C 版式人物圆窗是一张脸而不是头肩 | `gk_layout.py` 的 `--face` 没给，或脸宽量得不对。用 `faces.swift` 量几个时刻取中位数，圆窗截取边长是 2.4 倍脸宽。 |
| 同一时刻有两个人声（回声） | C 版式圆窗人物片段的联动音频没静音；`final_check.py` 会报「没有重叠的人声」。 |
| 画面上出现了没说过的数字或条款 | 违反「以说出的话为准」。删掉或改成口播原话，示例 SPEC 里的内容只是演示。 |
| 改了 `.jsx` 画面没变 | 动效源文件和素材实时关联，不用重新 `push_asset`。还是没变就检查改的是不是项目 `workspace/mg/` 里的那份（不是包里 `assets/mg/` 的）。 |
| `timeline_words.py` 找不到 timelines | `projectPath` 要用 `read_project` 返回的 `projectHome.projectPath`；ChatCut 改了存放结构时，这一步跳过，改用秒数写 `at`。 |
| 音效太响 / 太小 | 先查 `--voice-median` 是不是对「不含音效」的导出测的；再整体 `--gain ±3`；再按类改 `pool.json` 的 `rules.rel_db`。见 sfx.md。 |
| 成片文件太大发不了手机 | macOS：`avconvert -s 成片.mp4 -p Preset1280x720 -o 小.mp4`（系统自带）；Windows：`ffmpeg -i 成片.mp4 -vf scale=720:-2 -c:v libx264 -crf 23 -c:a aac 小.mp4`。 |
| Windows 上脚本报 `UnicodeEncodeError` / `UnicodeDecodeError`，或中文乱码 | 运行前先设 `PYTHONUTF8=1`（PowerShell：`$env:PYTHONUTF8=1`；cmd：`set PYTHONUTF8=1`）。 |
| Windows 上 `envelope.py` / `measure_mix.py` 报「需要 afconvert 或 ffmpeg」 | 装 ffmpeg（先问用户）：`winget install Gyan.FFmpeg`，装完新开一个终端。 |
| Windows 上 `python3` 找不到 | 改用 `python` 或 `py`。 |
| 想换成别的风格（卡通、综艺…） | 本 Skill 不覆盖；风格包只在「高级感干货风」内部换色、字体、质感。 |
