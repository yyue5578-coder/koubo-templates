#!/usr/bin/env python3
"""高级感干货风：从每段动效的 SPEC 自动定时（say）、检查、生成音效点。只用 Python 3.9 标准库。

用法:
  gk_cues.py 段.jsx@起始帧+时长帧[:A|B|C] ... [--words tl_words.json] [--fps 30] [-o cues.json] [--events events.json]
  gk_cues.py --gallery [-o gallery_cues.json] [--events gallery_events.json]   # 组件库演示合集（gallery.jsx + combos.jsx）
  gk_cues.py --check-jsx                                                    # 字段表和场景 JSX 实际读取的字段对一遍

  段.jsx：每段动效一个文件，里面有 `const SPEC = /*SPEC*/ {...纯 JSON...} /*END*/;`，时间都是段内秒。
    起始帧、时长帧 = 这段在时间线上的位置。没有 SPEC 的手写动效可以标 :A/:B/:C，只参加轮换检查。
  --words：timeline_words.py 的输出 [{"t":秒,"end":秒,"text":"字"}]。SPEC 里写口播原话的几个字，自动换算成段内秒，
    写回段落文件（say 保留，可重跑）：
      "say":"几个字" → at；"hlSay" → hlAt；"markSay" → markAt；"outSay" → out（其余 xxxSay → xxxAt，endSay → endAt）
      数组里的对象（items/marks/nodes/points/msgs/boxes/focus…）、子对象（stat/verdict/note/delta/branch…）里同样处理；
      值写成数组时得到数组，如 "rowSay":["个体户","专票"] → "rowAt":[…]（table.rowAt、number.segAt、percent.lineAt、term.chipAt）。
      "几个字#2" 取这段里第 2 次出现；只在本段时间范围（前 0.6 s、后 0.3 s 余量）里找；元素比说到那个字早 0.1 s 出现。
      找不到报 ⚠；只找到相近的会提示口播里实际是哪几个字。
  检查（⚠ 必须改，· 提示）：字段名拼错（给最接近写法）、时间超出段长/卡片出场后才发生、先后顺序、文字放不下
    （和 lib.jsx 相同的 charW/fitSize 估算，字号会被压到 <28px 给 ⚠）、整片轮换（相邻两段不用同一场景；
    同一场景 ≤3 次；60 秒内卡片 ≤5 张）、SPEC 的 dur 和时间线段长是否一致。
  -o：{"fps":30,"totalFrames":N,"groups":[{"name":"段名 场景","startFrame":F,"layout":"A|B|C","frames":段长帧,"circle":bool,"panelIn":bool,"panelOut":bool,"cues":[[段内秒,"kind",时长或null,"场合","说明"]]}]}
      场合（role）给 gk_bed.py --pool 按场合挑音效池变体用，见 references/sfx.md
  --events：给 sfx 技能的事件清单（绝对秒）。kind → action 的映射在同目录 sfx_kinds.json。
  SPEC 里可以加 "sfx":[[秒,"kind"],[秒,"type",时长]] 手动补音效（例如打字），"sfx":false 整段不配音效。
  写 "pop#3" 这种形式表示指定用音效池里该音色的第 3 个。

音效规则（8 种音色）:
  whoosh 柔和气流声：B 场景底色展开（panelIn 不是 false，段内 0.05 s）；flow/end 全屏进场；hook/hookQ/hookNum/hookFlip/chapter 进场
  pop    卡片/气泡/提示条进场（离 whoosh < 0.25 s 不配）；chat 每条气泡；warn info/law；shot note；end notice；trio 每格点亮
  tick   逐项出现：steps 每项和收尾 ✓、checklist ✓、timeline 节点、qa 要点、end 要点、term chips、bars、table 行、
         formula 各项、flow 节点和分支、shot 框选、number 进度段、numCompare 第一个数、savescore 每行「省下」✓。
         间隔 < 0.2 s 的一串只给第一个
  hit    柔和落定：number 计数结束、numCompare 第二个数计数结束、percent 环走完、formula 结果计数结束、hookNum 数字落定、nameplate stat 计数结束、
         savescore 质量分滚完（scoreAt+1.0）、line 重点值 hotAt
  swipe  荧光笔扫过/划掉/文件滑入/翻页：hlAt、titleHlAt、markAt、marks[].at、strikeAt、verdict 荧光笔、delta 荧光笔、doc 进场、
         line 折线画出（lineAt）、savescore 翻到质量分（scoreAt−0.35）
  ok     checklist verdict、end 的收藏句     no  checklist ✕、warn risk     type <秒> 打字（保留接口）
  合并：同一时刻（< 0.12 s）同类只留一个；任意两个 cue 至少隔 0.1 s，冲突时按 hit > no > ok > whoosh > pop > swipe > tick 留。
  卡片出场后（out + 0.24 s）或段外的 cue 去掉并报 ⚠。

timeline / table / shot 正在改版（C 全屏版式、竖排、分页、截图镜头）：脚本按段落所在目录（没有就 --mg）里的
  scenes_b.jsx / scenes_c.jsx 自动选新旧规则，开头会打印用的是哪一版。timeline/table 选了 C 版式时按全屏讲解配 whoosh。
★ 下面每个 sc_xxx 函数里的默认时间都是从 mg/scenes_a.jsx / scenes_b.jsx / scenes_c.jsx 抄过来的：
  改 JSX 默认值要同步改这里（--check-jsx 能查出字段增减，查不出默认值变化）。
"""
import argparse, difflib, json, math, os, re, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
MG_DEFAULT = os.path.normpath(os.path.join(HERE, "..", "assets", "mg"))  # 包里自带的组件库；用户项目里的在 --mg 指定
KINDS = ("whoosh", "pop", "tick", "hit", "swipe", "ok", "no", "type")
PRIO = {"hit": 7, "no": 6, "ok": 5, "whoosh": 4, "pop": 3, "swipe": 2, "tick": 1, "type": 0}
KINDS_DEFAULT = {
    "whoosh": {"action": "transition", "strength": "medium", "style": "soft", "dur": 0.42},
    "pop": {"action": "card_in", "strength": "medium", "style": "soft", "dur": 0.36},
    "tick": {"action": "click", "strength": "weak", "style": "soft"},
    "hit": {"action": "impact", "strength": "medium", "style": "soft"},
    "swipe": {"action": "paper_slide", "strength": "weak", "dur": 0.5},
    "ok": {"action": "success", "strength": "weak"},
    "no": {"action": "error", "strength": "weak"},
    "type": {"action": "typing", "strength": "weak", "dur": 1.0},
}


# ======================================================================
# 与 lib.jsx 相同的测量（charW / textW / fitSize），scenes_b 的 fitLines/numW/fmt，scenes_c 的 countLines/clipToLines
# ======================================================================
def char_w(ch):
    o = ord(ch)
    # lib.jsx WIDE = /[⺀-鿿豈-﫿＀-￯　-〿‘-‟…←-⇿①-⓿]/（注意第二段起点是 U+8C48）；JS 里补充平面字符的高代理落在 8C48–FAFF，也算 1.0
    if (0x2E80 <= o <= 0x9FFF or 0x8C48 <= o <= 0xFAFF or 0xFF00 <= o <= 0xFFEF or 0x3000 <= o <= 0x303F
            or 0x2018 <= o <= 0x201F or o == 0x2026 or 0x2190 <= o <= 0x21FF or 0x2460 <= o <= 0x24FF or o > 0xFFFF):
        return 1.0
    if ch == " ":
        return 0.3
    if re.match(r"[A-Z0-9]", ch):
        return 0.62
    if re.match(r"[a-z]", ch):
        return 0.55
    return 0.4


def text_w(s, size):
    return sum(char_w(ch) for ch in jstr(s)) * size * 1.04


def clamp(v, a, b):
    return max(a, min(b, v))


def raw_fit(text, max_w):
    w = text_w(text, 1)
    return max_w / w if w > 0 else float("inf")


def fit_size(text, max_w, max_size, min_size=24):
    return math.floor(clamp(raw_fit(text, max_w), min_size, max_size))


def fit_lines(text, w, mx, mn, lines):  # scenes_b fitLines
    return math.floor(clamp((w * lines * 0.88) / max(1, text_w(text, 1)), mn, mx))


def count_lines(text, size, max_w, ls=0):  # scenes_c countLines
    lines, x = 1, 0.0
    for ch in jstr(text):
        if ch == "\n":
            lines += 1
            x = 0
            continue
        w = char_w(ch) * size * 1.04 + ls * size
        if x + w > max_w and x > 0:
            lines += 1
            x = w
        else:
            x += w
    return lines


def clip_to_lines(text, size, max_w, max_lines):  # scenes_c clipToLines
    chars = list(jstr(text))
    lines, x, i = 1, 0.0, 0
    while i < len(chars):
        ch = chars[i]
        if ch == "\n":
            lines += 1
            x = 0
            if lines > max_lines:
                break
            i += 1
            continue
        w = char_w(ch) * size * 1.04
        if x + w > max_w and x > 0:
            lines += 1
            x = w
            if lines > max_lines:
                break
        else:
            x += w
        i += 1
    if i >= len(chars):
        return "".join(chars), False
    return re.sub(r"[，。、；：,.\s]+$", "", "".join(chars[:max(0, i - 2)])), True


def split_marks(text, marks):  # scenes_c splitMarks：返回真正画出来的 mark
    lst = sorted([dict(m, idx=text.find(m["text"])) for m in marks if m.get("text")], key=lambda m: m["idx"])
    lst = [m for m in lst if m["idx"] >= 0]
    cursor, shown = 0, []
    for m in lst:
        if m["idx"] < cursor:
            continue
        shown.append(m)
        cursor = m["idx"] + len(m["text"])
    return shown


NUM_W = {"barlow": 0.5, "oswald": 0.58, "bebas": 0.44, "serif": 0.62}


def num_w(s, size, th):  # scenes_b numW
    f = NUM_W.get(th["num"], 0.58)
    return sum(f if re.match(r"[0-9]", ch) else 0.26 if ch in ".,:" else char_w(ch) for ch in jstr(s)) * size * th["numScale"]


def to_num(v):
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def fmt(v, dec=0, sep=None):  # scenes_b fmt
    n = to_num(v)
    s = "%.*f" % (int(dec or 0), abs(n))
    use = abs(n) >= 10000 if sep is None else bool(sep)
    if use:
        i, _, d = s.partition(".")
        i = re.sub(r"\B(?=(\d{3})+(?!\d))", ",", i)
        s = i + ("." + d if d else "")
    return ("−" if n < 0 else "") + s


def jstr(v):
    """JS 的 String(v)"""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def jround(x):
    return math.floor(x + 0.5)


def isnum(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def num(v, d):
    """scenes_b / scenes_c 的 num(v, d)：只认有限数字"""
    return float(v) if isnum(v) else d


def nn(v, d):
    """scenes_a 的 `v != null ? v : d`"""
    return d if v is None else (float(v) if isnum(v) else v)


# ======================================================================
# JS 字面量 → JSON（解析 DEMOS / THEME / COMBOS 用）
# ======================================================================
def js_to_json(src):
    out, i, n = [], 0, len(src)

    def skip_ws(j):
        while j < n:
            if src[j].isspace():
                j += 1
            elif src.startswith("//", j):
                k = src.find("\n", j)
                j = n if k < 0 else k + 1
            elif src.startswith("/*", j):
                k = src.find("*/", j + 2)
                j = n if k < 0 else k + 2
            else:
                break
        return j
    while i < n:
        ch = src[i]
        if ch in "\"'":
            j, buf = i + 1, []
            while j < n and src[j] != ch:
                if src[j] == "\\":
                    nxt = src[j + 1] if j + 1 < n else ""
                    buf.append("'" if nxt == "'" else "\\" + nxt)
                    j += 2
                    continue
                buf.append('\\"' if src[j] == '"' else src[j])
                j += 1
            out.append('"' + "".join(buf) + '"')
            i = j + 1
        elif ch == "`":
            raise ValueError("模板字符串 `…`")
        elif src.startswith("//", i) or src.startswith("/*", i):
            i = skip_ws(i)
            out.append(" ")
        elif ch.isalpha() or ch in "_$":
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$"):
                j += 1
            ident = src[i:j]
            k = skip_ws(j)
            if k < n and src[k] == ":":
                out.append('"%s"' % ident)
            elif ident in ("true", "false", "null"):
                out.append(ident)
            else:
                raise ValueError("不是纯数据：%s" % ident)
            i = j
        elif ch == ",":
            k = skip_ws(i + 1)
            if k < n and src[k] in "]}":
                i += 1
            else:
                out.append(ch)
                i += 1
        elif ch == ".":
            if i + 2 < n and src[i:i + 3] == "...":
                raise ValueError("展开运算 ...")
            out.append(ch)
            i += 1
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def find_block(src, start_re, open_ch):
    """找到 start_re 之后第一个 open_ch，返回到配对括号为止的源码（含括号）"""
    m = re.search(start_re, src)
    if not m:
        return None
    i = src.find(open_ch, m.end() - 1)
    close = {"[": "]", "{": "}"}[open_ch]
    depth, j, n = 0, i, len(src)
    while j < n:
        ch = src[j]
        if ch in "\"'`":
            k = j + 1
            while k < n and src[k] != ch:
                k += 2 if src[k] == "\\" else 1
            j = k + 1
            continue
        if src.startswith("//", j):
            k = src.find("\n", j)
            j = n if k < 0 else k
            continue
        if src.startswith("/*", j):
            j = src.find("*/", j + 2) + 2
            continue
        if ch in "[{(":
            depth += 1
        elif ch in "]})":
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
        j += 1
    return None


def split_top(body):
    """[a, b, c] → ['a','b','c']（顶层逗号切分，跳过字符串和注释）"""
    inner, parts, depth, cur, j, n = body[1:-1], [], 0, [], 0, len(body) - 2
    while j < n:
        ch = inner[j]
        if ch in "\"'`":
            k = j + 1
            while k < n and inner[k] != ch:
                k += 2 if inner[k] == "\\" else 1
            cur.append(inner[j:k + 1])
            j = k + 1
            continue
        if inner.startswith("//", j):
            k = inner.find("\n", j)
            k = n if k < 0 else k
            cur.append(inner[j:k])
            j = k
            continue
        if ch in "[{(":
            depth += 1
        elif ch in "]})":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
        j += 1
    parts.append("".join(cur))
    return [p for p in parts if re.sub(r"//[^\n]*|\s", "", p)]


def parse_js_array(path, name):
    """返回 (元素列表, 问题列表)。解析不了的元素用正则捞 scene / dur，标 _unparsed。"""
    src = open(path, encoding="utf-8").read()
    body = find_block(src, r"\b%s\s*=\s*\[" % re.escape(name), "[")
    if body is None:
        return [], ["%s 里没找到 %s" % (os.path.basename(path), name)]
    items, errs = [], []
    for k, part in enumerate(split_top(body)):
        try:
            items.append(json.loads(js_to_json(part)))
        except (ValueError, json.JSONDecodeError) as e:
            sc = re.search(r"[\"']?scene[\"']?\s*:\s*[\"']([^\"']+)", part)
            du = re.search(r"[\"']?dur[\"']?\s*:\s*([0-9.]+)", part)
            items.append({"scene": sc.group(1) if sc else "?", "dur": float(du.group(1)) if du else 4.5, "_unparsed": str(e)})
            errs.append("%s 第 %d 项解析不了（%s），只取了 scene/dur，这段不生成音效" % (name, k + 1, e))
    return items, errs


def parse_js_object(path, name):
    if not os.path.exists(path):
        return None
    src = open(path, encoding="utf-8").read()
    body = find_block(src, r"\b%s\s*=\s*\{" % re.escape(name), "{")
    if body is None:
        return None
    try:
        return json.loads(js_to_json(body))
    except (ValueError, json.JSONDecodeError):
        return None


# ======================================================================
# 风格包（影响字宽估算：标题 elegant 留 7%、数字字体宽度）
# ======================================================================
def make_theme(base=None, over=None):
    T = {"title": "sans", "num": "barlow"}
    T.update(base or {})
    T.update(over or {})
    T["numScale"] = 1.12 if T.get("num") == "bebas" else 0.92 if T.get("num") == "serif" else 1.0
    T["elegant"] = T.get("title") in ("elegant", "xiaowei")
    return T


def tw7(th, w):  # scenes_b tw7 / scenes_c fitTitle：细宋体带字距，估宽扣 7%
    return w / 1.07 if th["elegant"] else w


# ======================================================================
# 场景表：版式 + 字段（字段从 JSX 实际读取的整理；--check-jsx 可复核）
# ======================================================================
LAYOUT = {"hook": "A", "hookQ": "A", "hookNum": "A", "hookFlip": "A", "term": "A", "nameplate": "A", "quote": "A", "warn": "A", "chapter": "A",
          "number": "B", "numCompare": "B", "percent": "B", "bars": "B", "timeline": "B", "table": "B", "compare": "B", "formula": "B",
          "doc": "B", "shot": "B", "chat": "B", "steps": "B", "checklist": "B", "qa": "B", "flow": "C", "end": "C",
          "trio": "B", "savescore": "B", "line": "B"}
COMMON = {"scene", "dur", "out", "sfx"}
_BH = {"at", "panelIn", "panelOut", "kicker", "title", "titleHl", "titleHlAt", "source"}  # scenes_b：useB + Head + srcH
_CB = {"at", "panelIn", "panelOut"}  # scenes_c 的 B 场景：cardAtOf + BStage
SCHEMA = {
    "hook": {"_": {"kicker", "lines", "hl", "hlAt", "scrim"}},
    "hookQ": {"_": {"kicker", "lines", "hl", "hlAt", "mark", "scrim"}},
    "hookNum": {"_": {"kicker", "pre", "num", "unit", "from", "numAt", "line", "hl", "hlAt", "scrim"}},
    "hookFlip": {"_": {"kicker", "a", "x", "b", "y", "strikeAt", "bAt", "markAt", "scrim"}},
    "term": {"_": {"at", "motion", "y", "kicker", "word", "sub", "def", "hl", "hlAt", "chips", "chipAt"}},
    "nameplate": {"_": {"at", "motion", "y", "name", "role", "org", "stat", "lineAt"}, "stat": {"pre", "num", "unit", "at"}},
    "quote": {"_": {"at", "y", "lines", "hl", "hlAt", "by", "byAt"}},
    "warn": {"_": {"at", "motion", "y", "kind", "label", "text", "hl", "hlAt"}},
    "chapter": {"_": {"pre", "no", "post", "title", "titleAt", "dim", "dock", "total"}},
    "number": {"_": _BH | {"value", "decimals", "sep", "prefix", "unit", "countAt", "chip", "chipAt", "labels", "segs", "segAt", "warnLast", "warn", "accentNum"}},
    "numCompare": {"_": _BH | {"a", "b", "aAt", "bAt", "mode", "delta", "deltaAt"},
                   "a": {"label", "value", "unit", "prefix", "decimals", "sep", "warn"}, "b": {"label", "value", "unit", "prefix", "decimals", "sep", "warn"},
                   "delta": {"pre", "value", "unit", "post", "at", "decimals", "warn"}},
    "percent": {"_": _BH | {"value", "decimals", "ringAt", "countDur", "lines", "lineAt", "hl", "hlAt", "warn"}},
    "bars": {"_": _BH | {"items", "unit", "decimals", "max", "hot", "barsAt", "gap", "hotAt"}, "items": {"label", "value", "unit", "hot", "at", "decimals"}},
    "timeline": {"_": _BH | {"nodes", "firstAt", "gap"}, "nodes": {"label", "sub", "at", "warn"}},
    "table": {"_": _BH | {"cols", "rows", "headAt", "rowAt", "rowGap", "accentCol", "focus", "focusOff"}, "focus": {"row", "at"}},
    "compare": {"_": _BH | {"wrongLabel", "wrong", "rightLabel", "right", "wrongAt", "strikeAt", "rightAt", "hlAt"}},
    "formula": {"_": _BH | {"items", "result", "mode", "itemsAt", "gap", "resultAt", "sep"},
                "items": {"op", "label", "value", "text", "unit", "decimals", "sep", "at"},
                "result": {"label", "value", "unit", "prefix", "decimals", "sep", "warn"}},
    "doc": {"_": _CB | {"source", "article", "text", "marks", "mark", "label", "note", "zoom"}, "marks": {"text", "at", "bold"}, "mark": {"text", "at", "bold"}},
    "shot": {"_": _CB | {"src", "ratio", "kicker", "title", "boxes", "note", "source"}, "boxes": {"x", "y", "w", "h", "at"}, "note": {"text", "at", "box"}},
    "chat": {"_": _CB | {"who", "sub", "meName", "msgs", "source"}, "msgs": {"me", "text", "at", "mark", "markAt"}},
    "steps": {"_": _CB | {"kicker", "title", "items", "endAt"}, "items": {"t", "d", "at"}},
    "checklist": {"_": _CB | {"kicker", "title", "items", "strike", "verdict", "source"}, "items": {"t", "ok", "at"}, "verdict": {"text", "at", "markAt", "label"}},
    "flow": {"_": {"at", "kicker", "title", "nodes", "branch", "ring", "fillIn", "fillOut"}, "nodes": {"t", "d", "at"}, "branch": {"from", "label", "t", "d", "at"}},
    "qa": {"_": _CB | {"user", "avatar", "kicker", "ask", "answerLabel", "answerAt", "points"}, "points": {"t", "at", "mark", "markAt"}},
    "end": {"_": {"at", "kicker", "title", "items", "save", "column", "notice", "noticeAt", "saveAt", "fillIn"}, "items": {"k", "t", "at"}},
    "trio": {"_": _CB | {"kicker", "title", "items", "source", "tableHead", "chatAsk", "chatReply", "chatHl"}, "items": {"label", "at"}},
    "savescore": {"_": _CB | {"kicker", "title", "rows", "scoreAt", "from", "to", "scoreLabel", "scoreKicker"}, "rows": {"label", "at"}},
    "line": {"_": _CB | {"kicker", "title", "points", "unit", "lineAt", "lineDur", "hot", "hotAt", "source"}, "points": {"label", "value"}},
}
ENUMS = {("warn", "kind"): {"risk", "info", "law"}, ("numCompare", "mode"): {"arrow", "vs"}, ("formula", "mode"): {"row", "list"}}
LIST_AT = {"rowAt", "segAt", "lineAt", "chipAt"}  # 可以是数组的时间字段


def is_say(k):
    return k == "say" or (k.endswith("Say") and len(k) > 3)


def say_target(k):
    if k == "say":
        return "at"
    base = k[:-3]
    return base if base == "out" else base + "At"  # outSay → out；endSay → endAt（步骤卡的 endAt）



# ======================================================================
# JSX 版本探测：timeline/table/shot 正在改版，按当前 JSX 里实际的代码选规则
# ======================================================================
PROFILE = {"tl_v2": False, "tt_v2": False, "shot_v2": False, "shot_gap": 0.6, "src": None}


def detect_profile(dirs):
    for d in dirs:
        pb, pc = os.path.join(d, "scenes_b.jsx"), os.path.join(d, "scenes_c.jsx")
        if os.path.exists(pb) and os.path.exists(pc):
            b, c = open(pb, encoding="utf-8").read(), open(pc, encoding="utf-8").read()
            PROFILE["tl_v2"] = "tlAutoC" in b and "function TimelineV" in b
            PROFILE["tt_v2"] = "function tablePlan" in b and "function tableTimes" in b
            PROFILE["shot_v2"] = "function shotHead" in c
            m = re.search(r"num\(b\.at,\s*at\s*\+\s*1(?:\.0)?\s*\+\s*([0-9.]+)\s*\*\s*i\)", c)
            PROFILE["shot_gap"] = float(m.group(1)) if m else 0.6
            PROFILE["src"] = d
            if PROFILE["tl_v2"]:
                SCHEMA["timeline"]["_"] |= {"layout", "dir", "fillIn", "fillOut", "ring"}
                ENUMS[("timeline", "dir")] = {"h", "v"}
            if PROFILE["tt_v2"]:
                SCHEMA["table"]["_"] |= {"layout", "perPage", "pageGap", "fillIn", "fillOut", "ring"}
            if PROFILE["shot_v2"]:
                SCHEMA["shot"]["_"] |= {"focus", "start"}
                ENUMS[("shot", "focus")] = {"auto", "zoom", "scroll", "none"}
            return PROFILE
    return PROFILE


def profile_line():
    return "JSX：%s（timeline %s；table %s；shot %s，框默认间隔 %.1f s）" % (
        PROFILE["src"] or "没找到 scenes_b/c.jsx，按旧版规则",
        "新版 B/C/竖排" if PROFILE["tl_v2"] else "原版横排", "新版 分页/C" if PROFILE["tt_v2"] else "原版",
        "新版" if PROFILE["shot_v2"] else "原版", PROFILE["shot_gap"])

# ======================================================================
# 段落
# ======================================================================
class Seg:
    def __init__(self, name, start, dur_f, fps, spec=None, path=None, layout=None, theme=None):
        self.name, self.start, self.dur_f, self.fps = name, start, dur_f, fps
        self.dur = dur_f / fps
        self.spec, self.path, self.theme = spec, path, theme or make_theme()
        sc = spec.get("scene") if isinstance(spec, dict) else None
        self.scene = sc
        self.layout = LAYOUT.get(sc) or layout or "A"
        self.raw, self.cues, self.dropped, self.warn, self.say_log = [], [], [], [], []
        self.vis_end = self.dur
        self.no_sfx = False

    @classmethod
    def from_arg(cls, arg, fps, theme):
        m = re.match(r"^(.+)@(\d+)\+(\d+)(?::([ABC]))?$", arg)
        if not m:
            sys.exit("参数格式应为 段落.jsx@起始帧+时长帧[:A|B|C]：%s" % arg)
        path, start, dur_f, lay = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        src = open(path, encoding="utf-8").read()
        sm = re.search(r"/\*SPEC\*/(.*?)/\*END\*/", src, re.S)
        spec, err = None, None
        if sm:
            try:
                spec = json.loads(sm.group(1))
            except json.JSONDecodeError as e:
                err = "SPEC 不是合法 JSON（%s）：键和字符串都要双引号，最后一项后面不能有逗号" % e
        g = cls(re.sub(r"\.jsx$", "", os.path.basename(path)), start, dur_f, fps, spec, path, lay, theme)
        if err:
            g.w(err)
        return g

    def c(self, t, kind, why, d=None):
        if isnum(t):
            self.raw.append([round(float(t), 3), kind, why, d])

    def w(self, msg):
        self.warn.append(("⚠", msg))

    def hint(self, msg):
        self.warn.append(("·", msg))

    def tcheck(self, label, v, lo=0.0, allow_neg=False):
        """显式写的时间字段：要是数字、在段内"""
        if v is None:
            return
        if not isnum(v):
            self.w("%s 要写数字（秒），现在是 %r" % (label, v))
            return
        if (v < lo and not allow_neg) or v > self.dur + 1e-6:
            self.w("%s=%.2f 不在这段动效内（0–%.2f s）" % (label, v, self.dur))

    def after(self, label, v, ref, ref_label, strict=False, warn=True):
        if isnum(v) and isnum(ref) and (v < ref - 1e-6 or (strict and abs(v - ref) < 1e-6)):
            (self.w if warn else self.hint)("%s=%.2f 早于%s（%.2f s）" % (label, v, ref_label, ref))


def chk_fit(g, label, text, max_w, mx, mn, thr=None):
    """单行自动字号检查：最小字号还放不下 → ⚠；会压到 <28px（或比上限小 2px 以上，上限本来就 ≤28 时）→ ⚠"""
    if not text:
        return mx
    raw = raw_fit(text, max_w)
    size = math.floor(clamp(raw, mn, mx))
    thr = min(28, mx - 2) if thr is None else thr
    if raw < mn:
        g.w("%s「%s」放不下：最小 %dpx 还超宽约 %d%%，会出框或被截断。删几个字" % (label, text, mn, round((mn / raw - 1) * 100)))
    elif size < thr:
        g.w("%s「%s」字号会压到 %dpx（<28），删几个字" % (label, text, size))
    return size


def has(text, key):
    return isinstance(text, str) and isinstance(key, str) and key != "" and key in text


def limit(g, arr, n, what):
    if isinstance(arr, list) and len(arr) > n:
        g.w("%s 有 %d 条，只显示前 %d 条" % (what, len(arr), n))
    return (arr if isinstance(arr, list) else [])[:n]


def in_order(g, what, ats):
    for i in range(1, len(ats)):
        if isnum(ats[i]) and isnum(ats[i - 1]) and ats[i] < ats[i - 1] - 1e-6:
            g.w("%s 第 %d 条的时间 %.2f 比第 %d 条（%.2f）早，要按说的先后排" % (what, i + 1, ats[i], i, ats[i - 1]))


# ======================================================================
# A 批次（scenes_a.jsx）—— 改 JSX 默认值要同步改这里
# ======================================================================
def seg_a(g, s):
    dur = nn(s.get("dur"), g.dur)  # useSeg：spec.dur 优先
    out = nn(s.get("out"), dur - 0.3)
    g.vis_end = out + 0.24
    return dur, out


def sc_hook(g, s):  # HookScene：0 s 压暗+引子，0.25/0.37 s 大字升起；hlAt 默认 1.1
    seg_a(g, s)
    lines = limit(g, s.get("lines"), 2, "lines")
    if not lines:
        g.w("hook 要写 lines（两行大字）")
    g.c(0.0, "whoosh", "钩子进场")
    for l in lines:
        chk_fit(g, "大字", jstr(l), 936, 104, 56)
    chk_fit(g, "kicker", s.get("kicker"), 856, 36, 26)
    hl_at = nn(s.get("hlAt"), 1.1)
    hook_hl(g, s, lines, hl_at)


def sc_hookq(g, s):  # HookQScene：问号 0.12 s 起，大字 0.3/0.42 s 升起；hlAt 默认 1.0
    seg_a(g, s)
    lines = limit(g, s.get("lines"), 2, "lines")
    if not lines:
        g.w("hookQ 要写 lines（两行问题）")
    g.c(0.1, "whoosh", "钩子进场")
    mark = s.get("mark") or "?"
    q = 88 * 1.25 * 2
    right_w = 936 - max(text_w(mark, q) * 0.95, q * 0.42) - 34
    for l in lines:
        chk_fit(g, "大字", jstr(l), right_w - 24, 88, 50)
    chk_fit(g, "kicker", s.get("kicker"), 856, 36, 26)
    hook_hl(g, s, lines, nn(s.get("hlAt"), 1.0))


def hook_hl(g, s, lines, hl_at):
    hl = s.get("hl")
    g.tcheck("hlAt", s.get("hlAt"))
    if not hl:
        return
    if any(has(jstr(l), hl) for l in lines):
        g.c(hl_at, "swipe", "hlAt 关键词")
        if isnum(hl_at) and hl_at < 0.55:
            g.hint("hlAt=%.2f：大字 0.25–0.75 s 才升起，划线会在字没出来时开始" % hl_at)
    else:
        g.w("hl「%s」不在 lines 里，不会划线" % hl)


def sc_hooknum(g, s):  # HookNumScene：numAt 默认 0.35，计数 0.6 s；说明句 numAt+0.45 进场；hlAt 默认 numAt+0.9
    seg_a(g, s)
    th = g.theme
    g.c(0.0, "whoosh", "钩子进场")
    num_at = nn(s.get("numAt"), 0.35)
    g.tcheck("numAt", s.get("numAt"))
    if isnum(num_at):
        g.c(num_at + 0.6, "hit", "数字落定 numAt+0.6")
    num_str = jstr(s.get("num") if s.get("num") is not None else 0)
    pre, unit = s.get("pre") or "", s.get("unit") or ""
    digit_w = 0.62 * th["numScale"] * 1.04 * (1.1 if th["num"] == "serif" else 1)
    unit_ascii = bool(re.match(r"^[\x00-\x7F]*$", unit))
    per = len(num_str) * digit_w + (text_w(pre, 1) * 0.34 + 0.06 if pre else 0) + \
        ((text_w(unit, 1) * 0.55 * th["numScale"] if unit_ascii else text_w(unit, 1) * 0.34) + 0.06 if unit else 0)
    if per and 936 / per < 140:
        g.w("数字行「%s%s%s」太长：最小 140px 还超宽，换短一点的写法（如 万/亿 作单位）" % (pre, num_str, unit))
    line = s.get("line")
    chk_fit(g, "line", line, 936, 60, 36)
    chk_fit(g, "kicker", s.get("kicker"), 856, 36, 26)
    hl, hl_at = s.get("hl"), nn(s.get("hlAt"), (num_at + 0.9) if isnum(num_at) else None)
    g.tcheck("hlAt", s.get("hlAt"))
    if hl:
        if has(line, hl):
            g.c(hl_at, "swipe", "hlAt 关键词")
            if isnum(num_at):
                g.after("hlAt", hl_at, num_at + 0.45, "说明句出现（numAt+0.45）")
        else:
            g.w("hl「%s」不在 line 里，不会划线" % hl)


def sc_hookflip(g, s):  # HookFlipScene：第一行 0.25 s 升起；strikeAt 0.9 → bAt strikeAt+0.45 → markAt bAt+0.35
    seg_a(g, s)
    g.c(0.0, "whoosh", "钩子进场")
    a = s.get("a") if s.get("a") is not None else "很多人以为"
    b = s.get("b") if s.get("b") is not None else "其实"
    x, y = jstr(s.get("x")), jstr(s.get("y"))
    if not x or not y:
        g.w("hookFlip 要写 x（被划掉的说法）和 y（其实）")

    def fit_row(lead, big):
        return 936 / (text_w(lead, 1) * 0.56 + text_w(big, 1) + 0.2)
    raw = min(fit_row(a, x), fit_row(b, y))
    if raw < 46:
        g.w("x/y 太长：最小 46px 还放不下一行（「%s」/「%s」），删几个字" % (x, y))
    chk_fit(g, "kicker", s.get("kicker"), 856, 36, 26)
    for k in ("strikeAt", "bAt", "markAt"):
        g.tcheck(k, s.get(k))
    strike = nn(s.get("strikeAt"), 0.9)
    b_at = nn(s.get("bAt"), strike + 0.45 if isnum(strike) else None)
    mark = nn(s.get("markAt"), b_at + 0.35 if isnum(b_at) else None)
    g.c(strike, "swipe", "strikeAt 划掉")
    g.c(mark, "swipe", "markAt 荧光笔")
    if isnum(strike) and strike < 0.5:
        g.hint("strikeAt=%.2f：第一行 0.25–0.75 s 才升起，划线会在字没出来时开始" % strike)
    g.after("bAt（其实那行升起）", b_at, strike, "strikeAt 划掉", warn=False)
    if isnum(mark) and isnum(b_at) and mark < b_at + 0.2:
        g.w("markAt=%.2f 早于「%s」那行升起（bAt=%.2f，升起要 0.5 s）" % (mark, b, b_at))


def sc_term(g, s):  # TermScene：at 默认 0.15；chips 默认 at+1+0.6i；hlAt 默认 at+0.9
    seg_a(g, s)
    at = nn(s.get("at"), 0.15)
    g.tcheck("at", s.get("at"))
    g.c(at, "pop", "名词卡进场")
    inner = 840 - 58 - 40
    chk_fit(g, "word", s.get("word"), inner * 0.62, 64, 40)
    if s.get("def") and text_w(s["def"], 30) > inner * 2 * 0.97:
        g.w("def 超过两行，第二行末尾会被截断：「%s」" % s["def"])
    chips = limit(g, s.get("chips"), 4, "chips")
    ca = s.get("chipAt")
    times = []
    for i in range(len(chips)):
        if isinstance(ca, list):
            times.append(ca[i] if i < len(ca) and ca[i] is not None else at + 1 + 0.6 * i)
        else:
            times.append((ca if ca is not None else at + 1.0) + 0.6 * i)
    if isinstance(ca, list):
        for i, v in enumerate(ca):
            g.tcheck("chipAt[%d]" % (i + 1), v)
    else:
        g.tcheck("chipAt", ca)
    for i, t in enumerate(times):
        g.c(t, "tick", "chip %d" % (i + 1))
        g.after("chip %d" % (i + 1), t, at, "卡片进场 at")
    n = len(chips)
    if n:
        raw = (inner - n * 50 - 14 * (n - 1)) / sum(text_w(c, 1) + 1.25 for c in chips)
        size = math.floor(clamp(raw, 26, 42))
        if raw < 26:
            g.w("chips 一行放不下（%s），删字或减少个数" % " / ".join(map(jstr, chips)))
        elif size < 28:
            g.w("chips 字号会压到 %dpx（<28），删字或减少个数" % size)
    in_order(g, "chips", times)
    hl, hl_at = s.get("hl"), nn(s.get("hlAt"), at + 0.9)
    g.tcheck("hlAt", s.get("hlAt"))
    if hl:
        if has(s.get("def"), hl):
            g.c(hl_at, "swipe", "hlAt 释义荧光笔")
            g.after("hlAt", hl_at, at, "卡片进场 at")
        else:
            g.w("hl「%s」不在 def 里，不会画荧光笔" % hl)


def sc_nameplate(g, s):  # NameplateScene：at 默认 0.1；stat.at 默认 at+0.6，计数 0.6 s
    seg_a(g, s)
    th = g.theme
    at = nn(s.get("at"), 0.1)
    g.tcheck("at", s.get("at"))
    g.c(at, "pop", "身份条进场")
    st0 = s.get("stat") if isinstance(s.get("stat"), dict) else None
    stat_w = 0
    if st0:
        ss = jstr(st0.get("num"))
        stat_w = 2 + 36 + text_w(st0.get("pre") or "", 26) + 8 + len(ss) * 0.62 * 64 * th["numScale"] + 8 + text_w(st0.get("unit") or "", 26)
        stat_at = nn(st0.get("at"), at + 0.6)
        g.tcheck("stat.at", st0.get("at"))
        g.c(stat_at + 0.6, "hit", "stat 计数结束 stat.at+0.6")
        g.after("stat.at", stat_at, at, "身份条进场 at")
    chk_fit(g, "name", s.get("name"), 772 - stat_w, 60, 40)
    role = "  ·  ".join(x for x in (s.get("role"), s.get("org")) if x)
    chk_fit(g, "role · org", role, 772, 30, 22)
    g.tcheck("lineAt", s.get("lineAt"))


def sc_quote(g, s):  # QuoteScene：at 默认 0.15；两行 at+0.2/+0.32 进；hlAt 默认 at+1.0；byAt at+0.6
    seg_a(g, s)
    at = nn(s.get("at"), 0.15)
    g.tcheck("at", s.get("at"))
    g.c(at, "pop", "金句卡进场")
    lines = limit(g, s.get("lines"), 2, "lines")
    for l in lines:
        chk_fit(g, "金句", jstr(l), 936 - 108 - 8, 62, 38)
    chk_fit(g, "by", s.get("by"), 828, 28, 20, thr=22)
    hl, hl_at = s.get("hl"), nn(s.get("hlAt"), at + 1.0)
    g.tcheck("hlAt", s.get("hlAt"))
    g.tcheck("byAt", s.get("byAt"))
    if hl:
        if any(has(jstr(l), hl) for l in lines):
            g.c(hl_at, "swipe", "hlAt 荧光笔")
            g.after("hlAt", hl_at, at + 0.2, "金句出现（at+0.2）")
        else:
            g.w("hl「%s」不在 lines 里，不会画荧光笔" % hl)


WARN_LABEL = {"risk": "注意", "info": "提示", "law": "声明"}


def sc_warn(g, s):  # WarnScene：at 默认 0.3；hlAt 默认 at+0.8
    seg_a(g, s)
    at = nn(s.get("at"), 0.3)
    g.tcheck("at", s.get("at"))
    kind = s.get("kind") or "risk"
    g.c(at, "no" if kind == "risk" else "pop", "风险提示条" if kind == "risk" else "提示条进场")
    label = s.get("label") if s.get("label") is not None else WARN_LABEL.get(kind, "提示")
    base = 28 if kind == "law" else 32
    lab_w = text_w(label, base) + 14 if label else 0
    text = jstr(s.get("text"))
    raw = raw_fit(text, 840 - 54 - 30 - lab_w - 6)
    size = math.floor(clamp(raw, 20, base))
    if size < 24:
        size2 = 25 if kind == "law" else 27
        col = 840 - 84 - (text_w(label, size2) + 14 if label else 0)
        nl = count_lines(text, size2, col)
        if nl > 2:
            g.w("提示条文字太长：%dpx 两行都放不下，会截断。删字：「%s」" % (size2, text))
        else:
            g.w("提示条文字一行放不下，会改成两行 %dpx（<28）。能删就删：「%s」" % (size2, text))
    elif size < min(28, base - 2):
        g.w("提示条字号会压到 %dpx（<28）：「%s」" % (size, text))
    hl, hl_at = s.get("hl"), nn(s.get("hlAt"), at + 0.8)
    g.tcheck("hlAt", s.get("hlAt"))
    if hl:
        if has(text, hl):
            g.c(hl_at, "swipe", "hlAt 荧光笔")
            g.after("hlAt", hl_at, at, "提示条进场 at")
        else:
            g.w("hl「%s」不在 text 里，不会画荧光笔" % hl)


def sc_chapter(g, s):  # ChapterScene：0 s 压暗进场；dim 默认 1.2（0.6–2.0）；dock:false 时 dim 后退场
    dur, out = seg_a(g, s)
    dim = clamp(to_num(nn(s.get("dim"), 1.2)), 0.6, 2.0)
    if s.get("dock") is False:
        g.vis_end = dim + 0.24
    g.c(0.0, "whoosh", "章节过场")
    chk_fit(g, "title", s.get("title"), 936, 54, 34)
    g.tcheck("titleAt", s.get("titleAt"))
    if isnum(s.get("total")) and s["total"] > 8:
        g.hint("total 最多画 8 格")


# ======================================================================
# B 批次「数据类」（scenes_b.jsx）—— 改 JSX 默认值要同步改这里
# ======================================================================
IW, CARD_MAX = 828, 880 - 270 - 10


def use_b(g, s):  # useB：at 默认 0.15（panelIn:false 时 0），out 默认 dur-0.3；panelIn:false 底色已展开
    dur = num(s.get("dur"), g.dur)
    at = num(s.get("at"), 0 if s.get("panelIn") is False else 0.15)
    out = num(s.get("out"), dur - 0.3)
    g.vis_end = out + 0.24
    g.tcheck("at", s.get("at"))
    return dur, at, out


def b_open(g, s, at, kind="pop", why="卡片进场"):
    if s.get("panelIn") is not False:
        g.c(0.05, "whoosh", "底色展开")
    g.c(at, kind, why)


def head_h(g, s, title_max=52):  # scenes_b headH
    th = g.theme
    return (42 if s.get("kicker") else 0) + ((jround(fit_size(s["title"], tw7(th, IW), title_max, 30) * 1.3) + 4) if s.get("title") else 0)


def src_h(s):
    return 96 if s.get("source") else 44


def head_b(g, s, title_max=52):  # scenes_b Head：kicker 28→22，title 一行 52→30（超出省略号）；titleHl 在 titleHlAt（默认 1）
    chk_fit(g, "kicker", s.get("kicker"), IW, 28, 22, thr=22)
    chk_fit(g, "title", s.get("title"), tw7(g.theme, IW), title_max, 30)
    thl = s.get("titleHl")
    g.tcheck("titleHlAt", s.get("titleHlAt"))
    if thl:
        keys = [k for k in (thl if isinstance(thl, list) else [thl]) if has(s.get("title"), k)]
        if keys:
            g.c(num(s.get("titleHlAt"), 1), "swipe", "titleHlAt 标题荧光笔")
        else:
            g.w("titleHl「%s」不在 title 里，不会画荧光笔" % thl)


def card_h(g, h):
    if 270 + h > 930 - 16:
        g.w("卡片算下来高约 %dpx，底边到 y≈%d，超出上卡下人的底色（930），会压到人物。减条目或删说明" % (h, 270 + h))
    elif h > CARD_MAX + 10:
        g.hint("卡片算下来高约 %dpx，底边到 y≈%d，比规范区域 270–880 多 %dpx（还在底色内）" % (h, 270 + h, 270 + h - 880))


def sc_number(g, s):  # NumberScene：countAt 默认 at+0.5，计数 0.6 s；segAt[i] 默认 countAt+0.3+0.35i；chipAt 默认 countAt+0.9
    th = g.theme
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s)
    count_at = num(s.get("countAt"), at + 0.5)
    g.tcheck("countAt", s.get("countAt"))
    g.after("countAt", count_at, at, "卡片进场 at")
    if s.get("value") is None:
        g.w("number 要写 value")
    g.c(count_at + 0.6, "hit", "计数结束 countAt+0.6")
    dec = s.get("decimals") or 0
    final = fmt(s.get("value"), dec, s.get("sep"))
    labels = limit(g, s.get("labels"), 6, "labels") if isinstance(s.get("labels"), list) else []
    n = len(labels) or min(6, int(to_num(s.get("segs") or 0)))
    unit, pre = s.get("unit") or "", s.get("prefix") or ""
    unit_size = fit_size(unit, 240, 80, 40) if unit else 0
    chip_w = text_w(s["chip"], 44) + 44 * 1.2 + 28 if s.get("chip") else 0
    hh = head_h(g, s)
    bar_h = 24 + 18 + 12 + 38 if n > 0 else 0
    room = IW - (text_w(unit, unit_size) + 16 if unit else 0) - (text_w(pre, 72) + 8 if pre else 0) - chip_w
    by_w = room / max(1, num_w(final, 1, th))
    by_h = (CARD_MAX - 46 - hh - 10 - bar_h - src_h(s)) / (0.96 * th["numScale"])
    if by_w < 80:
        g.w("大数字「%s%s%s」加 chip 一行放不下（最小 80px 还超宽），缩短单位或去掉 chip" % (pre, final, unit))
    big = math.floor(clamp(min(by_w, by_h, 220), 80, 220))
    card_h(g, jround(46 + hh + 10 + big * th["numScale"] * 0.96 + bar_h + src_h(s)))
    seg_at = s.get("segAt") if isinstance(s.get("segAt"), list) else []
    for i in range(n):
        v = seg_at[i] if i < len(seg_at) else None
        g.tcheck("segAt[%d]" % (i + 1), v)
        g.c(num(v, count_at + 0.3 + 0.35 * i), "tick", "进度段 %d" % (i + 1))
    for l in labels:
        chk_fit(g, "labels", jstr(l), IW / n - 10, 26, 18, thr=18)
    g.tcheck("chipAt", s.get("chipAt"))


def sc_numcompare(g, s):  # NumCompare：aAt 默认 at+0.3，bAt 默认 aAt+1.0，各自 +0.1 起计数 0.6 s；delta.at 默认 bAt+0.9
    th = g.theme
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s)
    A = s.get("a") if isinstance(s.get("a"), dict) else {}
    B = s.get("b") if isinstance(s.get("b"), dict) else {}
    for k in ("aAt", "bAt", "deltaAt"):
        g.tcheck(k, s.get(k))
    a_at = num(s.get("aAt"), at + 0.3)
    b_at = num(s.get("bAt"), a_at + 1.0)
    g.c(a_at, "tick", "第一个数 aAt")
    g.c(b_at + 0.7, "hit", "第二个数计数结束 bAt+0.7")
    g.after("aAt", a_at, at, "卡片进场 at")
    g.after("bAt", b_at, a_at, "aAt", strict=True)
    d = s.get("delta")
    dobj = d if isinstance(d, dict) else None
    if dobj:
        g.tcheck("delta.at", dobj.get("at"))
    d_at = num(dobj.get("at") if dobj else None, num(s.get("deltaAt"), b_at + 0.9))
    if d:
        g.c(d_at, "swipe", "delta 荧光笔")
        g.after("delta.at", d_at, b_at, "bAt")
    col_w = (IW - 104) / 2
    fa, fb = fmt(A.get("value"), A.get("decimals") or 0, A.get("sep")), fmt(B.get("value"), B.get("decimals") or 0, B.get("sep"))

    def uw(x):
        return (text_w(x["unit"], 48) + 10 if x.get("unit") else 0) + (text_w(x["prefix"], 48) + 6 if x.get("prefix") else 0)
    raw = min((col_w - uw(A)) / max(1e-9, num_w(fa, 1, th)), (col_w - uw(B)) / max(1e-9, num_w(fb, 1, th)))
    if raw < 56:
        g.w("两个数（%s / %s）加单位放不下（最小 56px 还超宽），换更短的单位" % (fa, fb))
    for x, nm in ((A, "a.label"), (B, "b.label")):
        chk_fit(g, nm, x.get("label"), col_w - 40, 30, 20)
    if d:
        dt = ("%s%s%s%s" % (dobj.get("pre") or "", fmt(dobj.get("value"), dobj.get("decimals") or 0), dobj.get("unit") or "", dobj.get("post") or "")) if dobj else jstr(d)
        chk_fit(g, "delta", dt, IW, 44, 28)


def sc_percent(g, s):  # Percent：ringAt 默认 at+0.45，countDur 0.6；lineAt 默认 [at+0.3, ringAt+cd+0.3]；hlAt 默认 ringAt+cd+0.2
    th = g.theme
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s)
    ring_at = num(s.get("ringAt"), at + 0.45)
    cd = num(s.get("countDur"), 0.6)
    g.tcheck("ringAt", s.get("ringAt"))
    g.after("ringAt", ring_at, at, "卡片进场 at")
    g.c(ring_at + cd, "hit", "环走完 ringAt+countDur")
    v = to_num(s.get("value"))
    if v < 0 or v > 100:
        g.w("percent 的 value=%s 不在 0–100，会被截到范围内" % jstr(s.get("value")))
    lines = limit(g, s.get("lines"), 2, "lines")
    la = s.get("lineAt") if isinstance(s.get("lineAt"), list) else []
    l0_at = num(la[0] if len(la) > 0 else None, at + 0.3)
    for i, x in enumerate(la):
        g.tcheck("lineAt[%d]" % (i + 1), x)
    tw = IW - 300 - 50
    if lines:
        one = fit_size(lines[0], tw7(th, tw) * 0.97, 46, 20)
        if one < 36:
            raw = tw7(th, tw) * 2 * 0.88 / max(1, text_w(lines[0], 1))
            if raw < 30:
                g.w("lines[1]「%s」两行 30px 也放不下，会被截断" % lines[0])
    if len(lines) > 1:
        raw = tw * 3 * 0.88 / max(1, text_w(lines[1], 1))
        size = math.floor(clamp(raw, 24, 34))
        if raw < 24:
            g.w("lines[2]「%s」三行 24px 也放不下，会被截断" % lines[1])
        elif size < 28:
            g.w("lines[2]「%s」字号会压到 %dpx（<28），删几个字" % (lines[1], size))
    hl = s.get("hl")
    g.tcheck("hlAt", s.get("hlAt"))
    if hl:
        keys = [k for k in (hl if isinstance(hl, list) else [hl]) if lines and has(lines[0], k)]
        if keys:
            hl_at = num(s.get("hlAt"), ring_at + cd + 0.2)
            g.c(hl_at, "swipe", "hlAt 荧光笔")
            g.after("hlAt", hl_at, l0_at, "第一行出现 lineAt[0]")
        else:
            g.w("hl「%s」不在 lines 第一行里，不会画荧光笔（只认第一行）" % hl)


def sc_bars(g, s):  # Bars：barsAt 默认 at+0.6，gap 0.35，items[i].at 默认 barsAt+gap*i；行本身 at+0.2+0.12i 出现
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s)
    items = [it for it in limit(g, s.get("items"), 6, "items") if isinstance(it, dict)]
    n = max(1, len(items))
    bars_at = num(s.get("barsAt"), at + 0.6)
    gap = num(s.get("gap"), 0.35)
    g.tcheck("barsAt", s.get("barsAt"))
    ats = []
    for i, it in enumerate(items):
        g.tcheck("items[%d].at" % (i + 1), it.get("at"))
        ats.append(num(it.get("at"), bars_at + gap * i))
        g.c(ats[-1], "tick", "条 %d 长出" % (i + 1))
        g.after("items[%d] 长出" % (i + 1), ats[-1], at + 0.2 + 0.12 * i, "这一行出现（at+0.2+0.12i）", warn=False)
    g.tcheck("hotAt", s.get("hotAt"))
    hh = head_h(g, s)
    avail = CARD_MAX - 46 - hh - 22 - src_h(s)
    row_h = math.floor(clamp(avail / n, 62, 104))
    card_h(g, jround(46 + hh + 22 + row_h * n + src_h(s)))
    lab = min([36, math.floor(row_h * 0.42)] + [fit_size(it.get("label") or "", 250, 36, 20) for it in items])
    if lab < 28:
        g.w("条形图标签字号会压到 %dpx（<28）：条数多或标签长，减到 4–5 条或缩短标签" % lab)


def sc_timeline_h(g, s):  # Timeline（横排，原样）：firstAt 默认 at+0.5，gap 0.7，nodes[i].at 默认 firstAt+gap*i
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s)
    nodes = [nd for nd in limit(g, s.get("nodes"), 5, "nodes") if isinstance(nd, dict)]
    n = max(1, len(nodes))
    first = num(s.get("firstAt"), at + 0.5)
    gap = num(s.get("gap"), 0.7)
    g.tcheck("firstAt", s.get("firstAt"))
    ats = []
    for i, nd in enumerate(nodes):
        g.tcheck("nodes[%d].at" % (i + 1), nd.get("at"))
        ats.append(num(nd.get("at"), first + gap * i))
        g.c(ats[-1], "tick", "节点 %d" % (i + 1))
        g.after("nodes[%d].at" % (i + 1), ats[-1], at, "卡片进场 at")
    in_order(g, "nodes", ats)
    cell = IW / n
    lab = min([40] + [fit_size(nd.get("label") or "", cell - 14, 40, 20) for nd in nodes])
    if lab < 28:
        g.w("时间轴节点标签字号会压到 %dpx（<28），缩短标签或减少节点" % lab)
    subs = [nd.get("sub") for nd in nodes if nd.get("sub")]
    if subs:
        sub = min([28] + [fit_lines(x, cell - 18, 28, 19, 2) for x in subs])
        if sub < 26:
            g.w("时间轴说明字号会压到 %dpx（每格两行），缩短 sub" % sub)
    hh = head_h(g, s)
    lab_h = jround(lab * 1.5)
    box_h = lab_h + 34 + 40 + (jround(28 * 1.45 * 2) + 4 if subs else 0)
    card_h(g, jround(46 + hh + 40 + box_h + src_h(s)))


def sc_table_classic(g, s):  # Table（原样）：headAt 默认 at+0.25，rowGap 0.45，rowAt[i] 默认 headAt+0.4+rowGap*i；✓/✕ 在 rowAt+0.2
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s, 46)
    cols = limit(g, s.get("cols"), 4, "cols")
    C = max(2, len(cols))
    rows = [r if isinstance(r, list) else [] for r in limit(g, s.get("rows"), 5, "rows")]
    n = max(1, len(rows))
    head_at = num(s.get("headAt"), at + 0.25)
    gap = num(s.get("rowGap"), 0.45)
    ra = s.get("rowAt") if isinstance(s.get("rowAt"), list) else []
    g.tcheck("headAt", s.get("headAt"))
    row_at = []
    for i in range(len(rows)):
        v = ra[i] if i < len(ra) else None
        g.tcheck("rowAt[%d]" % (i + 1), v)
        row_at.append(num(v, head_at + 0.4 + gap * i))
        g.c(row_at[-1], "tick", "第 %d 行" % (i + 1))
        g.after("rowAt[%d]" % (i + 1), row_at[-1], at, "卡片进场 at")
    in_order(g, "rows", row_at)
    for k, f in enumerate(s.get("focus") or []):
        if not isinstance(f, dict):
            continue
        r = f.get("row")
        if not isinstance(r, int) or isinstance(r, bool) or r < 0 or r >= len(rows):
            g.w("focus[%d].row=%r 不是有效行号（从 0 数，共 %d 行）" % (k + 1, r, len(rows)))
            continue
        g.tcheck("focus[%d].at" % (k + 1), f.get("at"))
        g.after("focus[%d].at" % (k + 1), f.get("at"), row_at[r], "第 %d 行出现" % (r + 1))
    g.tcheck("focusOff", s.get("focusOff"))
    first_w = jround(IW * (0.3 if C == 4 else 0.34)) if C >= 3 else jround(IW * 0.42)
    ws = [first_w if j == 0 else (IW - first_w) / (C - 1) for j in range(len(cols))]
    hh = head_h(g, s, 46)
    avail = CARD_MAX - 46 - hh - 18 - 62 - src_h(s)
    row_h = math.floor(clamp(avail / n, 56, 96))
    card_h(g, jround(46 + hh + 18 + 62 + row_h * n + src_h(s)))
    mark = ("✓", "✕", "√", "×")
    body = [36, math.floor(row_h * 0.5)]
    worst = None
    for r in rows:
        for j, c in enumerate(r[:len(cols)]):
            if jstr(c) in mark:
                continue
            raw = raw_fit(jstr(c), ws[j] - 28)
            body.append(math.floor(clamp(raw, 20, 36)))
            if raw < 20:
                worst = jstr(c)
    bs = min(body)
    if worst:
        g.w("表格单元格「%s」最小 20px 还放不下，会被截掉" % worst)
    elif bs < 28:
        g.w("表格正文字号会压到 %dpx（<28）：列多/行多/格子字多，精简到 3 列或每格 ≤5 字" % bs)


# ---------- timeline / table 的「C 全屏版式、竖排、分页」（scenes_b.jsx 新版：有 tablePlan / tlAutoC 时启用） ----------
CW, CIW, C_TOP, C_MAX = 888, 792, 276, 1240 - 276


def pick_layout(s, auto_c):  # pickLayout：不写 layout = B（从不自动换版式）；"auto" 按规则
    la = jstr(s.get("layout") or "B").upper()
    return "C" if la == "C" or (la == "AUTO" and auto_c) else "B"


def stage_open(g, s, L, at):  # Stage：B 画 Panel；C 整屏底色 0–0.3 s 淡入（fillIn 默认跟 panelIn）
    g.layout = L
    if L == "C":
        fin = s.get("fillIn") if s.get("fillIn") is not None else s.get("panelIn")
        if fin is not False:
            g.c(0.0, "whoosh", "全屏底色铺开（C 版式）")
        g.c(at, "pop", "卡片进场")
    else:
        b_open(g, s, at)


def head_h2(g, s, title_max, w):
    return (42 if s.get("kicker") else 0) + ((jround(fit_size(s["title"], tw7(g.theme, w), title_max, 30) * 1.3) + 4) if s.get("title") else 0)


def head_max(s, title_max):
    return (42 if s.get("kicker") else 0) + ((jround(title_max * 1.3) + 4) if s.get("title") else 0)


def src_b2(s):
    return 84 if s.get("source") else 40


def tl_auto_c(s):  # tlAutoC：节点 ≥ 6，或任一 sub 字数 > (节点 ≥ 5 ? 14 : 30) → C
    ns = [x for x in (s.get("nodes") or []) if x]
    n = len(ns)
    return n >= 6 or any(len(jstr(nd.get("sub") if isinstance(nd, dict) else "") or "") > (14 if n >= 5 else 30) for nd in ns if isinstance(nd, dict))


def tl_dir(s, L):  # tlDir：C 一律竖排；B ≤4 节点且 label ≥30px、sub 两行 28px 放得下 → 横排
    if L == "C":
        return "v"
    if s.get("dir") in ("h", "v"):
        return s["dir"]
    nodes = [nd if isinstance(nd, dict) else {} for nd in (s.get("nodes") or [])[:5]]
    if len(nodes) > 4:
        return "v"
    cell = IW / max(1, len(nodes))
    ok = all(fit_size(nd.get("label") or "", cell - 14, 40, 20) >= 30 and (not nd.get("sub") or text_w(nd["sub"], 28) <= (cell - 18) * 2 * 0.88) for nd in nodes)
    return "h" if ok else "v"


def sc_timeline(g, s):
    if not PROFILE["tl_v2"]:
        return sc_timeline_h(g, s)
    L = pick_layout(s, tl_auto_c(s))
    if tl_dir(s, L) == "h":
        sc_timeline_h(g, s)
        g.layout = "B"
        return
    # TimelineV（竖排）：节点上限 B 6、C 8；时间默认同横排
    dur, at, out = use_b(g, s)
    stage_open(g, s, L, at)
    head_b(g, s)
    lim = 8 if L == "C" else 6
    nodes = [nd for nd in limit(g, [x for x in (s.get("nodes") or []) if x], lim, "nodes") if isinstance(nd, dict)]
    n = max(1, len(nodes))
    first = num(s.get("firstAt"), at + 0.5)
    gap = num(s.get("gap"), 0.7)
    g.tcheck("firstAt", s.get("firstAt"))
    ats = []
    for i, nd in enumerate(nodes):
        g.tcheck("nodes[%d].at" % (i + 1), nd.get("at"))
        ats.append(num(nd.get("at"), first + gap * i))
        g.c(ats[-1], "tick", "节点 %d" % (i + 1))
        g.after("nodes[%d].at" % (i + 1), ats[-1], at, "卡片进场 at")
    in_order(g, "nodes", ats)
    isc = L == "C"
    W = CIW if isc else IW
    hh = head_h2(g, s, 52, W)
    avail = (C_MAX if isc else CARD_MAX) - 46 - hh - 24 - src_b2(s)
    row_h = math.floor(min(150 if isc else 110, avail / n))
    lab_max = jround(W * 0.3)
    lab = None
    for z in range(40 if isc else 36, 27, -1):
        if z * 1.3 <= row_h - 8 and all(text_w(nd.get("label") or "", z) <= lab_max for nd in nodes):
            lab = z
            break
    if lab is None:
        lab = 28
        if row_h - 8 < 28 * 1.3:
            g.w("时间轴节点太多：每行只有 %dpx 高，28px 也排不下，减少节点或改 \"layout\":\"C\"" % row_h)
        long = [nd.get("label") for nd in nodes if text_w(nd.get("label") or "", 28) > lab_max]
        if long:
            g.w("时间轴标签太长会被截断：%s（每个 label 最宽 %dpx）" % (" / ".join(map(jstr, long)), lab_max))
    lab_w = min(lab_max, max(80, math.ceil(max([0] + [text_w(nd.get("label") or "", lab) for nd in nodes]))))
    sub_w = W - (62 + lab_w + 30)

    def lines_at(z):
        return 2 if row_h >= jround(2 * z * 1.3 + 8) else 1
    sub_ok = False
    for z in range(34 if isc else 32, 27, -1):
        ln = lines_at(z)
        if z * 1.3 <= row_h - 8 and all(not nd.get("sub") or text_w(nd["sub"], z) <= sub_w * ln * 0.92 for nd in nodes):
            sub_ok = True
            break
    if not sub_ok and any(nd.get("sub") for nd in nodes):
        bad = [nd["sub"] for nd in nodes if nd.get("sub") and text_w(nd["sub"], 28) > sub_w * lines_at(28) * 0.92]
        if bad:
            g.w("时间轴说明 28px %d 行放不下，会截断：%s" % (lines_at(28), " / ".join(bad)))
    if L == "B" and jstr(s.get("layout") or "B").upper() == "B" and tl_auto_c(s):
        g.hint("节点多/说明长：按规则适合 \"layout\":\"C\"（全屏讲解，人物缩进左下圆窗）；现在在 B 里竖排")


def table_plan(s, L):  # tablePlan：原样（classic）或密排 + 分页
    cols = (s.get("cols") or [])[:4]
    C = max(2, len(cols))
    rows = [r for r in (s.get("rows") or []) if isinstance(r, list)][:12]
    n = max(1, len(rows))
    W = CIW if L == "C" else IW
    ratio_w = jround(W * (0.3 if C == 4 else 0.34)) if C >= 3 else jround(W * 0.42)

    def ws_of(fw):
        return [fw if i == 0 else (W - fw) / (C - 1) for i in range(len(cols))]
    ws0 = ws_of(ratio_w)
    mk = ("✓", "✕", "√", "×")

    def fit1(c, j):
        return j >= len(ws0) or jstr(c) in mk or text_w(jstr(c), 28) <= ws0[j] - 28
    hdr_ok = all(text_w(jstr(c), 28) <= ws0[j] - 24 for j, c in enumerate(cols))
    pp = math.floor(num(s.get("perPage"), 0))
    plan = {"cols": cols, "C": C, "rows": rows, "n": n, "W": W}
    if L == "B" and pp <= 0 and len(rows) <= 4 and all(fit1(c, j) for r in rows for j, c in enumerate(r)) and hdr_ok:
        plan.update(classic=True, pages=[[0, len(rows)]])
        return plan
    zmax = 36 if L == "C" else 34
    first_w = jround(clamp(math.ceil(max([text_w(jstr(cols[0]) if cols else "", zmax)] + [text_w(jstr(r[0]) if r else "", zmax) for r in rows])) + 32, jround(W * 0.2), ratio_w))
    ws = ws_of(first_w)

    def cell_lines(c, j, z):
        return 1 if j >= len(ws) or jstr(c) in mk or not jstr(c) else math.ceil(text_w(jstr(c), z) / ((ws[j] - 28) * 0.95))

    def row_lines(r, z):
        return max([1] + [cell_lines(c, j, z) for j, c in enumerate(r)])
    ml = max([1] + [row_lines(r, 32 if L == "C" else 30) for r in rows])
    cap = clamp(pp, 1, 12) if pp > 0 else ((4 if ml >= 3 else 6 if ml == 2 else 8) if L == "C" else (2 if ml >= 3 else 3 if ml == 2 else 4))
    P = math.ceil(n / cap)
    pages, st = [], 0
    for p in range(P):
        k = n // P + (1 if p < n % P else 0)
        pages.append([st, st + k])
        st += k
    plan.update(classic=False, ws=ws, pages=pages, row_lines=row_lines)
    return plan


def table_times(s, plan, at, out):  # tableTimes
    pages = plan["pages"]
    P = len(pages)
    head_at = num(s.get("headAt"), at + 0.25)
    gap = num(s.get("rowGap"), 0.45)
    t0 = head_at + 0.4
    page_gap = num(s.get("pageGap"), max(1.6, (out - 1.0 - t0) / P))
    ra = s.get("rowAt") if isinstance(s.get("rowAt"), list) else []
    page_of = []
    for p, (a, b) in enumerate(pages):
        page_of += [p] * (b - a)
    row_at = [num(ra[i] if i < len(ra) else None, t0 + (page_gap * p if P > 1 else 0) + gap * (i - pages[p][0])) for i, p in enumerate(page_of)]
    flip = [None if p == 0 else row_at[a] - 0.3 for p, (a, b) in enumerate(pages)]
    return head_at, row_at, flip, page_of


def sc_table(g, s):
    if not PROFILE["tt_v2"]:
        return sc_table_classic(g, s)
    L = pick_layout(s, len(table_plan(s, "B")["pages"]) > 1)
    plan = table_plan(s, L)
    if plan["classic"]:
        sc_table_classic(g, s)
        g.layout = "B"
        return
    # TableDense：密排 + 分页（行数上限 12）
    dur, at, out = use_b(g, s)
    stage_open(g, s, L, at)
    isc = L == "C"
    title_max = 52 if isc else 46
    head_b(g, s, title_max)
    if isinstance(s.get("rows"), list) and len(s["rows"]) > 12:
        g.w("rows 有 %d 行，最多显示 12 行" % len(s["rows"]))
    rows, pages = plan["rows"], plan["pages"]
    P = len(pages)
    head_at, row_at, flip, page_of = table_times(s, plan, at, out)
    g.tcheck("headAt", s.get("headAt"))
    ra = s.get("rowAt") if isinstance(s.get("rowAt"), list) else []
    for i in range(len(rows)):
        g.tcheck("rowAt[%d]" % (i + 1), ra[i] if i < len(ra) else None)
        g.c(row_at[i], "tick", "第 %d 行" % (i + 1))
        g.after("rowAt[%d]" % (i + 1), row_at[i], at, "卡片进场 at")
    for p in range(1, P):
        g.c(flip[p], "swipe", "翻到第 %d 页" % (p + 1))
    in_order(g, "rows", row_at[:len(rows)])
    if P > 1:
        g.hint("表格分 %d 页：%s" % (P, "；".join("第 %d 页 %d–%d 行%s" % (p + 1, a + 1, b, "（%.2f s 翻页）" % flip[p] if flip[p] is not None else "") for p, (a, b) in enumerate(pages))))
    flip_t = [(-1e9 if p == 0 else f) for p, f in enumerate(flip)]
    for k, f in enumerate(s.get("focus") or []):
        if not isinstance(f, dict):
            continue
        r = f.get("row")
        if not isinstance(r, int) or isinstance(r, bool) or r < 0 or r >= len(rows):
            g.w("focus[%d].row=%r 不是有效行号（从 0 数，共 %d 行）" % (k + 1, r, len(rows)))
            continue
        g.tcheck("focus[%d].at" % (k + 1), f.get("at"))
        fa = num(f.get("at"), 99)
        g.after("focus[%d].at" % (k + 1), f.get("at"), row_at[r], "第 %d 行出现" % (r + 1))
        cur = max([p for p in range(P) if fa >= flip_t[p]] or [0])
        if page_of[r] != cur:
            g.w("focus[%d]：第 %d 行在第 %d 页，%.2f s 时显示的是第 %d 页，不会高亮" % (k + 1, r + 1, page_of[r] + 1, fa, cur + 1))
    # 字号：B 34 / C 36 往下找到 28；还放不下就减少每格行数（省略号）
    head_row = 62 if isc else 56
    avail = (C_MAX if isc else CARD_MAX) - 46 - head_max(s, title_max) - 14 - head_row - src_b2(s)
    rl = plan["row_lines"]

    def page_h(z, ml):
        return max([0] + [sum((jround(z * 1.3 + 24) if min(ml, rl(r, z)) <= 1 else jround(z * 1.3 * min(ml, rl(r, z)) + 20)) for r in rows[a:b]) for a, b in pages])
    ws = plan["ws"]

    def first_one(z):
        return all(text_w(jstr(r[0]) if r else "", z) <= ws[0] - 28 for r in rows)

    def no_cut(z):
        return all(rl(r, z) <= 3 for r in rows)
    bs, ml = 0, 3
    for ok in (lambda z: no_cut(z) and first_one(z), no_cut, lambda z: True):
        for z in range(36 if isc else 34, 27, -1):
            if page_h(z, 3) <= avail and ok(z):
                bs = z
                break
        if bs:
            break
    if not bs:
        bs = 28
        while ml > 1 and page_h(28, ml) > avail:
            ml -= 1
        g.w("表格内容太多：28px 下每格只能显示 %d 行，多出的字省略号。精简单元格或加 \"perPage\"" % ml)
    elif not no_cut(bs):
        g.w("有单元格超过 3 行，会截断加省略号：精简单元格文字")
    hs = min([32 if isc else 30] + [fit_size(jstr(c), ws[j] - 24, 32 if isc else 30, 24) for j, c in enumerate(plan["cols"])])
    if hs < 28:
        g.w("表头字号会压到 %dpx（<28），缩短列名" % hs)
    if L == "B" and jstr(s.get("layout") or "B").upper() == "B" and P > 1:
        g.hint("B 里要翻 %d 页：内容多可以改 \"layout\":\"C\"（全屏讲解）" % P)


def sc_compare(g, s):  # Compare：wrongAt 默认 at+0.2，strikeAt wrongAt+0.8，rightAt strikeAt+0.45，hlAt rightAt+0.4
    th = g.theme
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s)
    for k in ("wrongAt", "strikeAt", "rightAt", "hlAt"):
        g.tcheck(k, s.get(k))
    wrong_at = num(s.get("wrongAt"), at + 0.2)
    strike = num(s.get("strikeAt"), wrong_at + 0.8)
    right_at = num(s.get("rightAt"), strike + 0.45)
    hl_at = num(s.get("hlAt"), right_at + 0.4)
    g.c(strike, "swipe", "strikeAt 划掉")
    g.c(hl_at, "swipe", "hlAt 荧光笔")
    g.after("strikeAt 划掉", strike, wrong_at, "「以为」那句出现 wrongAt", strict=True)
    g.after("hlAt", hl_at, right_at, "「其实」那句出现 rightAt")
    wl, rl = s.get("wrongLabel") or "以为", s.get("rightLabel") or "其实"
    tw = IW - (max(text_w(wl, 30), text_w(rl, 30)) + 36) - 28
    chk_fit(g, "wrong", s.get("wrong"), tw - 12, 50, 28)
    right = jstr(s.get("right"))
    if right and fit_size(right, tw7(th, tw) * 0.97, 52, 24) < 40:
        raw = tw7(th, tw) * 2 * 0.88 / max(1, text_w(right, 1))
        if raw < 30:
            g.w("right「%s」两行 30px 也放不下，会被截断" % right)


def sc_formula(g, s):  # Formula：itemsAt 默认 at+0.4，gap 0.5，items[i].at 默认 itemsAt+gap*i；resultAt 默认最后一项+0.7；结果 resultAt+0.1 起计数 0.6 s
    th = g.theme
    dur, at, out = use_b(g, s)
    b_open(g, s, at)
    head_b(g, s)
    items = [it for it in limit(g, s.get("items"), 5, "items") if isinstance(it, dict)]
    n = max(1, len(items))
    R = s.get("result") if isinstance(s.get("result"), dict) else {}
    mode = s.get("mode") or ("row" if n <= 3 else "list")
    items_at = num(s.get("itemsAt"), at + 0.4)
    gap = num(s.get("gap"), 0.5)
    g.tcheck("itemsAt", s.get("itemsAt"))
    ats = []
    for i, it in enumerate(items):
        g.tcheck("items[%d].at" % (i + 1), it.get("at"))
        ats.append(num(it.get("at"), items_at + gap * i))
        g.c(ats[-1], "tick", "第 %d 项" % (i + 1))
        g.after("items[%d].at" % (i + 1), ats[-1], at, "卡片进场 at")
    in_order(g, "items", ats)
    g.tcheck("resultAt", s.get("resultAt"))
    if not items and not isnum(s.get("resultAt")):
        g.w("formula 没有 items，又没写 resultAt：结果时间算不出来（JSX 里会是 NaN，结果不显示）")
        result_at = None
    else:
        result_at = num(s.get("resultAt"), ats[-1] + 0.7 if ats else None)
    if isnum(result_at):
        g.c(result_at + 0.7, "hit", "结果计数结束 resultAt+0.7")
        if ats:
            g.after("resultAt", result_at, ats[-1], "最后一项出现")
    r_final = fmt(R.get("value"), R.get("decimals") or 0, R.get("sep"))
    hh = head_h(g, s)
    if mode == "row":
        box_w = (IW - 54 * (n - 1)) / n
        vs = []
        for it in items:
            st = fmt(it.get("value"), it.get("decimals") or 0, it.get("sep")) if it.get("value") is not None else jstr(it.get("text"))
            u = text_w(it["unit"], 30) + 6 if it.get("unit") else 0
            vs.append((box_w - 16 - u) / max(1e-9, num_w(st, 1, th)) if it.get("value") is not None else fit_size(st, box_w - 16, 60, 26) * 1.2)
        v_s = math.floor(min([78] + vs))
        if v_s < 34:
            g.w("横排公式每项数字会压到 %dpx，项多或数字长：改 \"mode\":\"list\"" % v_s)
        lab = min([28] + [fit_size(it.get("label") or "", box_w - 10, 28, 18) for it in items])
        if lab < 24:
            g.w("横排公式的 label 字号会压到 %dpx，缩短 label 或改 list" % lab)
        rls = fit_size(R.get("label") or "", 300, 40, 26)
        raw = (IW - 60 - 40 - text_w(R.get("label") or "", rls) - 30 - (text_w(R["unit"], 40) + 8 if R.get("unit") else 0)) / max(1e-9, num_w(r_final, 1, th))
        if raw < 60:
            g.w("结果「%s %s」一行放不下（最小 60px 还超宽）" % (R.get("label") or "", r_final))
        rs = math.floor(clamp(raw, 60, 120))
        box_h = jround(v_s * 1.1 + 10 + lab * 1.4)
        card_h(g, jround(46 + hh + 34 + box_h + 30 + jround(rs * th["numScale"] + 36) + src_h(s)))
    else:
        avail = CARD_MAX - 46 - hh - 20 - 22 - 108 - src_h(s)
        row_h = math.floor(clamp(avail / n, 54, 80))
        card_h(g, jround(46 + hh + 20 + row_h * n + 22 + 108 + src_h(s)))
        lab = min([36, math.floor(row_h * 0.55)] + [fit_size(it.get("label") or "", IW - 360, 36, 22) for it in items])
        if lab < 28:
            g.w("拆解单 label 字号会压到 %dpx（<28），缩短 label 或减少项数" % lab)
        rls = fit_size(R.get("label") or "", 360, 42, 26)
        raw = (IW - 80 - text_w(R.get("label") or "", rls) - 40 - (text_w(R["unit"], 36) + 8 if R.get("unit") else 0)) / max(1e-9, num_w(r_final, 1, th))
        if raw < 56:
            g.w("结果「%s %s」一行放不下（最小 56px 还超宽）" % (R.get("label") or "", r_final))


# ======================================================================
# C 批次（scenes_c.jsx）—— 改 JSX 默认值要同步改这里
# ======================================================================
def use_c(g, s):  # cardAtOf：at 默认 0.2，panelIn:false 时 0；outOf：dur-0.3
    dur = num(s.get("dur"), g.dur)
    at = num(s.get("at"), 0 if s.get("panelIn") is False else 0.2)
    out = num(s.get("out"), dur - 0.3)
    g.vis_end = out + 0.24
    g.tcheck("at", s.get("at"))
    return dur, at, out


def sc_doc(g, s):  # DocScene：marks[i].at 默认 at+1.0+0.8i；原文 44→30 号最多 6 行，放不下 30 号截断
    dur, at, out = use_c(g, s)
    b_open(g, s, at, "swipe", "文件滑入")
    marks = s.get("marks") if isinstance(s.get("marks"), list) else ([s["mark"]] if s.get("mark") else [])
    ms = []
    for i, m in enumerate(marks):
        if isinstance(m, str):
            ms.append({"text": m, "at": at + 1.0 + 0.8 * i, "i": i})
        elif isinstance(m, dict):
            g.tcheck("marks[%d].at" % (i + 1), m.get("at"))
            ms.append(dict(m, at=num(m.get("at"), at + 1.0 + 0.8 * i), i=i))
    has_src, has_art, has_note = bool(s.get("source")), bool(s.get("article")), bool(s.get("note"))
    art = fit_size(s["article"], 828 - (0 if has_src else 150), 58, 34) if has_art else 0
    if has_art:
        chk_fit(g, "article", s["article"], 828 - (0 if has_src else 150), 58, 34)
    head = (40 if has_src else 0) + (art * 1.3 + 6 if has_art else 0)
    body_max = 600 - 46 - 40 - head - 18 - (46 if has_note else 0)
    raw = jstr(s.get("text"))
    wrap_w = 828 * 0.96
    shown, found = raw, False
    for size in range(44, 29, -1):
        nl = count_lines(raw, size, wrap_w)
        if nl <= 6 and nl * size * 1.72 <= body_max:
            found = True
            break
    if not found:
        ml = max(1, min(6, math.floor(body_max / (30 * 1.72))))
        shown, _ = clip_to_lines(raw, 30, wrap_w, ml)
        g.w("原文太长：30 号 %d 行也放不下，会截断加省略号（只显示到「…%s」）" % (ml, shown[-12:]))
    drawn = {m["i"] for m in split_marks(shown, ms)}
    for m in ms:
        if m["i"] in drawn:
            g.c(m["at"], "swipe", "marks[%d] 荧光笔" % (m["i"] + 1))
            g.after("marks[%d].at" % (m["i"] + 1), m["at"], at, "卡片进场 at")
        elif m.get("text") and m["text"] in raw and m["text"] not in shown:
            g.w("marks[%d]「%s」在被截断的部分，画不出来" % (m["i"] + 1, m["text"]))
        else:
            g.w("marks[%d]「%s」在 text 里找不到（或和前一处重叠），不会画荧光笔。要逐字照抄原文" % (m["i"] + 1, m.get("text")))
    in_order(g, "marks", [m["at"] for m in ms])


def sc_shot(g, s):  # ShotScene：boxes[i].at 默认 at+1.0+gap*i（gap 旧版 0.6、新版 1.1，从 JSX 读）；note.at 默认 (对应框 at 或 at+1)+0.5；没有框时 note 不显示
    dur, at, out = use_c(g, s)
    b_open(g, s, at)
    boxes = [b for b in (s.get("boxes") or []) if isinstance(b, dict)]
    bats = []
    for i, b in enumerate(boxes):
        g.tcheck("boxes[%d].at" % (i + 1), b.get("at"))
        bats.append(num(b.get("at"), at + 1.0 + PROFILE["shot_gap"] * i))
        g.c(bats[-1], "tick", "框选 %d" % (i + 1))
        g.after("boxes[%d].at" % (i + 1), bats[-1], at, "卡片进场 at")
        x, y, w, h = (to_num(b.get(k, d)) for k, d in (("x", 0.1), ("y", 0.1), ("w", 0.3), ("h", 0.2)))
        if min(x, y, w, h) < 0 or x + w > 1.001 or y + h > 1.001:
            g.w("boxes[%d] 的 x/y/w/h 是 0–1 的比例，x+w、y+h 不能超过 1" % (i + 1))
    in_order(g, "boxes", bats)
    note = s.get("note")
    note = {"text": note} if isinstance(note, str) else note if isinstance(note, dict) else None
    if note:
        if not boxes:
            g.w("shot 的 note 要配一个框（boxes）才会显示")
        else:
            bi = int(clamp(to_num(note.get("box", 0)) if isnum(note.get("box")) else 0, 0, max(0, len(boxes) - 1)))
            g.tcheck("note.at", note.get("at"))
            n_at = num(note.get("at"), bats[bi] + 0.5)
            g.c(n_at, "pop", "标注气泡 note")
            g.after("note.at", n_at, bats[bi], "对应框选出现")
            ratio = num(s.get("ratio"), 16 / 10)
            if ratio >= 0.8:
                chk_fit(g, "note", note.get("text"), 936 - 96 - 40, 34, 24)
    side = num(s.get("ratio"), 16 / 10) < 0.8
    if s.get("title"):
        w = (936 - 96) - ((936 - 96) * 0.46 + 40 if side else 0)
        if PROFILE["shot_v2"]:  # shotHead：一行放不下先缩到 34，再不行 36 号折两行（超出截断）
            el = 1.07 if g.theme["elegant"] else 1
            if text_w(s["title"], fit_size(s["title"], tw7(g.theme, w), 40 if side else 44, 34)) * el > w:
                z = min((40 if side else 44) - 4, 36)
                if clip_to_lines(s["title"], z * el, w, 2)[1]:
                    g.w("title「%s」两行 %dpx 也放不下，会截断" % (s["title"], z))
                else:
                    g.hint("title 会折成两行 %dpx" % z)
        else:
            chk_fit(g, "title", s["title"], tw7(g.theme, w), 40 if side else 44, 30)


def sc_chat(g, s):  # ChatScene：msgs[i].at 默认 at+0.35+0.12i；markAt 默认 最后一条 at+0.6；38→26 号，放不下从最早的舍
    dur, at, out = use_c(g, s)
    b_open(g, s, at, "pop", "聊天卡进场")
    msgs = []
    for i, m in enumerate(s.get("msgs") or []):
        if not isinstance(m, dict):
            continue
        g.tcheck("msgs[%d].at" % (i + 1), m.get("at"))
        msgs.append(dict(m, at=num(m.get("at"), at + 0.35 + 0.12 * i), i=i))
    area_h = 610 - 36 - 84 - 14 - (54 if s.get("source") else 28)
    bub = 936 - 88 - (56 + 16) * 2 + 40

    def need(lst, fs):
        return sum(count_lines(m.get("text"), fs, bub - fs * 1.2) * fs * 1.42 + fs * 0.9 + 16 for m in lst) - 16
    fs = 26
    for size in range(38, 25, -1):
        if need(msgs, size) <= area_h:
            fs = size
            break
    kept = list(msgs)
    while len(kept) > 1 and need(kept, fs) > area_h:
        kept = kept[1:]
    if len(kept) < len(msgs):
        g.w("聊天记录放不下：26 号字也装不下，最早的 %d 条不会显示。删字或拆成两段" % (len(msgs) - len(kept)))
    elif fs < 28:
        g.w("聊天气泡字号会压到 %dpx（<28），删字或减少条数" % fs)
    last_at = kept[-1]["at"] if kept else at
    for m in kept:
        g.c(m["at"], "pop", "气泡 %d" % (m["i"] + 1))
        g.after("msgs[%d].at" % (m["i"] + 1), m["at"], at, "卡片进场 at")
        mk = m.get("mark")
        mtext = m.get("text") if mk is True else mk if isinstance(mk, str) else None
        g.tcheck("msgs[%d].markAt" % (m["i"] + 1), m.get("markAt"))
        if mtext:
            if has(jstr(m.get("text")), mtext):
                ma = num(m.get("markAt"), last_at + 0.6)
                g.c(ma, "swipe", "气泡 %d 荧光笔" % (m["i"] + 1))
                g.after("msgs[%d].markAt" % (m["i"] + 1), ma, m["at"], "这条气泡出现")
            else:
                g.w("msgs[%d].mark「%s」不在这条消息里，不会画荧光笔" % (m["i"] + 1, mtext))
    in_order(g, "msgs", [m["at"] for m in msgs])
    chk_fit(g, "who", s.get("who"), 848 - 200, 34, 24)


def sc_steps(g, s):  # StepsScene：items[i].at 默认 at+0.9+0.6i（可为负=已讲完）；下一项 at 时上一项打勾；endAt 给最后一项打勾
    th = g.theme
    dur, at, out = use_c(g, s)
    b_open(g, s, at)
    raw_items = limit(g, s.get("items"), 5, "items")
    items = []
    for i, it in enumerate(raw_items):
        it = {"t": it} if isinstance(it, str) else it if isinstance(it, dict) else {}
        g.tcheck("items[%d].at" % (i + 1), it.get("at"), allow_neg=True)
        items.append(dict(it, at=num(it.get("at"), at + 0.9 + 0.6 * i)))
    for i, it in enumerate(items):
        if it["at"] >= 0:
            g.c(it["at"], "tick", "第 %d 步点亮" % (i + 1) + ("（上一步打勾）" if i else ""))
    g.tcheck("endAt", s.get("endAt"))
    if isnum(s.get("endAt")) and items:
        g.c(s["endAt"], "tick", "最后一步打勾 endAt")
        g.after("endAt", s["endAt"], items[-1]["at"], "最后一步点亮", strict=True)
    in_order(g, "items", [it["at"] for it in items])
    inner = 828
    has_head = bool(s.get("kicker") or s.get("title"))
    head = (36 if s.get("kicker") else 0) + (65 if s.get("title") else 0) + (10 if has_head else 0)
    avail = 610 - 46 - 40 - head
    n = len(items)
    has_d = any(it.get("d") for it in items)

    def row(sc, d):
        return (42 * 1.3 + (26 * 1.5 if d else 0) + 24) * sc + 8
    d, sc = has_d, 1.0
    if n:
        sc = min(1, avail / (n * row(1, d)))
        if d and sc < 0.8:
            d = False
            sc = min(1, avail / (n * row(1, False)))
        sc = max(0.6, sc)
    if has_d and not d:
        g.hint("步骤多，说明行（d）会被省略")
    name_w = inner - 40 - 70 * sc - 22 - 46 - 22
    for i, it in enumerate(items):
        chk_fit(g, "第 %d 步" % (i + 1), jstr(it.get("t")), name_w, 42 * sc, 26)
    if s.get("title"):
        chk_fit(g, "title", s["title"], tw7(th, inner), 50, 32)


def sc_checklist(g, s):  # ChecklistScene：items[i].at 默认 at+0.9+0.6i；verdict.at 默认 最后一项+0.7；verdict.markAt 默认 verdict.at+0.25
    th = g.theme
    dur, at, out = use_c(g, s)
    b_open(g, s, at)
    items = []
    for i, it in enumerate(limit(g, s.get("items"), 6, "items")):
        it = {"t": it, "ok": True} if isinstance(it, str) else it if isinstance(it, dict) else {}
        g.tcheck("items[%d].at" % (i + 1), it.get("at"))
        d = {"ok": True}
        d.update(it)
        d["at"] = num(it.get("at"), at + 0.9 + 0.6 * i)
        items.append(d)
    for i, it in enumerate(items):
        ok = it.get("ok") is not False
        g.c(it["at"], "tick" if ok else "no", "第 %d 条 %s" % (i + 1, "✓" if ok else "✕"))
        g.after("items[%d].at" % (i + 1), it["at"], at, "卡片进场 at")
    in_order(g, "items", [it["at"] for it in items])
    v = s.get("verdict")
    v = {"text": v} if isinstance(v, str) else v if isinstance(v, dict) else None
    if v:
        g.tcheck("verdict.at", v.get("at"))
        g.tcheck("verdict.markAt", v.get("markAt"))
        v_at = num(v.get("at"), (items[-1]["at"] if items else at) + 0.7)
        g.c(v_at, "ok", "结论 verdict")
        g.c(num(v.get("markAt"), v_at + 0.25), "swipe", "结论荧光笔")
        if items:
            g.after("verdict.at", v_at, items[-1]["at"], "最后一条打勾")
        g.after("verdict.markAt", v.get("markAt"), v_at, "结论出现")
        chk_fit(g, "verdict", v.get("text"), 828 - 140, 38, 24)
    head = (36 if s.get("kicker") else 0) + (65 if s.get("title") else 0) + (14 if (s.get("kicker") or s.get("title")) else 0)
    avail = 610 - 46 - 40 - head - (76 if v else 0) - (40 if s.get("source") else 0)
    row_h = min(84, avail / max(1, len(items)))
    fs = clamp(jround(row_h * 0.56), 28, 42)
    for i, it in enumerate(items):
        chk_fit(g, "第 %d 条" % (i + 1), jstr(it.get("t")), 828 - 80, fs, 24)
    if s.get("title"):
        chk_fit(g, "title", s["title"], tw7(th, 828), 50, 32)


def sc_flow(g, s):  # FlowScene：at 默认 0.2；nodes[i].at 默认 at+0.7+0.6i；branch.at 默认 nodes[from].at+0.8（from 默认 1）
    th = g.theme
    dur = num(s.get("dur"), g.dur)
    out = num(s.get("out"), dur - 0.3)
    g.vis_end = out + 0.24
    at = num(s.get("at"), 0.2)
    g.tcheck("at", s.get("at"))
    if s.get("fillIn") is False:
        g.c(at, "pop", "标题进场（底色沿用上一段）")
    else:
        g.c(0.0, "whoosh", "全屏讲解进场")
    nodes = []
    for i, nd in enumerate(limit(g, s.get("nodes"), 5, "nodes")):
        nd = {"t": nd} if isinstance(nd, str) else nd if isinstance(nd, dict) else {}
        g.tcheck("nodes[%d].at" % (i + 1), nd.get("at"))
        nodes.append(dict(nd, at=num(nd.get("at"), at + 0.7 + 0.6 * i)))
        g.c(nodes[-1]["at"], "tick", "节点 %d 点亮" % (i + 1))
    in_order(g, "nodes", [nd["at"] for nd in nodes])
    N = len(nodes) or 1
    br = s.get("branch") if isinstance(s.get("branch"), dict) else None
    if br:
        # JSX: { from: clamp(num(branch.from,1),0,N-1), ...spec.branch } —— 写了 from 就用原值（越界不会被 clamp）
        frm = br["from"] if "from" in br else clamp(1, 0, N - 1)
        ok_from = isinstance(frm, int) and not isinstance(frm, bool) and 0 <= frm < len(nodes)
        if not ok_from:
            g.w("branch.from=%r 不是有效节点序号（从 0 数，共 %d 个），分支会画错位置" % (frm, len(nodes)))
        g.tcheck("branch.at", br.get("at"))
        b_at = num(br.get("at"), nodes[frm]["at"] + 0.8 if ok_from else at + 1)
        g.c(b_at, "tick", "分支点亮")
        if ok_from:
            g.after("branch.at", b_at, nodes[frm]["at"], "分出来的那个节点点亮")
    title_size = fit_size(s.get("title") or "", tw7(th, 888), 64, 40) if s.get("title") else 0
    if s.get("title"):
        chk_fit(g, "title", s["title"], tw7(th, 888), 64, 40)
    top = 276 + (44 if s.get("kicker") else 0) + (title_size * 1.3 if s.get("title") else 0) + 44
    node_h = clamp((1226 - top) / (N * 1.55), 96, 150)
    main_w = 460 if br else 760
    for i, nd in enumerate(nodes):
        chk_fit(g, "节点 %d" % (i + 1), jstr(nd.get("t")), tw7(th, main_w - 110 - 16), min(44, node_h * 0.36), 24)
    if br:
        chk_fit(g, "分支", jstr(br.get("t")), tw7(th, (960 - 680) - 56 - 16), min(44, node_h * 0.36), 24)


def sc_qa(g, s):  # QAScene：points[i].at 默认 at+1.0+0.7i；mark 的 markAt 默认 point.at+0.4；提问气泡 at+0.25（不单独配音）
    dur, at, out = use_c(g, s)
    b_open(g, s, at)
    pts = []
    for i, p in enumerate(limit(g, s.get("points"), 3, "points")):
        p = {"t": p} if isinstance(p, str) else p if isinstance(p, dict) else {}
        g.tcheck("points[%d].at" % (i + 1), p.get("at"))
        pts.append(dict(p, at=num(p.get("at"), at + 1.0 + 0.7 * i)))
    for i, p in enumerate(pts):
        g.c(p["at"], "tick", "要点 %d" % (i + 1))
        g.after("points[%d].at" % (i + 1), p["at"], at + 0.25, "提问气泡出现（at+0.25）")
        mk = p.get("mark")
        g.tcheck("points[%d].markAt" % (i + 1), p.get("markAt"))
        if mk:
            mt = p.get("t") if mk is True else mk
            if has(jstr(p.get("t")), mt):
                ma = num(p.get("markAt"), p["at"] + 0.4)
                g.c(ma, "swipe", "要点 %d 荧光笔" % (i + 1))
                g.after("points[%d].markAt" % (i + 1), ma, p["at"], "这条要点出现")
            else:
                g.w("points[%d].mark「%s」不在这条要点里，不会画荧光笔" % (i + 1, mt))
    in_order(g, "points", [p["at"] for p in pts])
    g.tcheck("answerAt", s.get("answerAt"))
    # 联合缩放（同 JSX）：提问 38、要点 40 起按 0.02 缩到 0.7
    inner, avail, ask = 936 - 96, 610 - 40 - 36, jstr(s.get("ask"))

    def ask_w(q):
        return (inner - 72 - jround(q * 0.6) * 2) * 0.97
    sc, fit_ok, q, pp, ql = 1.0, False, 28, 30, 3
    while sc >= 0.7:
        q, pp = jround(38 * sc), jround(40 * sc)
        ql = count_lines(ask, q, ask_w(q))
        ph = sum(count_lines(x.get("t"), pp, inner - 70) * pp * 1.4 + 12 for x in pts)
        need = 56 + 14 + ql * q * 1.45 + q * 0.9 + 36 + 26 + 36 + 10 + ph
        if need <= avail and ql <= 3:
            fit_ok = True
            break
        sc -= 0.02
    if ql > 3:
        g.w("提问太长，超过 3 行会截断加省略号：「%s」" % (ask if len(ask) <= 30 else ask[:30] + "…"))
    elif not fit_ok:
        g.w("提问 + 回答太长：缩到 %d/%dpx 还放不下，会超出卡片。删字或减少要点" % (q, pp))
    elif pp < 28:
        g.w("回答要点字号会压到 %dpx（<28），删字" % pp)


def sc_end(g, s):  # EndScene：at 默认 0；items[i].at 默认 at+0.35+0.12i；saveAt 默认 最后一条+0.45；noticeAt 默认 saveAt+0.2；out 默认不出场
    th = g.theme
    dur = num(s.get("dur"), g.dur)
    at = num(s.get("at"), 0)
    g.tcheck("at", s.get("at"))
    out = s.get("out") if isnum(s.get("out")) else None
    g.vis_end = out + 0.24 if out is not None else dur
    if s.get("fillIn") is False:
        g.c(at + 0.15, "pop", "标题进场（底色沿用上一段）")
    else:
        g.c(at, "whoosh", "片尾进场")
    items = []
    for i, it in enumerate(limit(g, s.get("items"), 4, "items")):
        it = {"t": it} if isinstance(it, str) else it if isinstance(it, dict) else {}
        g.tcheck("items[%d].at" % (i + 1), it.get("at"))
        items.append(dict(it, at=num(it.get("at"), at + 0.35 + 0.12 * i)))
        g.c(items[-1]["at"], "tick", "要点 %d" % (i + 1))
    in_order(g, "items", [it["at"] for it in items])
    g.tcheck("saveAt", s.get("saveAt"))
    save_at = num(s.get("saveAt"), (items[-1]["at"] if items else at) + 0.45)
    g.c(save_at, "ok", "收藏句 saveAt")
    if items:
        g.after("saveAt", save_at, items[-1]["at"], "最后一条要点出现")
    if s.get("notice"):
        g.tcheck("noticeAt", s.get("noticeAt"))
        g.c(num(s.get("noticeAt"), save_at + 0.2), "pop", "提示条 notice")
    w0 = 888
    title_size = fit_size(s.get("title") or "", tw7(th, w0), 68, 40)
    chk_fit(g, "title", s.get("title"), tw7(th, w0), 68, 40)
    list_top = 270 + 40 + 10 + title_size * 1.3 + 30
    list_h = 1200 - list_top
    fs, pad = 46, 30

    def est(f, pd):
        return sum(pd * 2 + 1.5 + (38 if it.get("k") else 0) + count_lines(it.get("t"), f, (w0 - 100) * 0.96) * f * 1.35 for it in items)
    while est(fs, pad) > list_h and (fs > 30 or pad > 14):
        if fs > 30:
            fs -= 2
        pad = max(14, pad - 2)
    if est(fs, pad) > list_h:
        g.w("片尾要点太长：30 号字也装不下，会压到收藏句。删字或减到 3 条")
    chk_fit(g, "save", s.get("save") or "收藏这条，用的时候找得到", w0 - 110, 42, 28)


def fixed_fit(g, label, text, max_w, size, ls=0.0):
    """固定字号、不换行的文字（trio/savescore/line 的标题等）：超宽会出框 → ⚠。ls = letterSpacing（em）"""
    if not text:
        return
    w = text_w(text, size) + len(jstr(text)) * ls * size
    if w > max_w + 1:
        g.w("%s「%s」%dpx 一行放不下（超宽约 %d%%），会出框。删几个字" % (label, text, size, round((w / max_w - 1) * 100)))


def head_fixed(g, s, title_size, w=828):  # scenes_c 新卡的 Kicker（28px，字距 0.14em）+ 固定字号 Title，都不换行
    fixed_fit(g, "kicker", s.get("kicker"), w, 28, 0.14)
    fixed_fit(g, "title", s.get("title"), tw7(g.theme, w), title_size)


def sc_trio(g, s):  # TrioScene：最多 3 格（清单/对比表/聊天记录，顺序固定）；items[i].at 默认 at+0.5+0.8i 点亮，格内小动画约 1 s 放完
    dur, at, out = use_c(g, s)
    b_open(g, s, at)
    head_fixed(g, s, 48)
    items = [it if isinstance(it, dict) else {"label": it} for it in limit(g, s.get("items"), 3, "items")]
    if 0 < len(items) < 3:
        g.hint("trio 按三格排（清单、对比表、聊天记录），现在只有 %d 格，右边会空着" % len(items))
    elif not items:
        g.w("trio 要写 items（3 格：清单、对比表、聊天记录）")
    ats = []
    for i, it in enumerate(items):
        g.tcheck("items[%d].at" % (i + 1), it.get("at"))
        a = num(it.get("at"), at + 0.5 + 0.8 * i)
        ats.append(a)
        g.c(a, "pop", "第 %d 格点亮" % (i + 1))
        g.after("items[%d].at" % (i + 1), a, at, "卡片进场 at")
        # 格宽 254、左右内边距 18；序号 01 约 40px + 间距 10
        fixed_fit(g, "items[%d].label" % (i + 1), jstr(it.get("label")), 254 - 36 - 50, 30)
    in_order(g, "items", ats)
    if ats and ats[-1] + 1.0 > out + 1e-6:
        g.hint("最后一格 at=%.2f，格内小动画约 1 s，卡片 %.2f s 出场前放不完" % (ats[-1], out))


def sc_savescore(g, s):  # SaveScoreScene：rows[i].at 默认 at+0.6+0.5i（条 0.9 s 缩短，at+0.75 出 ✓省下）；scoreAt 默认 dur-1.8，前 0.35 s 切幕，1.0 s 滚到 to
    th = g.theme
    dur, at, out = use_c(g, s)
    b_open(g, s, at)
    head_fixed(g, s, 52)
    rows = [r if isinstance(r, dict) else {"label": r} for r in limit(g, s.get("rows"), 2, "rows")]
    done = []
    for i, r in enumerate(rows):
        g.tcheck("rows[%d].at" % (i + 1), r.get("at"))
        a0 = num(r.get("at"), at + 0.6 + 0.5 * i)
        g.c(a0 + 0.75, "tick", "第 %d 行省下 ✓" % (i + 1))
        g.after("rows[%d].at" % (i + 1), a0, at, "卡片进场 at")
        done.append(a0)
        fixed_fit(g, "rows[%d].label" % (i + 1), jstr(r.get("label")), 120, 36)
    in_order(g, "rows", done)
    g.tcheck("scoreAt", s.get("scoreAt"))
    score_at = num(s.get("scoreAt"), dur - 1.8)
    g.c(score_at - 0.35, "swipe", "翻到质量分（scoreAt 前 0.35 s 切幕）")
    g.c(score_at + 1.0, "hit", "质量分数字落定 scoreAt+1.0")
    if done:
        g.after("scoreAt−0.35（开始切幕）", score_at - 0.35, done[-1] + 0.9, "最后一行省下动画结束（rows.at+0.9）", warn=False)
    g.after("scoreAt", score_at, at, "卡片进场 at")
    for k, d in (("from", 80), ("to", 99)):
        v = s.get(k)
        if v is not None and (not isnum(v) or v < 0 or v >= 100):
            g.w("%s=%r：分数只有两位滚动数字，要写 0–99 的数" % (k, v))
    if num(s.get("to"), 99) < num(s.get("from"), 80):
        g.hint("to 比 from 小，分数会往下滚")
    fixed_fit(g, "scoreKicker", s.get("scoreKicker") or "视频质量", 360, 28, 0.14)
    fixed_fit(g, "scoreLabel", s.get("scoreLabel") or "提升几个档次", tw7(th, 360), 54)


def sc_line(g, s):  # LineScene：最多 8 个点；lineAt 默认 at+0.5，lineDur 1.2 画完；hot 默认最后一个点，hotAt 默认 lineAt+lineDur
    dur, at, out = use_c(g, s)
    b_open(g, s, at)
    head_fixed(g, s, 48)
    pts = [p for p in limit(g, s.get("points"), 8, "points") if isinstance(p, dict)]
    if len(pts) < 2:
        g.w("折线图至少要 2 个点（points[{label,value}]）")
    for i, p in enumerate(pts):
        v = p.get("value")
        if not isnum(v):
            g.w("points[%d].value 要写数字，现在是 %r（会按 0 画）" % (i + 1, v))
        elif v < 0:
            g.w("points[%d].value=%s 是负数：纵轴从 0 起，会画到坐标轴下面" % (i + 1, jstr(v)))
    for k in ("lineAt", "lineDur", "hotAt"):
        g.tcheck(k, s.get(k))
    line_at = num(s.get("lineAt"), at + 0.5)
    line_dur = num(s.get("lineDur"), 1.2)
    g.after("lineAt", line_at, at, "卡片进场 at")
    g.c(line_at, "swipe", "折线画出 lineAt")
    hot = s.get("hot")
    if hot is not None and not (isnum(hot) and float(hot).is_integer() and 0 <= hot < len(pts)):
        g.w("hot=%r 要写点的下标（0 起，0–%d），现在不会有重点值" % (hot, len(pts) - 1))
    hot_at = num(s.get("hotAt"), line_at + line_dur)
    g.c(hot_at, "hit", "hotAt 重点值落定")
    g.after("hotAt", hot_at, line_at, "lineAt")
    if line_at + line_dur > out + 1e-6:
        g.w("折线 lineAt+lineDur=%.2f 晚于卡片出场 out=%.2f，画不完" % (line_at + line_dur, out))
    if len(pts) >= 2:
        step = (828 - 60 - 20) / (len(pts) - 1)
        for i, p in enumerate(pts):
            fixed_fit(g, "points[%d].label" % (i + 1), jstr(p.get("label")), step - 8, 26)


SCENES = {"hook": sc_hook, "hookQ": sc_hookq, "hookNum": sc_hooknum, "hookFlip": sc_hookflip, "term": sc_term, "nameplate": sc_nameplate,
          "quote": sc_quote, "warn": sc_warn, "chapter": sc_chapter,
          "number": sc_number, "numCompare": sc_numcompare, "percent": sc_percent, "bars": sc_bars, "timeline": sc_timeline,
          "table": sc_table, "compare": sc_compare, "formula": sc_formula,
          "doc": sc_doc, "shot": sc_shot, "chat": sc_chat, "steps": sc_steps, "checklist": sc_checklist, "flow": sc_flow, "qa": sc_qa, "end": sc_end,
          "trio": sc_trio, "savescore": sc_savescore, "line": sc_line}


# ======================================================================
# 字段检查
# ======================================================================
def lint_spec(g, spec):
    sc = spec.get("scene")
    if sc not in SCHEMA:
        near = difflib.get_close_matches(str(sc), SCHEMA.keys(), 1, 0.5)
        g.w("scene「%s」不认识%s" % (sc, "，是不是「%s」" % near[0] if near else "；可用：" + " ".join(SCHEMA)))
        return False
    sch = SCHEMA[sc]
    if not isnum(spec.get("dur")):
        g.w("SPEC 要写 dur（段长秒数）：场景在 Sequence 里拿不到自己的段长，out 会按整条合成算")
    elif abs(spec["dur"] - g.dur) > 1.5 / g.fps:
        g.w("SPEC 的 dur=%.2f 和时间线上段长 %.2f s（%d 帧）不一致：场景按 dur 算出场时间，改成 %.2f" % (spec["dur"], g.dur, g.dur_f, round(g.dur, 2)))

    def check(obj, allowed, where):
        if not isinstance(obj, dict):
            return
        names = allowed | {k[:-2] + "Say" for k in allowed if k.endswith("At")} | ({"say"} if "at" in allowed else set()) | ({"outSay"} if "out" in allowed else set())
        for k, v in obj.items():
            if k.startswith("_"):
                continue
            if is_say(k):
                tgt = say_target(k)
                if tgt not in allowed:
                    near = difflib.get_close_matches(k, sorted(names), 1, 0.6)
                    g.w("%s「%s」会写到 %s，但这里不读 %s%s" % (where, k, tgt, tgt, "，是不是「%s」" % near[0] if near else ""))
                continue
            if k not in allowed:
                near = difflib.get_close_matches(k, sorted(allowed), 1, 0.6)
                g.w("%s字段「%s」不认识，会被忽略%s" % (where, k, "，是不是「%s」" % near[0] if near else "（可用：%s）" % " ".join(sorted(allowed))))
                continue
            en = ENUMS.get((sc, k))
            if k == "layout" and sc in ("timeline", "table") and jstr(v).upper() not in ("B", "C", "AUTO"):
                g.w("%slayout「%s」只能是 B / C / auto" % (where, v))
            if en and isinstance(v, str) and v not in en:
                g.w("%s%s「%s」不在可选范围（%s）" % (where, k, v, " / ".join(sorted(en))))
            sub = sch.get(k)
            if sub and isinstance(v, dict):
                check(v, sub, "%s.%s " % (where.strip(), k))
            elif sub and isinstance(v, list):
                for i, it in enumerate(v):
                    if isinstance(it, dict):
                        check(it, sub, "%s.%s[%d] " % (where.strip(), k, i + 1))
    check(spec, COMMON | sch["_"], "SPEC ")
    if spec.get("out") is not None:
        g.tcheck("out", spec.get("out"))
    return True


# ======================================================================
# say：按口播里说到的字自动定时
# ======================================================================
def _norm(s):
    return re.sub(r"[\W_]+", "", s).lower()


class Words:
    def __init__(self, path):
        W = json.load(open(path, encoding="utf-8"))
        self.chars, self.idx, self.W = [], [], W
        for i, w in enumerate(W):
            for ch in _norm(w["text"]):
                self.chars.append(ch)
                self.idx.append(i)
        self.s = "".join(self.chars)

    def find(self, phrase, t0, t1):
        """在时间窗 [t0,t1] 里找 phrase，返回 (起秒, 止秒, 实际文字, 是否近似, 出现次数)。"""
        m = re.match(r"^(.*?)(?:#(\d+))?$", phrase.strip())
        p, nth = _norm(m.group(1)), int(m.group(2) or 1)
        if not p:
            return None
        lo = next((k for k, i in enumerate(self.idx) if self.W[i]["t"] >= t0), len(self.s))
        hi = next((k for k, i in enumerate(self.idx) if self.W[i]["t"] > t1), len(self.s))
        # 只要开头那个字在窗口里就算（一句话说到一半跨过段尾也能找到）
        win = self.s[lo:min(len(self.s), hi + len(p) + 1)]
        hits = [h.start() for h in re.finditer("(?=%s)" % re.escape(p), win) if lo + h.start() < hi]
        if len(hits) >= nth:
            k = lo + hits[nth - 1]
            return self.W[self.idx[k]]["t"], self.W[self.idx[k + len(p) - 1]]["end"], p, False, len(hits)
        if hits:  # 有这几个字，但没有第 nth 次
            return ("nth", len(hits))
        best, bk, bl = 0, None, len(p)
        for L in (len(p) - 1, len(p), len(p) + 1):
            if L <= 0:
                continue
            for k in range(0, max(0, min(len(win) - L + 1, hi - lo))):
                r = difflib.SequenceMatcher(None, p, win[k:k + L]).ratio()
                if r > best:
                    best, bk, bl = r, k, L
        if bk is not None and best >= 0.6:
            k = lo + bk
            return self.W[self.idx[k]]["t"], self.W[self.idx[k + bl - 1]]["end"], win[bk:bk + bl], True, 0
        return None


LEAD = 0.1  # 元素比说到那个字略早一点出现


def resolve_say(g, words):
    """把 SPEC 里的 say / xxxSay 换算成段内秒数，写回 g.spec；返回改了几处。"""
    t0, t1 = g.start / g.fps - 0.6, (g.start + g.dur_f) / g.fps + 0.3
    base = g.start / g.fps
    n = 0

    def one(phrase, key, where):
        r = words.find(phrase, t0, t1)
        if isinstance(r, tuple) and r and r[0] == "nth":
            g.w("%s%s「%s」：这段里只说了 %d 次，没有第 %s 次" % (where, key, phrase, r[1], phrase.rsplit("#", 1)[-1]))
            return None
        if not r:
            g.w("%s%s「%s」在这段的时间范围里找不到（%.1f–%.1f s）。照口播原话抄几个字，或检查段落位置" % (where, key, phrase, t0 + 0.6, t1 - 0.3))
            return None
        st, en, got, approx, cnt = r
        val = round(max(0.0, st - base - LEAD), 2)
        note = ""
        if approx:
            note = "  ⚠ 近似匹配：口播里是「%s」" % got
            g.w("%s%s「%s」只找到相近的「%s」，确认是不是这一句（不是就照口播原话改）" % (where, key, phrase, got))
        elif cnt > 1 and "#" not in phrase:
            note = "  · 这段里说了 %d 次，用的第 1 次（要别的写 #2）" % cnt
        return val, note

    def walk(obj, where):
        nonlocal n
        if isinstance(obj, list):
            for i, it in enumerate(obj):
                walk(it, "%s[%d]" % (where, i + 1))
            return
        if not isinstance(obj, dict):
            return
        for k in list(obj.keys()):
            if not is_say(k):
                continue
            tgt, v = say_target(k), obj[k]
            pre = (where + ".") if where else ""
            if isinstance(v, str):
                r = one(v, k, pre)
                if r:
                    obj[tgt] = r[0]
                    n += 1
                    g.say_log.append("    %-22s「%s」→ %s %.2f%s" % (pre + k, v, tgt, r[0], r[1]))
            elif isinstance(v, list):
                old = obj.get(tgt) if isinstance(obj.get(tgt), list) else []
                vals = []
                for i, ph in enumerate(v):
                    r = one(ph, "%s[%d]" % (k, i + 1), pre) if isinstance(ph, str) and ph else None
                    vals.append(r[0] if r else (old[i] if i < len(old) else None))
                    if r:
                        n += 1
                        g.say_log.append("    %-22s「%s」→ %s[%d] %.2f%s" % ("%s%s[%d]" % (pre, k, i + 1), ph, tgt, i + 1, r[0], r[1]))
                obj[tgt] = vals
        for k, v in obj.items():
            if isinstance(v, (dict, list)) and not is_say(k):
                walk(v, ((where + ".") if where else "") + k)
    walk(g.spec, "")
    return n


def has_say(o):
    if isinstance(o, dict):
        return any(is_say(k) for k in o) or any(has_say(v) for v in o.values())
    if isinstance(o, list):
        return any(has_say(v) for v in o)
    return False


def write_spec(g):
    src = open(g.path, encoding="utf-8").read()
    new = re.sub(r"/\*SPEC\*/.*?/\*END\*/", lambda m: "/*SPEC*/ " + json.dumps(g.spec, ensure_ascii=False) + " /*END*/", src, count=1, flags=re.S)
    open(g.path, "w", encoding="utf-8").write(new)


# ======================================================================
# 合并 / 去重
# ======================================================================
def finalize(g):
    cues = sorted(g.raw, key=lambda c: (c[0], -PRIO.get(c[1], 0)))
    keep = []
    for c in cues:
        if c[0] < -1e-6:
            continue  # 负数时间（steps 已讲完的项）：不配音
        if c[0] > g.vis_end + 1e-6 or c[0] > g.dur + 1e-6:
            g.dropped.append((c, "段外"))
            if any(("=%.2f 不在这段动效内" % c[0]) in m for _, m in g.warn):
                continue
            g.w("%s 在 %.2f s，这时卡片已出场/段已结束（可见到 %.2f s），听得到看不到：提前这个时间或加长段落" % (c[2], c[0], min(g.vis_end, g.dur)))
            continue
        keep.append(c)
    whooshes = [c[0] for c in keep if c[1] == "whoosh"]
    cues, keep = keep, []
    for c in cues:
        if c[1] == "pop" and any(abs(c[0] - w) < 0.25 - 1e-9 for w in whooshes):
            g.dropped.append((c, "离 whoosh <0.25s"))
        else:
            keep.append(c)
    cues, keep, prev = keep, [], None
    for c in cues:
        if c[1] == "tick":
            if prev is not None and round(c[0] - prev, 4) < 0.2:
                g.dropped.append((c, "tick 串"))
                prev = c[0]
                continue
            prev = c[0]
        keep.append(c)
    cues, keep, last = keep, [], {}
    for c in cues:
        if c[1] in last and round(c[0] - last[c[1]], 4) < 0.12:
            g.dropped.append((c, "同类同时"))
            continue
        last[c[1]] = c[0]
        keep.append(c)
    acc = []
    for c in sorted(keep, key=lambda c: (-PRIO.get(c[1], 0), c[0])):
        if any(round(abs(c[0] - a[0]), 4) < 0.1 for a in acc):
            g.dropped.append((c, "离更重要的 cue <0.1s"))
            continue
        acc.append(c)
    g.cues = sorted(acc, key=lambda c: c[0])


def extra_sfx(g, s):
    x = s.get("sfx")
    if x is False:
        g.no_sfx = True
        return
    if x is None:
        return
    if not isinstance(x, list):
        g.w("sfx 要写成 [[秒,\"kind\"],[秒,\"type\",时长]]，或 false")
        return
    for i, c in enumerate(x):
        base, _, pin = (c[1] if len(c) >= 2 and isinstance(c[1], str) else "").partition("#")
        if not (isinstance(c, list) and len(c) >= 2 and isnum(c[0]) and base in KINDS and pin in ("", "1", "2", "3")):
            g.w("sfx[%d]=%r 格式不对：[秒,\"kind\"] 或 [秒,\"kind#号\"]（指定音效池里第几个），kind 只能是 %s" % (i + 1, c, " ".join(KINDS)))
            continue
        d = c[2] if len(c) > 2 and isnum(c[2]) else (1.0 if base == "type" else None)
        g.c(c[0], base, "手写 sfx" + ("#" + pin if pin else ""), d)


def run_seg(g):
    s = g.spec
    if not isinstance(s, dict) or s.get("_unparsed"):
        return
    if not lint_spec(g, s):
        return
    fn = SCENES.get(s.get("scene"))
    try:
        fn(g, s)
    except (KeyError, TypeError, ValueError, IndexError, ZeroDivisionError) as e:
        g.w("SPEC 有字段类型不对（%s: %s），这段的音效没有生成完整" % (type(e).__name__, e))
    extra_sfx(g, s)
    if g.no_sfx:
        g.raw = []
    finalize(g)


# ======================================================================
# 整片轮换规则
# ======================================================================
def rotation(segs, fps):
    out = []
    sp = [g for g in segs if g.scene]
    for a, b in zip(sp, sp[1:]):
        if a.scene == b.scene:
            out.append(("⚠", "%s 和 %s 连着用了同一个场景 %s，换一个（references/scenes.md「按口播挑场景」）" % (a.name, b.name, a.scene)))
    cnt = {}
    for g in sp:
        cnt[g.scene] = cnt.get(g.scene, 0) + 1
    for k, v in cnt.items():
        if v > 3:
            out.append(("⚠", "场景 %s 用了 %d 次，一条片子最多 3 次" % (k, v)))
    allc = sorted([g for g in segs if g.scene or g.path], key=lambda g: g.start)
    reported_until = -1
    for i, g in enumerate(allc):
        win = [h for h in allc if g.start <= h.start < g.start + 60 * fps]
        if len(win) > 5 and g.start >= reported_until:
            out.append(("⚠", "从 %s（%.1f s）起 60 秒内有 %d 张卡片（最多 5 张）：%s" % (g.name, g.start / fps, len(win), " ".join(h.name for h in win))))
            reported_until = win[-1].start + 1
    for a, b in zip(allc, allc[1:]):
        if a.layout == "B" and b.layout == "B" and abs(a.start + a.dur_f - b.start) <= 1:
            if not (a.spec and b.spec and a.spec.get("panelOut") is False and b.spec.get("panelIn") is False):
                out.append(("·", "%s → %s 两张上卡下人紧挨着：规范是中间切回人物全屏；真要连着，前一段写 \"panelOut\":false、后一段 \"panelIn\":false（底色不收起，也不会再响一次 whoosh）" % (a.name, b.name)))
    return out


def global_gap(groups_segs, fps):
    """跨段：任意两个 cue 至少隔 0.1 s"""
    allc = []
    for g in groups_segs:
        for c in g.cues:
            allc.append((g.start / fps + c[0], c, g))
    acc = []
    for tabs, c, g in sorted(allc, key=lambda x: (-PRIO.get(x[1][1], 0), x[0])):
        hit = next((a for a in acc if abs(a[0] - tabs) < 0.1 - 1e-6 and a[2] is not g), None)
        if hit:
            g.cues.remove(c)
            g.hint("%.2f %s 离相邻段 %s 的 %s 不到 0.1 s，去掉" % (c[0], c[1], hit[2].name, hit[1][1]))
            continue
        acc.append((tabs, c, g))


# ======================================================================
# 输出
# ======================================================================
def load_kinds(path):
    if path and os.path.exists(path):
        k = json.load(open(path, encoding="utf-8"))
        return {a: b for a, b in k.items() if not a.startswith("_")}
    print("· 没找到 %s，用脚本内置的 kind → action 映射" % path)
    return KINDS_DEFAULT


# 场合（role）：音效池按场合挑变体，见 references/sfx.md。按 cue 的说明文字归类，改 g.c 的说明文字时要同步这里。
ROLE_RULES = {
    "whoosh": [("hook", ("钩子", "章节", "合集开场", "风格组合标题")), ("full", ("全屏", "片尾")), ("panel", ("",))],
    "pop":    [("bubble", ("气泡",)), ("card", ("",))],
    "tick":   [("check", ("✓", "打勾")), ("mark", ("框选",)), ("list", ("",))],
    "hit":    [("big", ("计数结束 countAt", "结果计数", "数字落定")), ("small", ("",))],
    "swipe":  [("strike", ("划掉",)), ("page", ("翻到", "翻页")), ("doc", ("文件滑入",)), ("highlight", ("",))],
    "ok":     [("save", ("收藏",)), ("verdict", ("",))],
    "no":     [("risk", ("风险",)), ("cross", ("",))],
    "type":   [("type", ("",))],
}


def role_of(kind, why):
    for role, keys in ROLE_RULES.get(kind, [("", ("",))]):
        if any(k in (why or "") for k in keys):
            return role
    return ""


GROUP_META = {}  # 组名 → {"layout": "A|B|C", "frames": 段长帧, "circle": 是否需要人物圆窗}，给 final_check.py / gk_layout.py 用


def note_meta(g, name):
    sp = g.spec if isinstance(getattr(g, "spec", None), dict) else {}
    GROUP_META[name] = {"layout": g.layout, "frames": g.dur_f, "circle": g.layout == "C" and g.scene not in NO_CIRCLE,
                        "panelIn": sp.get("panelIn") is not False, "panelOut": sp.get("panelOut") is not False}


NO_CIRCLE = ("end",)  # 片尾全屏、不留人物圆窗的场景


def cue_out(c):
    """[段内秒, 音色, 时长(只有 type 有), 场合, 说明]；说明里带 #号 表示手写指定了音效池第几个。"""
    return [c[0], c[1], round(c[3], 2) if c[1] == "type" and c[3] is not None else None, role_of(c[1], c[2]), c[2]]


def write_outputs(groups, fps, total, out, events, project, kinds_path):
    """groups: [(name, startFrame, [cue…])]，cue = [t, kind, why, dur]"""
    meta = GROUP_META
    data = {"fps": fps, "totalFrames": total, "groups": [dict({"name": n, "startFrame": f}, **meta.get(n, {}), cues=[cue_out(c) for c in cs]) for n, f, cs in groups]}
    with open(out, "w", encoding="utf-8") as fh:  # 一组一行，方便人看
        fh.write('{"fps": %s, "totalFrames": %d, "groups": [\n' % (json.dumps(int(fps) if float(fps).is_integer() else fps), total))
        fh.write(",\n".join(" " + json.dumps(gr, ensure_ascii=False) for gr in data["groups"]))
        fh.write("\n]}\n")
    n_cues = sum(len(cs) for _, _, cs in groups)
    by = {}
    for _, _, cs in groups:
        for c in cs:
            by[c[1]] = by.get(c[1], 0) + 1
    print("写入 %s：%d 组，%d 个音效（%s）" % (out, len(groups), n_cues, "  ".join("%s %d" % (k, by[k]) for k in KINDS if k in by)))
    if events:
        kinds = load_kinds(kinds_path)
        evs = []
        for name, f, cs in groups:
            for c in cs:
                k = kinds.get(c[1], {"action": c[1]})
                e = {"t": round(f / fps + c[0], 3), "action": k.get("action", c[1])}
                for key in ("strength", "style"):
                    if k.get(key):
                        e[key] = k[key]
                d = c[3] if c[3] is not None else k.get("dur")
                if d is not None:
                    e["dur"] = d
                e["note"] = "%s %s" % (name, c[1])
                evs.append(e)
        evs.sort(key=lambda e: e["t"])
        evs = [dict({"id": "e%03d" % (i + 1)}, **e) for i, e in enumerate(evs)]
        with open(events, "w", encoding="utf-8") as fh:
            fh.write('{"project":%s,"events":[\n' % json.dumps(project, ensure_ascii=False))
            fh.write(",\n".join(json.dumps(e, ensure_ascii=False) for e in evs))
            fh.write("\n]}\n")
        print("写入 %s：%d 个事件（project=%s）" % (events, len(evs), project))
    return by


def print_seg(g, verbose=True):
    sc = g.scene or ("（无 SPEC）" if not g.spec else "?")
    print("%-24s @%5d +%4d  %s %-10s %d 个音效" % (g.name, g.start, g.dur_f, g.layout, sc, len(g.cues)))
    if g.say_log:
        print("    say 定时（已写回 %s）：" % os.path.basename(g.path or g.name))
        for line in g.say_log:
            print(line)
    if g.cues:
        print("    " + "  ".join("%.2f %s%s〔%s〕" % (c[0], c[1], " %.2f" % c[3] if c[1] == "type" and c[3] else "", c[2]) for c in g.cues))
    if verbose and g.dropped:
        print("    去掉: " + "  ".join("%.2f %s〔%s〕←%s" % (c[0], c[1], c[2], why) for c, why in g.dropped))
    for lv, m in g.warn:
        print("    %s %s" % (lv, m))


# ======================================================================
# --check-jsx：字段表和 JSX 实际读取的字段对一遍（只查顶层字段）
# ======================================================================
JS_NOISE = {"slice", "indexOf", "length", "split", "includes", "replace", "map", "filter", "reduce", "join", "toFixed", "some", "find", "push", "trim", "startsWith", "dur", "t", "fps"}


def check_jsx(mg):
    files = ["scenes_a.jsx", "scenes_b.jsx", "scenes_c.jsx"]
    bad, seen = 0, set()
    for fn in files:
        p = os.path.join(mg, fn)
        if not os.path.exists(p):
            print("⚠ 没有 %s" % p)
            continue
        src = open(p, encoding="utf-8").read()
        reg = dict((m.group(1), (m.group(2), m.group(3))) for m in re.finditer(r"(\w+):\s*\{\s*C:\s*(\w+),\s*layout:\s*\"([ABC])\"", src))
        bodies = {}
        for sc, (comp, lay) in reg.items():
            m = re.search(r"\nfunction %s\(\{\s*spec(?::\s*(\w+))?\s*\}\)\s*\{" % comp, src)
            if not m:
                print("⚠ %s 里找不到 %s 的组件函数 %s" % (fn, sc, comp))
                continue
            end = re.search(r"\n(?:function |const |// =+|export )", src[m.end():])
            bodies[sc] = (m.group(1) or "spec", src[m.end(): m.end() + (end.start() if end else len(src))])
            if LAYOUT.get(sc) != lay:
                print("⚠ %s 的 layout 在 JSX 里是 %s，脚本里是 %s" % (sc, lay, LAYOUT.get(sc)))
                bad += 1
        # 组件以外的帮手函数读的字段（useB / Head / cardAtOf / BStage …）对这个文件的所有场景都算
        helper = src
        for _, (_, b) in bodies.items():
            helper = helper.replace(b, "")
        hf = {k for k in re.findall(r"\b(?:spec|s)\.(\w+)", helper) if k not in JS_NOISE and not k.startswith("_")}
        for sc, (var, body) in bodies.items():
            read = {k for k in re.findall(r"\b%s\.(\w+)" % var, body) if k not in JS_NOISE and not k.startswith("_")}
            if var != "spec":
                read |= {k for k in re.findall(r"\bspec\.(\w+)", body) if k not in JS_NOISE}
            mine = (SCHEMA.get(sc, {}).get("_", set()) | COMMON)
            miss = sorted(read - mine)
            extra = sorted(mine - read - hf - COMMON)
            if sc not in SCHEMA:
                print("⚠ JSX 里有新场景 %s，脚本还没有规则" % sc)
                bad += 1
                continue
            line = "%-11s %s" % (sc, "✓" if not miss else "")
            if miss:
                bad += 1
                line += "⚠ JSX 读了脚本字段表里没有的：%s" % " ".join(miss)
            if extra:
                line += "  ·（脚本表里有、组件函数里没直接读，可能在帮手函数里：%s）" % " ".join(extra)
            print(line)
        seen.update(reg)
    for k in sorted(set(LAYOUT) - seen):
        print("⚠ 脚本里的场景 %s 在 JSX 的 SCENES_X 里找不到" % k)
        bad += 1
    print("字段对照：%s" % ("全部对上" if not bad else "%d 处要更新脚本" % bad))
    return bad


# ======================================================================
# 演示合集（gallery.jsx + combos.jsx）
# ======================================================================
def combo_fit(spec, cdur):
    """与 combos.jsx 的 fit() 一致：示例压到 COMBO_DUR 时各步时间按比例前移。改那边要同步改这里。"""
    k = (cdur - 0.7) / max(1, (spec.get("endAt") or spec.get("dur") or cdur) - 0.3)
    sc = lambda v: round(max(0.5, v * k), 2) if isinstance(v, (int, float)) and not isinstance(v, bool) else v
    spec = dict(spec, dur=cdur, endAt=sc(spec.get("endAt")))
    spec["items"] = [dict(it, at=sc(it.get("at"))) if isinstance(it, dict) else it for it in spec.get("items") or []]
    return spec


def gallery(mg, fps, theme_base, combos_start=None):
    probs, segs, extra_groups = [], [], []
    demos = []
    for fn, nm in (("scenes_a.jsx", "DEMOS_A"), ("scenes_b.jsx", "DEMOS_B"), ("scenes_c.jsx", "DEMOS_C")):
        d, e = parse_js_array(os.path.join(mg, fn), nm)
        demos += d
        probs += e
    gsrc = open(os.path.join(mg, "gallery.jsx"), encoding="utf-8").read()
    m = re.search(r"const\s+INTRO\s*=\s*([0-9.]+)", gsrc)
    intro = float(m.group(1)) if m else 2.5
    m = re.search(r"spec\.dur\s*\|\|\s*([0-9.]+)", gsrc)
    ddef = float(m.group(1)) if m else 4.5
    th = make_theme(theme_base)
    at = jround(intro * fps)
    extra_groups.append(("gallery 开场标题", 0, [[0.0, "whoosh", "合集开场标题", None]]))
    for i, spec in enumerate(demos):
        d = jround((spec.get("dur") or ddef) * fps)
        g = Seg("demo%02d" % (i + 1), at, d, fps, spec, None, None, th)
        if spec.get("_unparsed"):
            g.w("DEMOS 这一项解析不了：%s" % spec["_unparsed"])
        segs.append(g)
        at += d
    gallery_end = at
    csrc = open(os.path.join(mg, "combos.jsx"), encoding="utf-8").read()
    m = re.search(r"const\s+COMBO_DUR\s*=\s*([0-9.]+)", csrc)
    cdur = float(m.group(1)) if m else 3.6
    m = re.search(r"const\s+PICK\s*=\s*\[([^\]]*)\]", csrc)
    pick = re.findall(r"\"(\w+)\"", m.group(1)) if m else ["steps"]
    m = re.search(r"Math\.round\(\s*([0-9.]+)\s*\*\s*fps\s*\)", csrc)
    t0s = float(m.group(1)) if m else 1.9
    combos, e = parse_js_array(os.path.join(mg, "combos.jsx"), "COMBOS")
    probs += e
    base = next((x for x in demos if x.get("scene") == pick[0]), None) or next((x for x in demos if x.get("scene") in pick), None) or demos[0]
    cstart = gallery_end if combos_start is None else combos_start
    extra_groups.append(("combos 标题", cstart, [[0.0, "whoosh", "风格组合标题", None]]))
    t0 = jround(t0s * fps)
    dd = jround(cdur * fps)
    for i, c in enumerate(combos):
        spec = combo_fit(json.loads(json.dumps(base)), cdur)
        g = Seg("combo%d" % (i + 1), cstart + t0 + i * dd, dd, fps, spec, None, None, make_theme(theme_base, c.get("theme") if isinstance(c, dict) else None))
        g.combo = c.get("name") if isinstance(c, dict) else ""
        segs.append(g)
    total = cstart + t0 + len(combos) * dd
    info = {"intro": intro, "gallery_end": gallery_end, "combos_start": cstart, "total": total, "n_demos": len(demos), "n_combos": len(combos), "pick": base.get("scene")}
    return segs, extra_groups, probs, info


# ======================================================================
def find_theme(path_hint, mg):
    for p in ([path_hint] if path_hint else []) + [os.path.join(mg, "theme.jsx")]:
        if p and os.path.exists(p):
            t = parse_js_object(p, "THEME")
            if t is not None:
                return t, p
    return {}, None


def main():
    ap = argparse.ArgumentParser(description="高级感干货风：say 定时 + 检查 + 音效点")
    ap.add_argument("segments", nargs="*")
    ap.add_argument("--gallery", action="store_true", help="按 gallery.jsx + combos.jsx 生成演示合集的 cues")
    ap.add_argument("--check-jsx", action="store_true", help="字段表和 JSX 实际读取的字段对一遍")
    ap.add_argument("--mg", default=MG_DEFAULT, help="组件库目录（scenes_*.jsx、gallery.jsx、theme.jsx 所在）")
    ap.add_argument("--words", help="timeline_words.py 的输出；SPEC 里有 say 时用它定时并写回段落文件")
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--total-frames", type=int)
    ap.add_argument("--theme", help="theme.jsx 路径；不给就找第一个段落文件旁边的，再找 --mg 里的")
    ap.add_argument("-o", "--out", default=None)
    ap.add_argument("--events", help="给 sfx 技能的事件清单（绝对秒）")
    ap.add_argument("--project", help="events 里的 project 名")
    ap.add_argument("--kinds", default=os.path.join(HERE, "sfx_kinds.json"))
    ap.add_argument("--combos-start", type=int, help="--gallery 时 combos.jsx 在时间线上的起始帧（默认紧接 gallery 结尾）")
    ap.add_argument("-q", "--quiet", action="store_true", help="不列出被合并掉的 cue")
    a = ap.parse_args()
    fps = a.fps
    seg_dir = os.path.dirname(os.path.abspath(a.segments[0].split("@")[0])) if a.segments else None
    detect_profile(([seg_dir] if seg_dir and not a.gallery else []) + [a.mg])
    print(profile_line())
    if a.check_jsx:
        sys.exit(1 if check_jsx(PROFILE["src"] or a.mg) else 0)
    if not a.gallery and not a.segments:
        ap.error("要么给段落文件（段.jsx@起始帧+时长帧），要么 --gallery")
    # JSX 里的 layout 表（有就用 JSX 的，防止脚本落后）
    for fn in ("scenes_a.jsx", "scenes_b.jsx", "scenes_c.jsx"):
        p = os.path.join(PROFILE["src"] or a.mg, fn)
        if os.path.exists(p):
            for m in re.finditer(r"(\w+):\s*\{\s*C:\s*\w+,\s*layout:\s*\"([ABC])\"", open(p, encoding="utf-8").read()):
                if m.group(1) in LAYOUT and LAYOUT[m.group(1)] != m.group(2):
                    print("· JSX 里 %s 的 layout 是 %s（脚本表是 %s），按 JSX" % (m.group(1), m.group(2), LAYOUT[m.group(1)]))
                    LAYOUT[m.group(1)] = m.group(2)
                elif m.group(1) not in LAYOUT:
                    print("⚠ JSX 里有新场景 %s，脚本还没有它的规则（不生成音效）" % m.group(1))

    if a.gallery:
        tb, tp = find_theme(a.theme, a.mg)
        segs, extra, probs, info = gallery(a.mg, fps, tb, a.combos_start)
        print("演示合集：开场 %.1f s，%d 个 DEMOS → gallery 0–%d 帧；combos 从 %d 帧起（标题 + %d 段 %s），到 %d 帧" % (
            info["intro"], info["n_demos"], info["gallery_end"], info["combos_start"], info["n_combos"], info["pick"], info["total"]))
        if info["combos_start"] < info["gallery_end"]:
            print("⚠ combos 起点 %d 早于 gallery 结尾 %d：两段在时间线上重叠" % (info["combos_start"], info["gallery_end"]))
        for p in probs:
            print("⚠ " + p)
        for g in segs:
            run_seg(g)
        global_gap(segs, fps)
        groups = []
        allg = [(f, n, c) for n, f, c in extra] + [(g.start, "%s %s%s" % (g.name, g.scene, (" " + g.combo) if getattr(g, "combo", "") else ""), g.cues) for g in segs]
        for g in segs:
            note_meta(g, "%s %s%s" % (g.name, g.scene, (" " + g.combo) if getattr(g, "combo", "") else ""))
        for f, n, c in sorted(allg, key=lambda x: x[0]):
            groups.append((n, f, c))
        for n, f, c in extra:
            print("%-24s @%5d        %s" % (n, f, "  ".join("%.2f %s" % (x[0], x[1]) for x in c)))
        bad = 0
        for g in segs:
            print_seg(g, not a.quiet)
            bad += sum(1 for lv, _ in g.warn if lv == "⚠")
        print("· 演示合集不做整片轮换检查（场景本来就是挨个排的）")
        out = a.out or os.path.join(HERE, "gallery_cues.json")
        by = write_outputs(groups, fps, a.total_frames or info["total"], out, a.events, a.project or "gk-gallery", a.kinds)
        print("%d 条 ⚠ 检查结果" % bad)
        return

    th0, tp = find_theme(a.theme or os.path.join(os.path.dirname(os.path.abspath(a.segments[0].split("@")[0])), "theme.jsx"), a.mg)
    th = make_theme(th0)
    segs = sorted((Seg.from_arg(x, fps, th) for x in a.segments), key=lambda g: g.start)
    words = Words(a.words) if a.words else None
    for g in segs:
        if g.spec and has_say(g.spec):
            if not words:
                g.w("SPEC 里有 say，但没给 --words tl_words.json，时间没有更新")
            elif resolve_say(g, words):
                write_spec(g)
        if g.spec:
            run_seg(g)
    global_gap(segs, fps)
    bad = 0
    for g in segs:
        print_seg(g, not a.quiet)
        bad += sum(1 for lv, _ in g.warn if lv == "⚠")
    rot = rotation(segs, fps)
    if rot:
        print("整片轮换规则：")
        for lv, m in rot:
            print("    %s %s" % (lv, m))
        bad += sum(1 for lv, _ in rot if lv == "⚠")
    total = a.total_frames or max(g.start + g.dur_f for g in segs)
    out = a.out or "cues.json"
    groups = [("%s %s" % (g.name, g.scene or g.layout), g.start, g.cues) for g in segs]
    for g in segs:
        note_meta(g, "%s %s" % (g.name, g.scene or g.layout))
    write_outputs(groups, fps, total, out, a.events, a.project or os.path.splitext(os.path.basename(out))[0], a.kinds)
    print("风格包：%s（title=%s num=%s）" % (tp or "没找到 theme.jsx，按默认", th["title"], th["num"]))
    print("%d 条 ⚠ 需要处理" % bad)


if __name__ == "__main__":
    main()
