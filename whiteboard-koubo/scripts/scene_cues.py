#!/usr/bin/env python3
"""从场景动效（assets/whiteboard-mg/scenes.jsx）的 SPEC 自动生成音效 cues，并检查文字放不放得下、时间对不对。

用法:
  scene_cues.py <段落.jsx@起始帧+时长帧[:A|B]> ... [overview@起始帧+时长帧] [--fps 30] [--total-frames N]
                [--voice-median -31.6] [--extra 手写.json] [--words tl_words.json] [--camera page|board] [-o cues.json]

  --words: timeline_words.py 的输出。SPEC 里写了 say 的地方，按口播里说到这几个字的时刻自动填秒数，
    并把结果写回段落文件（say 保留，重跑会重新算）：
      "say":"先删重复" → at；"markSay" → markAt；"outSay" → out；"strikeSay" → strikeAt …（xxxSay → xxxAt）
      hand / sub 里的 say 同时填 end（说完那一刻）。同一句说了好几次，写 "先删重复#2" 取第 2 次。
    找不到就报错；只找到相近的会提示口播里实际是哪几个字。
  检查（⚠ 必须处理，· 是提示）：字段名拼错（给出最接近的正确写法）、取值不在可选范围、时间不在段内、
    文字放不下、图标/印章可能压到标题或内容，以及整片的场景轮换规则。

  段落.jsx: 每段动效一个文件，里面有 `const SPEC = /*SPEC*/ {...纯 JSON...} /*END*/;`。
    起始帧、时长帧 = 这段动效在时间线上的位置（edit_item 里的 startFrame / durationFrames）。
    没有 SPEC 的手写动效也可以列上，并在末尾标 :A（人物全屏叠层）或 :B（全屏动效），
    只用来判断版式切换处的嗖声；它自己的音效写进 --extra（sfx_bed.py 的 groups 格式）。
  整板运镜（theme.jsx 的 camera: "board"，或 --camera board）：额外写 board_data.jsx 和每个全屏动效窗口的
    cam_<段名>.jsx，时间线 V1 上放 cam_*.jsx，不放段落文件本身。参数里加 overview@起始帧+时长帧 可以插一段
    「镜头拉远看整块白板」的总览（没有文件）。手写的全屏动效标 :B 才会上白板。
  输出: sfx_bed.py 能直接用的 cues.json；屏幕上列出每段生成的 cue 和检查结果。

音效规则（从人工逐个配的 103 个 cue 里总结）:
  标题、便签、卡片、聊天窗、单个气泡弹出 → pop；连续出现的小元素（清单 3 条以上、词条、小气泡）→ tiny
  手写 → scribble（时长 = 书写时长）；划线 → scribble 0.4；荧光笔 → scribble 0.5；打叉 → scribble 0.3
  打勾 → tick；打字 → typing（时长 = 打字时长）
  版式切换（人物全屏 ↔ 全屏动效）→ whoosh，提前 0.22 s；顶部卡片换阶段 → whoosh
  截图贴上、便签墙的便签 → paper（真实纸张声）；对比的 VS 章 → stamp
  手写/划线/盖章用真实录音还是合成，由 theme.jsx 的 sound 决定：自动读第一个段落旁边的 theme.jsx（或 --theme），
  把 sound 和 seed 写进 cues.json，sfx_bed.py 按它挑录音。
文字测量、折行规则与 scenes.jsx 的 fit()/wrap() 一致，改一边要同步改另一边。
"""
import argparse, difflib, json, os, re, sys
if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台/管道默认 GBK，打印 ⚠ ✓ 会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ---------- 与 scenes.jsx 相同的测量 ----------
WIDE = re.compile("[⺀-鿿豈-﫿＀-￯　-〿‘-‟…←-⇿①-⓿]")
ALNUM = re.compile(r"[A-Za-z0-9]")
BREAK_AFTER = re.compile(r"[，。、；：！？,.;:!?）)\s]")


def char_w(ch):
    if WIDE.match(ch):
        return 1.0
    if ch == " ":
        return 0.3
    if re.match(r"[A-Z0-9]", ch):
        return 0.62
    if re.match(r"[a-z]", ch):
        return 0.55
    return 0.4


def raw_w(s, size):
    return sum(char_w(c) for c in s) * size


def text_w(s, size):
    return raw_w(s, size) * 1.05


def fit(text, max_w, max_size, min_size, max_lines=2):
    one = text_w(text, 1)
    size = min(max_size, max_w / one) if one else max_size
    if size >= min_size or max_lines < 2:
        return [text], int(max(size, min_size)), size < min_size
    # 先找标点处断开（按短语）；标点处断开放得下就一定用它，否则才在字与字之间断
    bp = bc = None
    for i in range(1, len(text)):
        a, b = text[i - 1], text[i]
        if ALNUM.match(a) and ALNUM.match(b):
            continue
        l1, l2 = text[:i].rstrip(), text[i:].lstrip()
        if not l1 or not l2:
            continue
        w = max(text_w(l1, 1), text_w(l2, 1))
        if BREAK_AFTER.match(a):
            if bp is None or w < bp[0]:
                bp = (w, [l1, l2])
        elif bc is None or w < bc[0]:
            bc = (w, [l1, l2])
    sz = lambda o: min(max_size, max_w / o[0])
    if bp and sz(bp) >= min_size:
        best = bp
    elif bc and (not bp or sz(bc) > sz(bp)):
        best = bc
    else:
        best = bp
    if not best:
        return [text], min_size, True
    size = sz(best)
    return best[1], int(max(size, min_size)), size < min_size


def wrap(text, max_w, size):
    lines, cur = [], ""
    for ch in text:
        nxt = cur + ch
        if cur and text_w(nxt, size) > max_w:
            cut = len(cur)
            if ALNUM.match(ch):
                m = re.search(r"[A-Za-z0-9]+$", cur)
                if m and len(m.group(0)) < len(cur):
                    cut = len(cur) - len(m.group(0))
            lines.append(cur[:cut].rstrip())
            cur = cur[cut:].lstrip() + ch
        else:
            cur = nxt
    if cur:
        lines.append(cur)
    return lines


B_SCENES = {"list", "strike", "step", "chat", "compare", "number", "shot", "quote", "mindmap", "comment", "outro"}


# ---------- 字段检查：每个场景允许的字段（和 scenes.jsx 实际读取的一致） ----------
HAND = {"text", "at", "end"}
COMMON = {"scene", "style", "title", "hl", "titleAt", "doodles", "stamp"}
SCHEMA = {
    "list": {"_": {"items", "numbered"}, "items": {"text", "at", "mark", "markAt", "color", "out"}},
    "strike": {"_": {"from", "fromAt", "strikeAt", "to", "toAt", "toColor", "arrowAt", "hand"}, "hand": HAND},
    "step": {"_": {"n", "sub", "label", "at", "note", "chips", "hand"}, "note": {"text", "at", "color"}, "chips": {"text", "at", "color"}, "hand": HAND},
    "chat": {"_": {"window", "winAt", "messages", "notes"}, "messages": {"who", "text", "at", "typing", "typeDur"}, "notes": {"text", "at", "color", "mark", "markAt"}},
    "topcard": {"_": {"at", "rot", "phases", "start", "label", "big", "to", "notes", "hand"}, "phases": {"start", "label", "big", "to", "notes", "hand"},
                "big": {"text", "at", "hl", "hlAt", "strikeAt"}, "to": {"text", "at", "color"}, "notes": {"text", "at", "color", "mark", "markAt"}, "hand": HAND},
    "compare": {"_": {"left", "right", "vs", "vsAt", "verdict"}, "left": {"label", "at", "items", "mark", "markAt", "color"},
                "right": {"label", "at", "items", "mark", "markAt", "color"}, "items": {"text", "at"}, "verdict": {"side", "at", "text", "textAt", "color"}},
    "number": {"_": {"value", "from", "prefix", "suffix", "at", "countDur", "label", "labelAt", "circleAt", "bars", "note", "hand"},
               "bars": {"label", "value", "unit", "at", "color"}, "note": {"text", "at", "color"}, "hand": HAND},
    "shot": {"_": {"image", "ratio", "at", "rot", "marks", "zoom", "caption"}, "marks": {"kind", "x", "y", "w", "h", "at", "text"},
             "zoom": {"x", "y", "w", "h", "at", "dur", "out"}, "caption": {"text", "at"}},
    "quote": {"_": {"text", "at", "writeDur", "hlAt", "wavyAt", "by", "byAt", "card", "color"}},
    "mindmap": {"_": {"center", "nodes", "hand"}, "center": {"text", "at"}, "nodes": {"text", "at", "color"}, "hand": HAND},
    "comment": {"_": {"comments", "reply", "hand"}, "comments": {"user", "text", "at", "likes"}, "reply": {"text", "at", "typing", "typeDur", "label"}, "hand": HAND},
    "outro": {"_": {"text", "at", "sub", "icons"}, "sub": {"text", "at", "end"}, "icons": {"kind", "at"}},
}
SUB_COMMON = {"doodles": {"kind", "at", "pos", "x", "y", "size"}, "stamp": {"text", "at", "pos", "x", "y"}}
COLORS = {"noteY", "noteB", "noteG", "noteP", "white", "paper", "ink", "blue", "red", "green", "muted", "hl"}
ENUMS = {"who": {"me", "ai"}, "side": {"left", "right"},
         "style": {"notes"}, "pos": {"title", "tr", "tl", "mr", "ml", "bl", "mid"}}
SHOT_KINDS = {"circle", "box", "hl", "arrow"}
DOODLES = {"bulb", "question", "exclaim", "star", "fire", "heart", "bolt", "check", "eyes"}


def is_say(k):
    return k == "say" or (k.endswith("Say") and len(k) > 3)


def lint_spec(seg, spec):
    sc = spec.get("scene")
    if sc not in SCHEMA:
        near = difflib.get_close_matches(str(sc), SCHEMA.keys(), 1)
        seg.w("scene「%s」不认识%s" % (sc, "，是不是「%s」" % near[0] if near else "；可用：" + " ".join(SCHEMA)))
        return
    sch = SCHEMA[sc]

    def check(obj, allowed, where, parent_key):
        if not isinstance(obj, dict):
            return
        for k, v in obj.items():
            if is_say(k):
                continue
            if k not in allowed:
                near = difflib.get_close_matches(k, allowed, 1, 0.6)
                seg.w("%s里的字段「%s」不认识%s，会被忽略" % (where, k, "，是不是「%s」" % near[0] if near else "（可用：%s）" % " ".join(sorted(allowed))))
                continue
            if k in ("color", "toColor") and isinstance(v, str) and v not in COLORS:
                seg.w("%s的 %s「%s」不是可用颜色（%s）" % (where, k, v, " ".join(sorted(COLORS))))
            if k in ENUMS and isinstance(v, str) and v not in ENUMS[k]:
                seg.w("%s的 %s「%s」不在可选范围（%s）" % (where, k, v, " / ".join(sorted(ENUMS[k]))))
            if k == "kind" and isinstance(v, str):
                ok = SHOT_KINDS if parent_key == "marks" else DOODLES
                if v not in ok:
                    near = difflib.get_close_matches(v, ok, 1)
                    seg.w("%s的 kind「%s」不认识%s" % (where, v, "，是不是「%s」" % near[0] if near else "（%s）" % " ".join(sorted(ok))))
            sub = sch.get(k) or SUB_COMMON.get(k)
            if k in ("sub",) and sc == "step":
                continue  # step 的 sub 是一行小字
            if sub and isinstance(v, dict):
                check(v, sub | ({"start"} if k == "phases" else set()), "%s.%s " % (where.strip(), k), k)
            elif sub and isinstance(v, list):
                for i, it in enumerate(v):
                    if isinstance(it, dict):
                        check(it, sub, "%s.%s[%d] " % (where.strip(), k, i + 1), k)
    check(spec, COMMON | sch["_"], "SPEC ", None)


# ---------- say：按口播里说到的字自动定时 ----------
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
        m = re.match(r"^(.*?)(?:#(\d+))?$", phrase)
        p, nth = _norm(m.group(1)), int(m.group(2) or 1)
        if not p:
            return None
        lo = next((k for k, i in enumerate(self.idx) if self.W[i]["t"] >= t0), len(self.s))
        hi = next((k for k, i in enumerate(self.idx) if self.W[i]["t"] > t1), len(self.s))
        win = self.s[lo:hi]
        hits = [h.start() for h in re.finditer(re.escape(p), win)]
        if len(hits) >= nth:
            k = lo + hits[nth - 1]
            return self.W[self.idx[k]]["t"], self.W[self.idx[k + len(p) - 1]]["end"], p, False, len(hits)
        best, bk, bl = 0, None, len(p)
        for L in (len(p) - 1, len(p), len(p) + 1):
            for k in range(0, max(0, len(win) - L + 1)):
                r = difflib.SequenceMatcher(None, p, win[k:k + L]).ratio()
                if r > best:
                    best, bk, bl = r, k, L
        if bk is not None and best >= 0.6:
            k = lo + bk
            return self.W[self.idx[k]]["t"], self.W[self.idx[k + bl - 1]]["end"], win[bk:bk + bl], True, 0
        return None


LEAD = 0.1  # 元素比说到那个字略早一点出现


def resolve_say(seg, words, log):
    """把 SPEC 里的 say / xxxSay 换算成段内秒数，写回 seg.spec；返回改了几处。"""
    t0, t1 = seg.start / seg.fps - 0.6, (seg.start + seg.dur_f) / seg.fps + 0.3
    base = seg.start / seg.fps
    n = 0

    def walk(obj, parent_key):
        nonlocal n
        if isinstance(obj, list):
            for it in obj:
                walk(it, parent_key)
            return
        if not isinstance(obj, dict):
            return
        for k in list(obj.keys()):
            if is_say(k) and isinstance(obj[k], str):
                r = words.find(obj[k], t0, t1)
                if not r:
                    seg.w("say「%s」在这段的时间范围里找不到（%.1f–%.1f s）。照口播原话抄几个字，或检查段落位置" % (obj[k], t0 + 0.6, t1 - 0.3))
                    continue
                st, en, got, approx, cnt = r
                target = "at" if k == "say" else (k[:-3] if k[:-3] in ("out", "end") else k[:-3] + "At")
                val = round(max(0.0, st - base - (LEAD if target != "end" else 0)), 2)
                obj[target] = val
                if k == "say" and (parent_key in ("hand", "sub") or "end" in obj):
                    obj["end"] = round(en - base, 2)
                n += 1
                note = ""
                if approx:
                    note = "  ⚠ 近似匹配：口播里是「%s」" % got
                    seg.w("say「%s」只找到相近的「%s」，确认是不是这一句" % (obj[k], got))
                elif cnt > 1 and "#" not in obj[k]:
                    note = "  · 这段里说了 %d 次，用的第 1 次（要别的写 #2）" % cnt
                log.append("    %-14s「%s」→ %s %.2f%s" % (k, obj[k], target, val, note))
        for k, v in obj.items():
            if isinstance(v, (dict, list)):
                walk(v, k)
    walk(seg.spec, None)
    return n


def has_say(o):
    if isinstance(o, dict):
        return any(is_say(k) for k in o) or any(has_say(v) for v in o.values())
    if isinstance(o, list):
        return any(has_say(v) for v in o)
    return False


def write_spec(seg):
    src = open(seg.path, encoding="utf-8").read()
    new = re.sub(r"/\*SPEC\*/.*?/\*END\*/", lambda m: "/*SPEC*/ " + json.dumps(seg.spec, ensure_ascii=False) + " /*END*/", src, count=1, flags=re.S)
    open(seg.path, "w", encoding="utf-8").write(new)


# ---------- 时间先后 ----------
def order_check(seg, spec):
    def walk(o, where):
        if isinstance(o, list):
            for i, it in enumerate(o):
                walk(it, "%s[%d]" % (where, i + 1))
            return
        if not isinstance(o, dict):
            return
        at = o.get("at")
        if isinstance(at, (int, float)):
            for k, rel in (("markAt", "≥"), ("out", ">"), ("end", ">"), ("hlAt", "≥"), ("textAt", "≥")):
                v = o.get(k)
                if isinstance(v, (int, float)) and (v < at or (rel == ">" and v == at)):
                    seg.w("%s 的 %s=%.2f 早于出现时间 at=%.2f" % (where or "SPEC", k, v, at))
        for k, v in o.items():
            if isinstance(v, (dict, list)):
                walk(v, (where + "." if where else "") + k)
    walk(spec, "")
    if spec.get("scene") == "strike":
        f, st, to = spec.get("fromAt"), spec.get("strikeAt"), spec.get("toAt")
        if isinstance(f, (int, float)) and isinstance(st, (int, float)) and f >= st:
            seg.w("strike 的 fromAt=%.2f 不早于 strikeAt=%.2f（先出现才能划掉）。say 取到的可能是后面一次，写 #1/#2 指定或换几个字" % (f, st))
        if isinstance(st, (int, float)) and isinstance(to, (int, float)) and to <= st:
            seg.w("strike 的 toAt=%.2f 不晚于 strikeAt=%.2f" % (to, st))
    items = spec.get("items") or []
    ats = [it.get("at") for it in items if isinstance(it, dict)]
    for i in range(1, len(ats)):
        if isinstance(ats[i], (int, float)) and isinstance(ats[i - 1], (int, float)) and ats[i] < ats[i - 1]:
            seg.w("items 第 %d 条的 at 比第 %d 条早，条目要按说的先后排" % (i + 1, i))


# ---------- 整片轮换规则 ----------
def rotation(segs, fps):
    out = []
    specs = [g for g in segs if g.spec]
    key = lambda g: g.spec.get("scene") + ("/" + g.spec["style"] if g.spec.get("style") else "")
    for a, b in zip(specs, specs[1:]):
        if key(a) == key(b):
            out.append("%s 和 %s 连着用了同一个场景 %s，换一个（见 scenes.md 的可选场景表）" % (a.name, b.name, key(a)))
    cnt = {}
    for g in specs:
        cnt[g.spec.get("scene")] = cnt.get(g.spec.get("scene"), 0) + 1
    for k, v in cnt.items():
        if v > 3:
            out.append("场景 %s 用了 %d 次，一条片子最多 3 次" % (k, v))
    chain, chains = [], []
    for g in sorted([g for g in segs if g.layout == "B"], key=lambda g: g.start):
        if chain and g.start - (chain[-1].start + chain[-1].dur_f) <= 1:
            chain.append(g)
        else:
            if chain:
                chains.append(chain)
            chain = [g]
    if chain:
        chains.append(chain)
    for c in chains:
        d = (c[-1].start + c[-1].dur_f - c[0].start) / fps
        if d > 12.5:
            out.append("提示：全屏动效从 %s 到 %s 连续 %.1f 秒（超过约 12 秒），可以在中间切回一次人物全屏" % (c[0].name, c[-1].name, d))
    return out


class Seg:
    def __init__(self, arg, fps):
        m = re.match(r"^(.+)@(\d+)\+(\d+)(?::([AB]))?$", arg)
        if not m:
            sys.exit("参数格式应为 段落.jsx@起始帧+时长帧[:A|B]：%s" % arg)
        self.path, self.start, self.dur_f, lay = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        self.name = os.path.basename(self.path)
        self.dur = self.dur_f / fps
        self.fps = fps
        self.content_bottom = None
        self.cues, self.warn = [], []
        self.overview = self.path == "overview"
        if self.overview:  # 整板运镜的总览段：没有文件，镜头拉远看整块白板
            self.spec, self.layout = None, "B"
            return
        src = open(self.path, encoding="utf-8").read()
        sm = re.search(r"/\*SPEC\*/(.*?)/\*END\*/", src, re.S)
        self.spec = json.loads(sm.group(1)) if sm else None
        if self.spec:
            self.layout = "B" if self.spec.get("scene") in B_SCENES else "A"
        else:
            self.layout = lay or "A"
        self.cues, self.warn = [], []

    def c(self, t, kind, p=None):
        self.cues.append([round(t, 3), kind] + ([p] if p is not None else []))

    def w(self, msg):
        self.warn.append(msg)

    def times(self, *ts):
        for label, v in ts:
            if v is None:
                continue
            if v < 0 or v > self.dur:
                self.w("%s 的时间 %.2f s 不在这段动效内（0–%.2f s）" % (label, v, self.dur))


def over(seg, label, text, lines, size, overflow, where):
    if overflow:
        seg.w("「%s」%s放不下：最小字号 %d 仍超宽。先拆成两屏；还不行就改写并请用户确认（不删否定词和数字）" % (text, where, size))
    elif len(lines) > 1:
        seg.w("提示：「%s」%s折成两行：%s" % (text, where, " / ".join(lines)))


def title(seg, s):
    if s.get("title"):
        lines, size, ov = fit(s["title"], 880, 84, 56, 1)
        over(seg, "title", s["title"], lines, size, ov, "（标题）")
        seg.c(s.get("titleAt", 0.05), "pop")
        if s.get("hl") and s["hl"] not in s["title"]:
            seg.w("hl「%s」不在标题里" % s["hl"])


def scene_list(seg, s):
    if s.get("style") == "notes":
        return scene_list_notes(seg, s)
    title(seg, s)
    items = s.get("items", [])
    if not 1 <= len(items) <= 6:
        seg.w("清单 %d 条，场景按 1–6 条设计；多了拆成两段" % len(items))
    n = max(len(items), 1)
    top = 300 if s.get("title") else 160
    row_h = min(172, (1190 - top) / n)
    circ = min(110, row_h - 40)
    left = 120 + circ + 30 if s.get("numbered", True) else 150
    max_w = 960 - left - (110 if any(o.get("mark") for o in items) else 0)
    kind = "tiny" if len(items) >= 3 else "pop"
    seg.content_bottom = top + n * row_h
    prev = -1
    for i, o in enumerate(items):
        lines, size, ov = fit(o["text"], max_w, min(60, int(row_h * 0.42)), 36, 2)
        over(seg, "item", o["text"], lines, size, ov, "（第 %d 条）" % (i + 1))
        if o["at"] < prev:
            seg.w("第 %d 条的 at 比上一条早" % (i + 1))
        prev = o["at"]
        seg.times(("第 %d 条" % (i + 1), o["at"]))
        seg.c(o["at"], kind)
        mark_cue(seg, o, o["at"] + 0.4)


def scene_strike(seg, s):
    title(seg, s)
    if s.get("strikeAt") is None or not s.get("to"):
        seg.w("strike 场景必须有 strikeAt 和 to")
        return
    f_at, s_at = s.get("fromAt", 0.3), s["strikeAt"]
    to_at = s.get("toAt", s_at + 0.7)
    if isinstance(s.get("from"), list):
        x, row = 120, 0
        for i, w in enumerate(s["from"]):
            cw = text_w(w, 46) + 62
            if x + cw > 960 and x > 120:
                x, row = 120, row + 1
            x += cw + 34
            seg.c(f_at + i * 0.16, "tiny")
        if row > 3:
            seg.w("词条排了 %d 行，太多" % (row + 1))
        seg.c(s_at, "scribble", round(min(3, len(s["from"]) * 0.17 + 0.35), 2))
    else:
        lines, size, ov = fit(s["from"], 840, 120, 64, 1)
        over(seg, "from", s["from"], lines, size, ov, "（被划掉的词）")
        seg.c(f_at, "pop")
        seg.c(s_at, "scribble", 0.4)
    lines, size, ov = fit(s["to"], 740, 110, 60, 1)
    over(seg, "to", s["to"], lines, size, ov, "（替换成的词）")
    seg.c(to_at, "pop")
    seg.times(("fromAt", f_at), ("strikeAt", s_at), ("toAt", to_at))
    if to_at <= s_at:
        seg.w("toAt 应晚于 strikeAt")
    hand(seg, s.get("hand"), 860)


def hand(seg, h, max_w):
    if not h:
        return
    lines, size, ov = fit(h["text"], max_w, 84, 52, 2)
    over(seg, "hand", h["text"], lines, size, ov, "（手写）")
    seg.times(("手写 at", h["at"]), ("手写 end", h["end"]))
    seg.c(h["at"], "scribble", round(min(3, max(0.3, h["end"] - h["at"])), 2))


def scene_step(seg, s):
    seg.c(s.get("at", 0.05), "pop")
    lines, size, ov = fit(s.get("label", ""), 730, 72, 48, 1)
    over(seg, "label", s.get("label", ""), lines, size, ov, "（步骤名）")
    if s.get("note"):
        lines, size, ov = fit(s["note"]["text"], 680, 120, 60, 1)
        over(seg, "note", s["note"]["text"], lines, size, ov, "（大便签）")
        seg.c(s["note"]["at"], "pop")
        seg.times(("note", s["note"]["at"]))
    for c in s.get("chips", []):
        seg.c(c["at"], "tiny")
        seg.times(("chip", c["at"]))
    hand(seg, s.get("hand"), 840)


def scene_chat(seg, s):
    title(seg, s)
    seg.c(s.get("winAt", 0.45), "pop")
    my = 36
    for m in s.get("messages", []):
        lines = wrap(m["text"], 560, 46)
        my += len(lines) * 46 * 1.35 + 44 + 34
        seg.times(("消息", m["at"]))
        if m.get("typing"):
            d = m.get("typeDur", min(2.5, len(m["text"]) * 0.09))
            seg.c(m["at"], "typing", round(max(0.3, d), 2))
        else:
            seg.c(m["at"], "pop")
    win_h = max(360, my + 30 + 46)
    wy = 280 if s.get("title") else 120
    bottom = wy + win_h + 70 + len(s.get("notes", [])) * 130
    if bottom > 1200:
        seg.w("聊天窗加下方标签到 y=%d，超出版式 B 的内容区（1200）。拆成两段或删消息" % bottom)
    for o in s.get("notes", []):
        seg.c(o["at"], "tiny")
        if text_w(o["text"], 46) + 62 > 840:
            seg.w("标签「%s」太长" % o["text"])
        mark_cue(seg, o, o["at"] + 0.2, box_ok=False)


def scene_topcard(seg, s):
    at = s.get("at", 0.1)
    seg.c(at, "pop")
    phases = s.get("phases") or [s]
    inner = 940 - 88
    for i, ph in enumerate(phases):
        tag = "（第 %d 阶段）" % (i + 1)
        if i > 0:
            if ph.get("start") is None:
                seg.w("第 %d 阶段缺 start" % (i + 1))
                continue
            seg.c(ph["start"], "whoosh")
            seg.times(("阶段 start", ph["start"]))
        y = 30 + (70 if ph.get("label") else 0)
        notes = ph.get("notes", [])
        nw = []
        for n in notes:
            lines, size, ov = fit(n["text"], 300, 64, 40, 1)
            over(seg, "note", n["text"], lines, size, ov, tag)
            nw.append(min(420, max(200, text_w(n["text"], size) + 80)))
            seg.c(n["at"], "pop")
        right = 530 if ph.get("to") else (sum(w + 30 for w in nw) if ph.get("big") and notes else 0)
        row_h = 0
        big = ph.get("big")
        if big:
            lines, size, ov = fit(big["text"], inner - right, 112, 64, 1 if right else 2)
            over(seg, "big", big["text"], lines, size, ov, tag)
            row_h = len(lines) * size * 1.12
            first = at if i == 0 else ph["start"] + 0.2
            if big["at"] - first > 0.3:
                seg.c(big["at"], "pop")
            if big.get("hl"):
                if big["hl"] not in big["text"]:
                    seg.w("hl「%s」不在「%s」里" % (big["hl"], big["text"]))
                seg.c(big.get("hlAt", big["at"] + 0.4), "scribble", 0.5)
            if big.get("strikeAt") is not None:
                seg.c(big["strikeAt"], "scribble", 0.4)
        if ph.get("to"):
            lines, size, ov = fit(ph["to"]["text"], 360, 96, 48, 1)
            over(seg, "to", ph["to"]["text"], lines, size, ov, tag)
            seg.c(ph["to"]["at"], "pop")
            row_h = max(row_h, size * 1.55 - 20)
        if notes:
            row_h = max(row_h, 124)
        y += row_h + (16 if row_h else 0)
        if ph.get("hand"):
            lines, size, ov = fit(ph["hand"]["text"], inner, 80, 48, 2)
            over(seg, "hand", ph["hand"]["text"], lines, size, ov, tag)
            y += len(lines) * size * 1.15 + 6
            seg.c(ph["hand"]["at"], "scribble", round(min(3, max(0.3, ph["hand"]["end"] - ph["hand"]["at"])), 2))
        if y + 34 > 420:
            seg.w("顶部卡片%s高 %d，超过 420 会挡到脸。减少内容或拆阶段" % (tag, y + 34))


# ---------- 新场景（2026-11 扩展）：只用已有的音色 ----------
MARKS = {"tick": ("tick", None), "x": ("scribble", 0.3), "circle": ("scribble", 0.45), "erase": ("erase", 0.6)}


def mark_cue(seg, o, default_at, box_ok=True):
    """条目标记的音效。circle / erase 只有清单（含便签墙）支持。"""
    k = o.get("mark")
    if not k:
        return
    if k not in MARKS:
        seg.w("mark「%s」不认识，可用：%s" % (k, " / ".join(MARKS)))
        return
    if k in ("circle", "erase") and not box_ok:
        seg.w("mark「%s」只在 list 场景（含便签墙）里有效，这里不会显示" % k)
        return
    mt = o.get("markAt", default_at)
    seg.times(("mark", mt))
    seg.c(mt, *([MARKS[k][0]] + ([MARKS[k][1]] if MARKS[k][1] is not None else [])))


EXTRA_POS = {"title", "tr", "tl", "mr", "ml", "bl", "mid"}
DOODLE_KINDS = {"bulb", "question", "exclaim", "star", "fire", "heart", "bolt", "check", "eyes"}


POS_XY = {"tr": (880, 190), "tl": (26, 190), "mr": (962, 660), "ml": (14, 660), "bl": (130, 1080), "mid": (600, 820)}


def crowd(seg, s, what, pos, w):
    """估算图标/印章会不会压到标题或内容（只能估，最后以抽帧为准）。"""
    title_end = None
    if s.get("title"):
        lines, size, _ = fit(s["title"], 880, 84, 56, 1)
        title_end = 120 + text_w(s["title"], size)
    if pos == "title":
        if title_end and title_end + 24 > 1060 - w:
            seg.w("%s 放在标题右边放不下（标题太长），改用 tr 或 bl" % what)
    elif pos == "tr" and title_end and title_end > POS_XY["tr"][0] - (w - 96 if what == "stamp" else 0) - 20:
        seg.w("%s 放在右上（tr）会压到标题，改用 title / bl / ml" % what)
    elif pos in ("ml", "mr", "mid", "bl") and seg.content_bottom and seg.content_bottom > POS_XY[pos][1] - 20:
        seg.w("%s 放在 %s 可能压到内容（内容排到 y≈%d），改到内容下面的位置或抽帧确认" % (what, pos, seg.content_bottom))


def extras(seg, s):
    """所有场景通用的 doodles（手绘小图标）和 stamp（印章）。"""
    ds = s.get("doodles", [])
    if len(ds) > 2:
        seg.w("doodles 有 %d 个，一段最多 1–2 个，多了显得乱" % len(ds))
    for d in ds:
        if d.get("kind") not in DOODLE_KINDS:
            seg.w("doodle kind「%s」不认识，可用：%s" % (d.get("kind"), " ".join(sorted(DOODLE_KINDS))))
        if d.get("x") is None and d.get("pos", "tr") not in EXTRA_POS:
            seg.w("doodle pos「%s」不认识，可用：%s" % (d.get("pos"), " ".join(sorted(EXTRA_POS))))
        if d.get("pos") == "title" and not s.get("title"):
            seg.w("doodle 放在 title 旁边，但这段没有标题")
        elif d.get("x") is None and d.get("pos", "tr") in EXTRA_POS:
            crowd(seg, s, "doodle", d.get("pos", "tr"), d.get("size", 96))
        seg.times(("doodle", d.get("at")))
        seg.c(d.get("at", 0), "tick" if d.get("kind") == "check" else "scribble", None if d.get("kind") == "check" else 0.4)
    st = s.get("stamp")
    if st:
        if not st.get("text"):
            seg.w("stamp 缺 text")
        elif text_w(st["text"], 56) > 360:
            seg.w("stamp「%s」太长，印章最多 4–5 个字" % st["text"])
        if st.get("x") is None and st.get("pos", "tr") not in EXTRA_POS:
            seg.w("stamp pos「%s」不认识" % st.get("pos"))
        elif st.get("x") is None and st.get("text"):
            crowd(seg, s, "stamp", st.get("pos", "tr"), text_w(st["text"], 56) + 70)
        seg.times(("stamp", st.get("at")))
        seg.c(st.get("at", 0), "stamp")


def scene_list_notes(seg, s):
    title(seg, s)
    items = s.get("items", [])
    if not 1 <= len(items) <= 6:
        seg.w("便签墙 %d 张，按 1–6 张设计；多了拆成两段" % len(items))
    rows = max(1, (len(items) + 1) // 2)
    top = 320 if s.get("title") else 170
    nh = min(300, (1190 - top) / rows) - 50
    seg.content_bottom = top + rows * min(300, (1190 - top) / rows)
    for i, o in enumerate(items):
        lines, size, ov = fit(o["text"], 340, min(56, nh * 0.36), 34, 2)
        over(seg, "item", o["text"], lines, size, ov, "（第 %d 张便签）" % (i + 1))
        seg.times(("第 %d 张" % (i + 1), o["at"]))
        seg.c(o["at"], "paper")
        if o.get("out") is not None:
            seg.times(("第 %d 张撕走" % (i + 1), o["out"]))
            if o["out"] <= o["at"]:
                seg.w("第 %d 张的 out 要晚于 at" % (i + 1))
            seg.c(o["out"], "tear")
        mark_cue(seg, o, o["at"] + 0.4)


def scene_compare(seg, s):
    title(seg, s)
    top = 300 if s.get("title") else 170
    col_h = 0
    for side, name in (("left", "左栏"), ("right", "右栏")):
        c = s.get(side)
        if not c:
            seg.w("compare 缺 %s" % side)
            continue
        at = c.get("at", 0.4 if side == "left" else 1.2)
        seg.times((name + " at", at))
        seg.c(at, "pop")
        lines, size, ov = fit(c.get("label", ""), 370, 64, 40, 1)
        over(seg, "label", c.get("label", ""), lines, size, ov, "（%s标题）" % name)
        h = 150
        for o in c.get("items", []):
            lines, size, ov = fit(o["text"], 370, 58, 34, 2)
            over(seg, "item", o["text"], lines, size, ov, "（%s）" % name)
            h += len(lines) * size * 1.22 + 34
            seg.times((name + "条目", o["at"]))
            seg.c(o["at"], "tiny")
        col_h = max(col_h, h + 26)
        mark_cue(seg, c, at + 0.6, box_ok=False)
    if s.get("vs", True) and s.get("right"):
        seg.c(s.get("vsAt", s["right"].get("at", 1.2) + 0.15), "stamp")
    v = s.get("verdict")
    vh = 0
    if v:
        seg.times(("verdict", v["at"]))
        if v.get("side"):
            seg.c(v["at"], "scribble", 0.5)
        if v.get("text"):
            lines, size, ov = fit(v["text"], 760, 84, 48, 1)
            over(seg, "verdict", v["text"], lines, size, ov, "（结论便签）")
            seg.c(v.get("textAt", v["at"] + 0.4), "pop")
            vh = 50 + size * 1.7
    if top + max(col_h, 360) + vh > 1190:
        seg.w("对比两栏加结论高 %d，超出内容区（到 1190）。减少条目或拆成两段" % (top + max(col_h, 360) + vh))


def scene_number(seg, s):
    title(seg, s)
    if s.get("value") is None:
        seg.w("number 场景缺 value")
        return
    top = 300 if s.get("title") else 200
    full = str(s.get("prefix", "")) + str(s["value"])
    lines, size, ov = fit(full, 640, 300, 120, 1)
    over(seg, "value", full, lines, size, ov, "（大数字）")
    at = s.get("at", 0.4)
    seg.times(("at", at))
    seg.c(at, "pop")
    h = size * 1.05
    if s.get("label"):
        lines, ls, ov = fit(s["label"], 860, 64, 40, 1)
        over(seg, "label", s["label"], lines, ls, ov, "（数字说明）")
        h += ls * 1.4 + 40
    if s.get("circleAt") is not None:
        seg.c(s["circleAt"], "scribble", 0.45)
    bars = s.get("bars", [])
    if len(bars) > 4:
        seg.w("横条 %d 根，最多 4 根" % len(bars))
    for b in bars:
        seg.times(("横条", b["at"]))
        seg.c(b["at"], "tiny")
    if bars:
        h += len(bars) * 110 + 30
    if s.get("note"):
        lines, ns, ov = fit(s["note"]["text"], 700, 84, 46, 1)
        over(seg, "note", s["note"]["text"], lines, ns, ov, "（便签）")
        seg.c(s["note"]["at"], "pop")
        h += ns * 1.7 + 40
    if s.get("hand"):
        hand(seg, s["hand"], 860)
        h += 120
    if top + h > 1190:
        seg.w("数字场景内容高 %d，超出内容区（到 1190）。去掉横条或便签" % (top + h))


def scene_shot(seg, s):
    title(seg, s)
    if not s.get("image"):
        seg.w("shot 场景缺 image（push_asset 返回的图片 assetId）")
    if not s.get("ratio"):
        seg.w("shot 场景没给 ratio（图宽/图高），按 0.75 排版，竖长截图会被压扁裁切")
    at = s.get("at", 0.3)
    seg.c(at, "paper")
    for i, m in enumerate(s.get("marks", [])):
        for k in ("x", "y", "w", "h"):
            if k in m and not 0 <= m[k] <= 1:
                seg.w("第 %d 个标注的 %s=%s 不在 0–1（是图内比例，不是像素）" % (i + 1, k, m[k]))
        seg.times(("标注", m["at"]))
        seg.c(m["at"], "scribble", {"circle": 0.45, "box": 0.4, "hl": 0.5, "arrow": 0.4}.get(m.get("kind", "circle"), 0.4))
    z = s.get("zoom")
    if z:
        seg.times(("zoom", z["at"]))
        seg.c(z["at"], "whoosh")
    c = s.get("caption")
    if c:
        lines, size, ov = fit(c["text"], 840, 76, 46, 1)
        over(seg, "caption", c["text"], lines, size, ov, "（图下手写）")
        seg.c(c["at"], "scribble", round(min(1.2, len(c["text"]) * 0.08), 2))


def scene_quote(seg, s):
    if not s.get("text"):
        seg.w("quote 场景缺 text")
        return
    lines, size, ov = fit(s["text"], 800, 120, 64, 2)
    over(seg, "text", s["text"], lines, size, ov, "（金句）")
    at = s.get("at", 0.3)
    wd = s.get("writeDur", min(1.6, len(s["text"]) * 0.07))
    seg.c(max(0, at - 0.2), "pop")
    seg.c(at, "scribble", round(max(0.3, min(3, wd)), 2))
    if s.get("hl"):
        if s["hl"] not in s["text"]:
            seg.w("hl「%s」不在金句里" % s["hl"])
        seg.c(s.get("hlAt", at + wd + 0.3), "scribble", 0.5)
    if s.get("wavyAt") is not None:
        seg.c(s["wavyAt"], "scribble", 0.4)
    if s.get("by"):
        seg.c(s.get("byAt", at + wd + 0.6), "scribble", 0.8)


def scene_mindmap(seg, s):
    c = s.get("center")
    if not c:
        seg.w("mindmap 缺 center")
        return
    lines, size, ov = fit(c["text"], 380, 84, 48, 2)
    over(seg, "center", c["text"], lines, size, ov, "（中心词）")
    seg.c(c.get("at", 0.3), "pop")
    nodes = s.get("nodes", [])
    if not 2 <= len(nodes) <= 6:
        seg.w("分支 %d 个，按 2–6 个设计" % len(nodes))
    for n in nodes:
        lines, size, ov = fit(n["text"], 280, 52, 32, 2)
        over(seg, "node", n["text"], lines, size, ov, "（分支）")
        seg.times(("分支", n["at"]))
        seg.c(n["at"], "tiny")
    h = s.get("hand")
    if h:
        # 思维导图的手写句在左下 y=1110，只放一行（下面就是字幕区）
        lines, size, ov = fit(h["text"], 440, 64, 40, 1)
        over(seg, "hand", h["text"], lines, size, ov, "（手写，只能一行）")
        seg.times(("手写 at", h["at"]), ("手写 end", h["end"]))
        seg.c(h["at"], "scribble", round(min(3, max(0.3, h["end"] - h["at"])), 2))
        if len(nodes) >= 6:
            seg.w("6 个分支时第 6 个分支和左下手写句会挤在一起，去掉 hand 或减到 5 个分支")


def scene_comment(seg, s):
    title(seg, s)
    y = 300 if s.get("title") else 170
    for c in s.get("comments", []):
        lines = wrap(c["text"], 700, 44)
        y += 100 + len(lines) * 44 * 1.35 + 30 + 30
        seg.times(("评论", c["at"]))
        seg.c(c["at"], "pop")
    r = s.get("reply")
    if r:
        lines = wrap(r["text"], 640, 44)
        y += 10 + 90 + len(lines) * 44 * 1.35 + 26 + 30
        seg.times(("回复", r["at"]))
        if r.get("typing"):
            seg.c(r["at"], "typing", round(max(0.3, r.get("typeDur", min(2.2, len(r["text"]) * 0.08))), 2))
        else:
            seg.c(r["at"], "pop")
    if y > 1200:
        seg.w("评论卡片排到 y=%d，超出内容区（1200）。删一条评论或缩短文字" % y)
    hand(seg, s.get("hand"), 820)


def scene_outro(seg, s):
    if not s.get("text"):
        seg.w("outro 场景缺 text")
        return
    lines, size, ov = fit(s["text"], 840, 140, 72, 2)
    over(seg, "text", s["text"], lines, size, ov, "（结尾大字）")
    seg.c(s.get("at", 0.3), "pop")
    sub = s.get("sub")
    if sub:
        d = min(1.2, len(sub["text"]) * 0.09)
        seg.c(sub["at"], "scribble", round(max(0.3, d), 2))
        seg.c(sub.get("end", sub["at"] + d) + 0.1, "scribble", 0.4)
        if text_w(sub["text"], 72) > 840:
            seg.w("sub「%s」太长，一行放不下" % sub["text"])
    for ic in s.get("icons", []):
        seg.times(("图标", ic["at"]))
        seg.c(ic["at"], "tiny")


SCENES = {"list": scene_list, "strike": scene_strike, "step": scene_step, "chat": scene_chat, "topcard": scene_topcard,
          "compare": scene_compare, "number": scene_number, "shot": scene_shot, "quote": scene_quote,
          "mindmap": scene_mindmap, "comment": scene_comment, "outro": scene_outro}


BOARD_HEAD = "// 由 scene_cues.py 生成（theme.jsx 的 camera 是 \"board\"），重跑会覆盖，不要手改。\n"


def write_board(segs, fps):
    """整板运镜：写 board_data.jsx（每个全屏动效窗口的位置和内容），并给每个窗口写一个 cam_*.jsx。
    时间线 V1 上放的是 cam_*.jsx，段落文件本身只用来写 SPEC 和检查。"""
    wins = [g for g in segs if g.layout == "B"]
    if not wins:
        print("整板运镜：没有全屏动效段落，跳过")
        return
    files = [g for g in wins if not g.overview]
    out_dir = os.path.dirname(os.path.abspath(files[0].path if files else segs[0].path))
    if not os.path.exists(os.path.join(out_dir, "board.jsx")):
        print("⚠ 整板运镜：%s 下没有 board.jsx，从 Skill 的 assets/whiteboard-mg/ 复制过来" % out_dir)
    imports, rows, made, listing = [], [], [], []
    for i, g in enumerate(wins):
        gid = "overview" if g.overview else g.name
        row = '  { id: "%s", start: %d, dur: %d' % (gid, g.start, g.dur_f)
        if g.overview:
            row += ", overview: true"
        else:
            rel = os.path.relpath(os.path.abspath(g.path), out_dir).replace(os.sep, "/")
            imports.append('import S%d from "./%s";' % (i, rel))
            row += ", C: S%d" % i
            src = open(g.path, encoding="utf-8").read()
            if not g.spec and "useCurrentFrame" in src:
                g.w("手写段落直接用了 useCurrentFrame：上白板后时间对不上，改用 lib.jsx 的 useT()")
            if not g.spec and "export default" not in src:
                g.w("手写段落没有 export default，上不了白板")
        rows.append(row + " },")
        stem = "cam_" + re.sub(r"\.jsx$", "", gid) + ".jsx"
        cam = os.path.join(out_dir, stem)
        body = (BOARD_HEAD + 'import React from "react";\nimport { useVideoConfig } from "remotion";\nimport { Board } from "./board.jsx";\n\n'
                'export default function Cam() {\n  useVideoConfig();\n  return <Board id="%s" />;\n}\n' % gid)
        old = open(cam, encoding="utf-8").read() if os.path.exists(cam) else None
        if old is None:
            made.append(stem)
        if old != body:
            open(cam, "w", encoding="utf-8").write(body)
        listing.append("    %-24s @%5d +%4d%s" % (stem, g.start, g.dur_f, "  ← 这次新生成：push_asset 后放到 V1" if stem in made else ""))
    data = BOARD_HEAD + "\n".join(imports) + "\n\nexport const BOARD = [\n" + "\n".join(rows) + "\n];\n"
    open(os.path.join(out_dir, "board_data.jsx"), "w", encoding="utf-8").write(data)
    head = ["整板运镜：白板上 %d 格 + %d 段总览 → %s/board_data.jsx" % (len(files), len(wins) - len(files), out_dir),
            "    时间线 V1 上放这些 cam_*.jsx（不是段落文件本身）。push_asset 一次即可，改段落、重跑都会自动更新："]
    if len(files) > 9:
        listing.append("    · 提示：白板上有 %d 格，总览时每格很小，总览更适合放在讲到一半做小结的地方" % len(files))
    return head + listing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("segments", nargs="+")
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--total-frames", type=int)
    ap.add_argument("--voice-median", type=float, default=-30.4)
    ap.add_argument("--extra", help="手写动效的 cues（sfx_bed.py 的 groups 格式 JSON）")
    ap.add_argument("-o", "--out", default="cues.json")
    ap.add_argument("--theme", help="theme.jsx 路径；不给就找第一个段落文件旁边的 theme.jsx")
    ap.add_argument("--words", help="timeline_words.py 的输出；SPEC 里有 say 时用它自动定时并写回段落文件")
    ap.add_argument("--camera", choices=["page", "board"], help="覆盖 theme.jsx 的 camera：page 每段一页 | board 整片一块白板")
    a = ap.parse_args()
    segs = sorted((Seg(s, a.fps) for s in a.segments), key=lambda g: g.start)
    theme, theme_src = {}, None
    first = next((g.path for g in segs if not g.overview), segs[0].path)
    tp = a.theme or os.path.join(os.path.dirname(os.path.abspath(first)), "theme.jsx")
    if os.path.exists(tp):
        theme_src = open(tp, encoding="utf-8").read()
        for k in ("sound", "seed"):
            m = re.search(r"\b%s\s*:\s*\"([^\"]*)\"" % k, theme_src)
            if m:
                theme[k] = m.group(1)
    m = re.search(r"\bcamera\s*:\s*\"([^\"]*)\"", theme_src or "")
    board = (a.camera or (m.group(1) if m else "page")) == "board"
    if any(g.overview for g in segs) and not board:
        sys.exit("overview@… 只在整板运镜（theme.jsx 的 camera: \"board\" 或 --camera board）时可用")
    words = Words(a.words) if a.words else None
    for g in segs:
        g.say_log = []
        if g.spec and has_say(g.spec):
            if not words:
                g.w("SPEC 里有 say，但没给 --words tl_words.json，时间没有更新")
            elif resolve_say(g, words, g.say_log):
                write_spec(g)
        if g.spec:
            lint_spec(g, g.spec)
            order_check(g, g.spec)
            fn = SCENES.get(g.spec.get("scene"))
            if fn:
                try:
                    fn(g, g.spec)
                    extras(g, g.spec)
                except (KeyError, TypeError) as e:
                    g.w("SPEC 缺少必填字段 %s（say 没找到时也会缺 at），补上后重跑；这段的音效没有生成" % e)
    # 版式切换处的嗖声：全屏动效段落的入口和出口，前后不是紧接的全屏动效时
    for i, g in enumerate(segs):
        if g.layout != "B":
            continue
        if not any(h.layout == "B" and abs(h.start + h.dur_f - g.start) <= 1 for h in segs if h is not g):
            g.c(-0.22, "whoosh")
        if not any(h.layout == "B" and abs(g.start + g.dur_f - h.start) <= 1 for h in segs if h is not g):
            g.c(g.dur - 0.22, "whoosh")
        if board and any(h.layout == "B" and abs(h.start + h.dur_f - g.start) <= 1 for h in segs if h is not g):
            g.c(-0.12, "whoosh")  # 整板运镜：紧接着的两段之间镜头在板上平移
    board_listing = write_board(segs, a.fps) if board else None
    groups = []
    bad = 0
    rank = {"stamp": 4, "pop": 3, "whoosh": 3, "paper": 3, "tick": 2, "tiny": 1}
    for g in segs:
        g.cues.sort(key=lambda c: c[0])
        kept = []  # 同一时刻（相差 < 0.08 s）的两个点击类音效只留较响的
        for c in g.cues:
            if kept and c[0] - kept[-1][0] < 0.08 and c[1] in rank and kept[-1][1] in rank:
                if rank[c[1]] > rank[kept[-1][1]]:
                    kept[-1] = c
                continue
            kept.append(c)
        g.cues = kept
        groups.append({"name": g.name, "startFrame": g.start, "cues": g.cues})
        print("%-22s @%5d +%4d  %s  %d 个音效" % (g.name, g.start, g.dur_f, g.layout, len(g.cues)) + ("" if g.spec else "（总览）" if g.overview else "（手写，音效见 --extra）"))
        if g.say_log:
            print("    say 定时（已写回 %s）：" % g.name)
            for line in g.say_log:
                print(line)
        print("    " + "  ".join("%.2f %s%s" % (c[0], c[1], " %s" % c[2] if len(c) > 2 else "") for c in g.cues))
        for w in g.warn:
            if not w.startswith("提示"):
                bad += 1
            print("    ⚠ " + w if not w.startswith("提示") else "    · " + w)
    rot = rotation(segs, a.fps)
    if rot:
        print("整片轮换规则：")
        for w in rot:
            print("    · " + w if w.startswith("提示") else "    ⚠ " + w)
        bad += sum(1 for w in rot if not w.startswith("提示"))
    if a.extra:
        groups += json.load(open(a.extra, encoding="utf-8")).get("groups", [])
    total = a.total_frames or max(g.start + g.dur_f for g in segs)
    if board_listing:
        print("\n".join(board_listing))
    if theme_src is not None:
        print("风格包 %s：sound=%s seed=%s camera=%s" % (tp, theme.get("sound", "marker（默认）"), theme.get("seed", "（无）"), "board 整板运镜" if board else "page 每段一页"))
    else:
        print("· 没找到 theme.jsx（%s），sound 用默认 marker" % tp)
    json.dump({"fps": a.fps, "totalFrames": total, "voiceMedian": a.voice_median, **theme, "groups": groups},
              open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("写入 %s：%d 组，%d 个音效；%d 条需要处理的检查结果" % (a.out, len(groups), sum(len(g["cues"]) for g in groups), bad))


if __name__ == "__main__":
    main()
