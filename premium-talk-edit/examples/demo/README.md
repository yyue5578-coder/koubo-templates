# 示例：3 段 SPEC + 一份虚构口播的逐词时间

这是一条约 16 秒的虚构口播（"借钱不还，诉讼时效三年"），用来演示 `gk_cues.py` 怎么用：

- `tl_words.json`：成片时间线上的逐词时间（格式同 `timeline_words.py` 的输出）。
- `seg1_hook.jsx`（版式 A 钩子）、`seg2_number.jsx`（版式 B 大数字）、`seg3_steps.jsx`（版式 B 步骤）：`say` 已经被 `gk_cues.py` 换算成秒数写回，`say` 本身保留，重跑会重新算。
- `cues.json`、`events.json`：生成出来的音效点（含场合标记）。

自己试一遍（不需要 ChatCut）：

```bash
mkdir /tmp/try && cd /tmp/try
cp <Skill 目录>/examples/demo/seg*.jsx <Skill 目录>/examples/demo/tl_words.json <Skill 目录>/assets/mg/*.jsx .
python3 <Skill 目录>/scripts/gk_cues.py seg1_hook.jsx@0+186 seg2_number.jsx@189+93 seg3_steps.jsx@282+201 --words tl_words.json -o cues.json
```

两个值得看的地方：
- `seg2_number.jsx` 的 `"countSay":"三年#2"`：这句话说了两次「三年」，`#2` 取第 2 次。
- `seg2_number.jsx` 写了 `"panelOut":false`、`seg3_steps.jsx` 写了 `"panelIn":false`：两张上卡下人的卡片连着放，底色和人物位置不收起，`gk_layout.py` 把它们合成一个下移区间。
