# 高级感干货风 · 场景库（28 种，演示合集 30 个示例）

每段动效只写一个 SPEC（纯 JSON，时间是段内秒），交给场景渲染：

```jsx
import React from "react";
import { Scene } from "./scenes.jsx";
const SPEC = /*SPEC*/ {"scene":"number","dur":5,"kicker":"普通诉讼时效","title":"借出去的钱，最多能等多久","value":3,"unit":"年","countSay":"三年"} /*END*/;
export default function Seg() { return <Scene spec={SPEC} />; }
```

- **时间用 `say` 写，不要自己算秒数。** 任何 `xxxAt`（秒）都可以改写成 `xxxSay`（口播原话的几个字），`gk_cues.py --words tl_words.json` 按口播里说到这几个字的时刻换算成段内秒并写回文件，`say` 保留，重跑会重新算。例：`"countSay":"三年"`、`"hlSay":"最多"`；`at` 本身写成 `"say":"…"`；数组里的对象也一样（`items[i].say`、`marks[i].say`）；同一句说了两次写 `"三年#2"`；数组值如 `"rowSay":["个体户","专票"]` 得到 `rowAt` 数组。找不到会报错，只找到相近的会提示口播里实际是哪几个字。
- `dur` 必写（段长秒数）：场景在 `<Sequence>` 里拿不到自己的段长；它必须等于时间线上这段的 `durationFrames ÷ fps`（脚本会核对）。
- 通用字段：`at` 出现、`out` 出场（默认 dur−0.3）；B 类另有 `panelIn` / `panelOut`（连续两段上卡下人时，前一段 `panelOut:false`、后一段 `panelIn:false`，底色不收起）。
- 版式：**A** 叠在人物全屏上；**B** 上卡下人（剪辑时人物下移约 200px，关键帧与底色展开同步 0.42s）；**C** 全屏讲解，人物缩进左下圆窗（`CIRCLE` x72 y1290 直径 240）。
- 字幕：成片用 ChatCut 的原生字幕（见 captions.md）；lib 里的 `<Subtitle>` 只在演示合集里用，位置 A `ZONE.subA`、B `ZONE.subB`、C `ZONE.subC`（避开左下圆窗）。
- 示例：每个场景在 `DEMOS_A/B/C` 里各有一份完整 SPEC，照着改最快。

## 按口播挑场景

| 口播在说 | 可选场景 |
|---|---|
| 开头 3 秒抓人 | `hook` 钩子大字 · `hookQ` 问句 · `hookNum` 数字 · `hookFlip` 反常识 |
| 自我介绍、建立信任 | `nameplate` 身份条 |
| 专业名词 | `term` 名词卡（可带几个子类逐个点亮） |
| 年限、金额、比例、人数 | `number` 大数字 · `hookNum` · `percent` 百分比环 |
| 两个数对比、前后变化 | `numCompare` · `bars` 条形图 |
| 一段时间里的走势（涨了、跌了、一路往上） | `line` 折线图 |
| 省下时间/精力，效果（分数）往上涨 | `savescore` 省时间+质量分 |
| 期限、阶段 | `timeline` 时间轴 |
| 多项对比 | `table` 对比表 · `numCompare` |
| 「很多人以为……其实……」 | `compare` 以为/其实（B） · `hookFlip`（A） |
| 算账、拆解 | `formula` 公式 |
| 引用法条、指南、合同 | `doc` 文件高亮卡 |
| 截图、化验单、App 页面 | `shot` 截图标注 |
| 复述原话、聊天记录 | `chat` 聊天记录 |
| 一口气列出清单、对比表、聊天记录这几种东西 | `trio` 三合一 |
| 分几步、怎么办 | `steps` 步骤卡 · `flow` 流程图（C） |
| 自查、你中了几条 | `checklist` 自查清单 |
| 网友提问 | `qa` 评论问答 |
| 一句值得截图的话 | `quote` 金句卡 |
| 风险、免责 | `warn` 提示条（risk / info / law） |
| 长视频分段 | `chapter` 章节过场 |
| 结尾 | `end` 片尾收藏卡 |

## 轮换与节奏

- 相邻两段不用同一个场景；同一场景一条片子最多 3 次。两张上卡下人（B）的卡片中间一般切回人物全屏；要连着放时，前一段写 `"panelOut":false`、后一段写 `"panelIn":false`，底色和人物位置不收起。
- 60 秒内卡片不超过 5 张；人物露脸 ≥ 55%；两张 B 卡之间切回人物全屏。

## 各场景字段

**A · 叠层与钩子**（scenes_a.jsx）
- `hook`：`kicker` `lines[2]` `hl` `hlAt` `scrim`
- `hookQ`：`kicker` `lines[2]` `hl` `hlAt` `mark`
- `hookNum`：`kicker` `pre` `num` `unit` `from` `numAt` `line` `hl` `hlAt`
- `hookFlip`：`kicker` `a` `x` `b` `y` `strikeAt` `bAt` `markAt`
- `term`：`kicker` `word` `sub` `def` `hl` `hlAt` `chips[]` `chipAt`
- `nameplate`：`name` `role` `org` `stat{pre,num,unit,at}` `lineAt`
- `quote`：`lines[2]` `hl` `hlAt` `by` `byAt`
- `warn`：`kind`(risk/info/law) `label` `text` `hl` `hlAt`
- `chapter`：`pre` `no` `post` `title` `titleAt` `dim` `dock` `total`

**B · 数据**（scenes_b.jsx）
- `number`：`kicker` `title` `value` `decimals` `prefix` `unit` `countAt` `chip` `chipAt` `labels[]` `segAt[]` `warnLast` `source`
- `numCompare`：`a{label,value,unit}` `b{…}` `aAt` `bAt` `mode`(arrow/vs) `delta{pre,value,unit,at}`
- `percent`：`value` `ringAt` `lines[]` `lineAt[]` `hl` `hlAt`
- `bars`：`items[{label,value,unit,hot,at}]` `unit` `max` `barsAt` `hotAt`
- `timeline`：`nodes[{label,sub,at,warn}]` `firstAt` `gap` `layout`(B|C|auto) `dir`(h|v)；节点多或说明长自动竖排，C 全屏见下方「内容多时」
- `table`：`cols[]` `rows[[]]`（单元格写 ✓ / ✕ 自动变图标） `rowAt[]` `accentCol` `focus[{row,at}]` `layout`(B|C|auto) `perPage` `pageGap`；行多时分页或 C 全屏，见下方「内容多时」
- `compare`：`wrongLabel` `wrong` `rightLabel` `right` `strikeAt` `rightAt` `hlAt`
- `formula`：`items[{op,label,value,unit}]` `result{label,value,unit}` `itemsAt` `resultAt` `mode`

**B/C · 原文、流程、互动、结尾**（scenes_c.jsx）
- `doc`：`source` `article` `text` `marks[{text,at,bold}]` `label` `note` `zoom`
- `shot`：`src`（图片素材 assetId，或入口同目录文件名） `ratio`（建议写 宽/高） `kicker` `title` `boxes[{x,y,w,h,at}]`（0–1 比例，相对整张截图） `note{text,at,box}` `source` `focus`（auto/zoom/scroll/none，默认 auto：长图滚动、横图推近） `start`（scroll 起始位置 0–1，默认 0）
- `chat`：`who` `sub` `msgs[{me,text,at,mark,markAt}]`
- `steps`：`items[{t,d,at}]` `endAt`（at 写负数 = 之前已讲完，用于中途切回人物后接着讲）
- `checklist`：`items[{t,ok,at}]` `verdict{text,at}` `strike`
- `flow`（C）：`nodes[{t,d,at}]` `branch{from,label,t,d,at}` `ring`
- `qa`：`user` `avatar` `ask` `points[{t,at,mark}]`
- `end`（全屏）：`items[{k,t,at}]` `save` `column` `notice` `saveAt`
- `trio` 清单/对比表/聊天三合一：`kicker` `title` `items[{label,at}]`（最多 3 格，顺序固定：清单、对比表、聊天记录） `source`；可选 `tableHead`（对比表两列表头，2 个词，默认 ["方案A","方案B"]）、`chatAsk`（聊天提问气泡，默认「这个怎么弄？」）、`chatReply` + `chatHl`（回答气泡，`chatHl` 是荧光笔划过的后半句，默认「照这样做」+「就行」）
- `savescore` 省时间+质量分：`kicker` `title` `rows[{label,at}]`（最多 2 行） `scoreAt` `from` `to`（0–99） `scoreKicker`（默认「视频质量」） `scoreLabel`（默认「提升几个档次」）
- `line` 折线图：`kicker` `title` `points[{label,value}]`（2–8 个） `unit` `lineAt` `lineDur` `hot`（重点点下标，0 起，默认最后一个） `hotAt` `source`

**trio / savescore / line 怎么选、怎么写**（都是 B 上卡下人，卡高固定 600）
- `trio`：口播是「我会给你做出清单、对比表、还有聊天记录」这种**一句话里点名三样东西**时用。三格从左到右依次是清单（打勾）、对比表（✓/✕）、聊天气泡的小动画，格子里的小示意画面样式固定，`label`、对比表表头和两句聊天气泡可以改（表头每个 2–4 字，气泡每句 8 字以内，否则会挤出格子）；说到哪个写哪格的 `say`，说到的那格描边高亮、其余变暗。`label` 30px 一行，控制在 5 个字以内。不是这三样东西时别用（改用 `steps` / `checklist`）。默认 `items[i].at` = at+0.5+0.8i。
- `savescore`：口播是「不光省时间、省精力，质量还能从 80 分提到 99 分」这种**先省下、再拔高**的两段式时用。第一幕每行一根进度条缩短并出「✓省下」，`label` 36px 宽 120，最多 3 个字；第二幕在 `scoreAt` 前 0.35 s 淡入分数环，1 s 从 `from` 滚到 `to`。分数只有两位，`from`/`to` 写 0–99。只说省时间不说效果时用 `number` 或 `bars`；只说提升多少用 `numCompare`。默认 `rows[i].at` = at+0.6+0.5i，`scoreAt` = dur−1.8。建议 `rows[i].say` 写「时间」「精力」，`scoreSay` 写「提升」之类说到效果的字。
- `line`：口播在讲**连续几个时间点的变化趋势**（一周、几个月、几年）时用；只比两个数用 `numCompare`，比几项大小用 `bars`。折线从 `lineAt` 起 `lineDur`（默认 1.2 s）从左到右画出，点随线出现；`hotAt` 把重点点放大并在上方显示数值 + `unit`。纵轴从 0 起，`value` 不能是负数。`label` 26px，点越多越要短（7 个点时每个 ≤ 4 字）。默认 `lineAt` = at+0.5，`hotAt` = lineAt+lineDur。

## 风格包（theme.jsx）

| 项 | 可选值 |
|---|---|
| `accent` 强调色 | gold 暖金 · jade 青瓷绿 · azure 雾蓝 · wine 酒红 · coral 珊瑚橙 · silver 银灰 |
| `base` 底色 | ink 墨黑 · midnight 深海蓝 · forest 墨绿 · ivory 象牙白（浅色版） |
| `card` 卡片质感 | paper 纸白圆角 · glass 玻璃 · line 细线框 · slab 直角厚卡 |
| `title` 标题字体 | sans 思源黑体 · serif 思源宋体 · elegant 细宋体 |
| `num` 数字字体 | barlow 窄体 · oswald 粗窄体 · bebas 海报体 · serif 衬线数字 |
| `motion` 进场 | rise 上移淡入 · mask 遮罩升起 · slide 侧滑 · scale 轻缩放 · wipe 从左擦开 |
| `subtitle` 字幕 | shadow 白字投影 · bar 半透明底条 · outline 细描边 · lowkey 小字低调 |
| `tag` 栏目标签 | bar 竖条 · chip 胶囊 · line 下划线 · none |

6 × 4 × 4 × 3 × 4 × 5 × 4 × 4 ≈ 9.2 万种组合。推荐 6 套见 combos.jsx：经典墨金、深海雾蓝、墨绿青瓷、象牙酒红、珊瑚暖调、银灰极简。

配色规则（lib.jsx 自动处理，不用手动改）：
- **wine 酒红**：警示色（打叉、划掉、风险提示条、数字 warn）自动从红色换成琥珀橙 `#C9761A`，和酒红分开。场景里用 `K.warn` / `K.warnSoft`，不要写死红色。
- **silver 银灰**：强调色接近白色，字幕关键词 `{k}` 改成「反白」（银底深字小块），字幕数字 `{n}` 加下划线；浅色卡上的荧光笔改用深灰。

## 内容多时：table / timeline（正文 ≥ 28px）

- **版式字段 `layout`**：`"B"`（默认，上卡下人）| `"C"`（全屏讲解，人物缩进左下圆窗）| `"auto"`（按下面规则选）。**不写就一直是 B，渲染从不悄悄换版式**；剪辑脚本要么直接写 `"layout":"C"`，要么写 `"auto"` 并用下面的 Python 算出实际版式（人物要不要缩进圆窗）。
  - table `auto` → C：按 B 排要翻页（页数 > 1）。
  - timeline `auto` → C：节点 ≥ 6，或任一 `sub` 字数 > (节点 ≥ 5 ? 14 : 30)。
- **C 版式**：整屏底色 0–0.3s 淡入、`out` 起 0.24s 淡出（`fillIn` / `fillOut` 写 false 不淡，默认跟 `panelIn` / `panelOut`）；卡片 x 72–960、y 276–1240 内居中；`ring`（默认 true）在 at+0.1 起 0.6s 画出圆窗细环。C 段字幕照上面的约定避开圆窗。
- **table 排法**：B 下 ≤ 4 行且所有格子 28px 一行放得下 → 原样。否则密排：首列按内容收窄、格子自动折行（最多 3 行），字号 B 34→28 / C 36→28 取放得下的最大值。每页行数 `perPage`（B ≤ 4、C ≤ 8），不写按最挤格子折行数：B 1 行 4 / 2 行 3 / 3 行以上 2；C 8 / 6 / 4。各页行数平均（前面的页多 1 行），右上角小圆点指示页码。行数上限 12。
- **table 时间**：表头 `headAt`（默认 at+0.25）；第 i 行 `rowAt[i]`（默认 单页 headAt+0.4+rowGap×i；多页 headAt+0.4+pageGap×页号+rowGap×页内序号；rowGap 0.45，pageGap 默认 max(1.6, (out−1.0−headAt−0.4)/页数)）；第 p 页在 **rowAt[该页首行] − 0.3** 翻页（上一页 0.24s 淡出，新行 0.36s 进场）；✓/✕ 在 rowAt+0.2。`focus` 的行不在当前页时不高亮。默认时间只够演示，正式用请按口播写 `rowAt`。
- **timeline 排法**：B 下节点 ≤ 4、横排时 label ≥ 30px 且 sub 两行内 28px 放得下 → 原样横排；否则竖排（左竖线 + 右「节点名 | 说明」）。C 一律竖排。`dir:"h"/"v"` 可强制（强制横排可能小于 28px，不建议）。节点上限 B 6、C 8；建议 label ≤ 7 字，sub ≤ 14 字（B 5–6 节点）/ ≤ 28 字（C）。
- **timeline 时间**（横竖相同）：第 i 个节点在 at+0.2+0.12×i 灰色出现，`nodes[i].at`（默认 firstAt+gap×i，firstAt 默认 at+0.5，gap 默认 0.7）点亮，连线在点亮前 0.4s 开始长。
- JS 里也可直接调用 `SCENES_B.table.times(spec)` / `SCENES_B.timeline.times(spec)` / `.layoutOf(spec)`。

下面 Python 与 scenes_b.jsx 逐条一致（已用 300 组随机 spec × 4 种 layout 对拍，0 差异）：

```python
import math

# 高级感干货风 · table / timeline 的版式判断与时间（与 scenes_b.jsx 一致）
def char_w(ch):
    o = ord(ch)
    if (0x2E80 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF or 0xFF00 <= o <= 0xFFEF or 0x3000 <= o <= 0x303F
            or 0x2018 <= o <= 0x201F or o == 0x2026 or 0x2190 <= o <= 0x21FF or 0x2460 <= o <= 0x24FF):
        return 1.0
    if ch == " ": return 0.3
    if "A" <= ch <= "Z" or "0" <= ch <= "9": return 0.62
    if "a" <= ch <= "z": return 0.55
    return 0.4

def tw(s, size):  # 文字估宽（px）
    return sum(char_w(c) for c in str(s)) * size * 1.04

def _num(v, d):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else d

def _pick(spec, auto_c):
    L = str(spec.get("layout") or "B").upper()
    return "C" if L == "C" or (L == "AUTO" and auto_c) else "B"

MARKS = {"✓", "✕", "√", "×"}
def _txt(c): return "" if c is None else str(c)

def table_pages(spec, L):
    cols = (spec.get("cols") or [])[:4]
    C = max(2, len(cols))
    rows = [r for r in (spec.get("rows") or []) if isinstance(r, list)][:12]
    n = max(1, len(rows))
    W = 792 if L == "C" else 828
    ratio = round(W * (0.3 if C == 4 else 0.34)) if C >= 3 else round(W * 0.42)
    ws_of = lambda fw: [fw if i == 0 else (W - fw) / (C - 1) for i in range(len(cols))]
    ws0 = ws_of(ratio)
    fit1 = lambda c, j: j >= len(ws0) or _txt(c) in MARKS or tw(_txt(c), 28) <= ws0[j] - 28
    hdr_ok = all(tw(_txt(c), 28) <= ws0[j] - 24 for j, c in enumerate(cols))
    pp = int(math.floor(_num(spec.get("perPage"), 0)))
    if L == "B" and pp <= 0 and len(rows) <= 4 and all(fit1(c, j) for r in rows for j, c in enumerate(r)) and hdr_ok:
        return [(0, len(rows))]
    zmax = 36 if L == "C" else 34
    need = math.ceil(max([tw(_txt(cols[0]) if cols else "", zmax)] + [tw(_txt(r[0]) if r else "", zmax) for r in rows])) + 32
    fw = round(min(max(need, round(W * 0.2)), ratio))
    ws = ws_of(fw)
    def lines(c, j, z):
        t = _txt(c)
        if j >= len(ws) or t in MARKS or not t: return 1
        return math.ceil(tw(t, z) / ((ws[j] - 28) * 0.88))
    zc = 32 if L == "C" else 30
    ml = max([1] + [lines(c, j, zc) for r in rows for j, c in enumerate(r)])
    if pp > 0: cap = min(max(pp, 1), 8 if L == "C" else 4)
    elif L == "C": cap = 4 if ml >= 3 else 6 if ml == 2 else 8
    else: cap = 2 if ml >= 3 else 3 if ml == 2 else 4
    P = math.ceil(n / cap)
    pages, st = [], 0
    for p in range(P):
        k = n // P + (1 if p < n % P else 0)
        pages.append((st, st + k)); st += k
    return pages

def table_plan(spec):
    """返回 layout、分页、表头/每行出现时刻、翻页时刻（段内秒）。"""
    L = _pick(spec, len(table_pages(spec, "B")) > 1)
    pages = table_pages(spec, L)
    P = len(pages)
    at = _num(spec.get("at"), 0.15)
    out = _num(spec.get("out"), _num(spec.get("dur"), 5) - 0.3)
    head_at = _num(spec.get("headAt"), at + 0.25)
    gap = _num(spec.get("rowGap"), 0.45)
    t0 = head_at + 0.4
    page_gap = _num(spec.get("pageGap"), max(1.6, (out - 1.0 - t0) / P))
    ra = spec.get("rowAt") or []
    row_at, page_of = [], []
    for p, (a, b) in enumerate(pages):
        for i in range(a, b):
            given = ra[i] if i < len(ra) else None
            row_at.append(_num(given, t0 + (page_gap * p if P > 1 else 0) + gap * (i - a)))
            page_of.append(p)
    flip_at = [None] + [row_at[a] - 0.3 for (a, _) in pages[1:]]
    return {"layout": L, "pages": pages, "headAt": head_at, "rowAt": row_at, "flipAt": flip_at,
            "tickAt": [x + 0.2 for x in row_at]}  # tickAt：该行 ✓/✕ 出现

def timeline_plan(spec):
    nodes = [x for x in (spec.get("nodes") or []) if x]
    n = len(nodes)
    auto_c = n >= 6 or any(len(str(x.get("sub") or "")) > (14 if n >= 5 else 30) for x in nodes)
    L = _pick(spec, auto_c)
    if L == "C": d = "v"
    elif spec.get("dir") in ("h", "v"): d = spec["dir"]
    elif n > 4: d = "v"
    else:
        cw = 828 / max(1, n)
        fit = lambda t, w, mx, mn: math.floor(min(max(w / max(tw(t, 1), 1e-9), mn), mx)) if tw(t, 1) > 0 else mx
        d = "h" if all(fit(x.get("label") or "", cw - 14, 40, 20) >= 30 and (not x.get("sub") or tw(x["sub"], 28) <= (cw - 18) * 2 * 0.88) for x in nodes) else "v"
    keep = 5 if d == "h" else (8 if L == "C" else 6)
    nodes = nodes[:keep]
    at = _num(spec.get("at"), 0.15)
    first = _num(spec.get("firstAt"), at + 0.5)
    gap = _num(spec.get("gap"), 0.7)
    return {"layout": L, "dir": d,
            "showAt": [at + 0.2 + 0.12 * i for i in range(len(nodes))],      # 灰色出现
            "litAt": [_num(x.get("at"), first + gap * i) for i, x in enumerate(nodes)]}  # 点亮（tick）
```


## 自动定时与音效

整条流程见 SKILL.md。`gk_cues.py` 同时生成音效点（8 种音色：whoosh 版式切换/钩子进场、pop 卡片/气泡、tick 逐项/打勾、hit 数字落定、swipe 荧光笔/划掉、ok 结论、no 打叉/风险、type 打字）。三张新卡：`trio` 每格点亮一声 pop；`savescore` 每行「省下」✓ 一声 tick、切到分数幕 swipe（翻页）、分数滚完 hit；`line` 折线画出 swipe、`hotAt` hit。SPEC 里写 `"sfx":false` 这段不配，写 `"sfx":[[秒,"pop"]]` 手动补，`"pop#3"` 指定用音效池里第 3 个。音效怎么挑、怎么调见 sfx.md。

## 截图卡 shot 的 src

- 推荐：在 ChatCut 里把截图导入项目（`push_asset`，`type:"image"`），`src` 填返回的 assetId，`ratio` 填宽÷高。不写 `src` 时画占位图（示例用的就是占位图）。
- 原图导入后别删别挪（ChatCut 引用原文件位置）。电脑截图尽量用 2 倍清晰度（推近 3.5 倍时 1 倍的会略糊）。
- 竖长截图会自动滚动到框的位置，横图自动推近到框；`focus` 可写 `auto`（默认）/`zoom`/`scroll`/`none`，`start` 是滚动起点（0–1）。
- `ratio` 建议写上：不写也能导出，但用 `preview_timeline` 跳着抽帧时，每段第一次抽到的那一帧可能还没读到比例，会先显示截图顶部、没有框。
