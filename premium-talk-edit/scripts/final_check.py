#!/usr/bin/env python3
"""交付前的验收单：成片的声音 + ChatCut 时间线的结构，逐项给出 ✅ / ⚠ / ❌。

用法: final_check.py <成片.mp4> --project <projectPath> [--timeline ID] [--cues cues.json [--bed bed.wav]] [--fps 30]

  projectPath: read_project 返回的 projectHome.projectPath。
  --cues: gk_cues.py 的输出。给了就核对每段的版式（上卡下人人物是否下移、全屏讲解是否有圆窗）；再给 --bed 就核对每种音效相对人声多响。
有任何 ❌ 就是「未通过」（退出码 1）：先修，修完重新导出、重跑，直到通过。
⚠ 是可能有问题，要看一眼并在交付时告诉用户。把整张表原样贴给用户。
"""
import argparse, glob, json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from measure_mix import load, db, rms50, SR  # noqa: E402
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

rows = []


def add(level, item, detail):
    rows.append((level, item, detail))


def audio_checks(x, tl_sec, a):
    n, win = len(x), SR // 20
    dur = n / SR
    if tl_sec:
        d = dur - tl_sec
        add("✅" if abs(d) <= 0.2 else "⚠" if abs(d) <= 1 else "❌", "成片时长", "%.2f s，时间线 %.2f s（差 %+.2f s）" % (dur, tl_sec, d))
    else:
        add("✅", "成片时长", "%.2f s" % dur)
    pk = db(max(abs(v) for v in x) / 32768)
    clip = sum(1 for v in x if abs(v) >= 32767)
    add("❌" if clip > 50 else "⚠" if clip or pk > -1 else "✅", "峰值 / 爆音", "峰值 %.1f dBFS，削波采样 %d%s" % (pk, clip, "（有爆音，降音效或人声）" if clip > 50 else ""))
    env = [db(math.sqrt(sum(v * v for v in x[i:i + win]) / win) / 32768) for i in range(0, n - win, win)]
    act = sorted(d for d in env if d > -45)
    vm = act[len(act) // 2] if act else -99
    add("✅" if -32 <= vm <= -20 else "⚠", "人声响度", "语音段中位数 %.1f dBFS%s" % (vm, "" if -32 <= vm <= -20 else "（正常范围约 −32 至 −20，手机外放会偏小或偏大）"))
    head = next((i for i, d in enumerate(env) if d > -40), len(env)) * 0.05
    tail = next((i for i, d in enumerate(reversed(env)) if d > -40), len(env)) * 0.05
    add("✅" if head <= 0.5 and tail <= 1.2 else "⚠", "首尾空白", "开头 %.2f s、结尾 %.2f s 没声音%s" % (head, tail, "" if head <= 0.5 and tail <= 1.2 else "（开头超过 0.5 s 会让人划走）"))
    if a.cues and a.bed:
        # 各音色相对人声的目标（dB），与 assets/sfx-pool/pool.json 的 rules.rel_db 一致；按键按峰值定，不在这里查
        OFFSETS = {"whoosh": -1, "pop": 4, "tick": 3, "hit": 6, "swipe": -2, "ok": 3, "no": 3}
        bed = load(a.bed)
        m = min(n, len(bed))
        num = sum(x[i] * bed[i] for i in range(m) if bed[i])
        den = sum(bed[i] * bed[i] for i in range(m) if bed[i])
        if not den:
            add("❌", "音效", "bed.wav 是空的")
            return
        gain = db(abs(num / den))
        if gain < -20:
            add("❌", "音效", "成片里几乎听不到音效轨（估算增益 %.0f dB）：音效没放上去，或轨道被静音" % gain)
            return
        cfg = json.load(open(a.cues, encoding="utf-8"))
        cues = sorted((g["startFrame"] / cfg["fps"] + c[0], c[1]) for g in cfg["groups"] for c in g["cues"])
        by = {}
        for i, (t, kind) in enumerate(cues):
            nxt = cues[i + 1][0] if i + 1 < len(cues) else t + 1
            i0 = int(t * SR)
            by.setdefault(kind, []).append(db(rms50(bed, i0, i0 + int(SR * min(0.6, max(0.1, nxt - t))))) + gain)
        off = {**OFFSETS, **cfg.get("offsets", {})}
        far, loud = [], []
        for k, v in sorted(by.items()):
            rel = sorted(v)[len(v) // 2] - vm
            if k in off and abs(rel - off[k]) > 4:
                far.append("%s %+.0f（目标 %+d）" % (k, rel, off[k]))
            if rel > 9:
                loud.append(k)
        lvl = "❌" if loud else "⚠" if far else "✅"
        add(lvl, "音效响度", "音效轨增益 %+.1f dB；%s%s" % (gain, "各音色都在目标 ±4 dB 内" if not far else "偏离目标：" + "，".join(far),
                                                          "；%s 比人声响 9 dB 以上，会盖住说话" % "、".join(loud) if loud else ""))


def timeline_checks(a):
    files = glob.glob(os.path.join(a.project, "timelines", "*.json"))
    if a.timeline:
        files = [f for f in files if os.path.basename(f).startswith(a.timeline)]
    if not files:
        add("⚠", "时间线", "没读到 %s/timelines/*.json（projectPath 不对，或 ChatCut 改了存放结构），跳过时间线检查，改用 preview_timeline 抽帧人工核对" % a.project)
        return None
    tl = json.load(open(max(files, key=os.path.getmtime), encoding="utf-8"))
    try:
        tracks = {t["id"]: t for t in tl["tracks"]}
        vids = [v for v in tl["videoItems"] if v.get("sourceIn") is not None]
        if not vids:
            add("❌", "人物画面", "时间线上没有人物视频")
            return tl["durationFrames"] / a.fps
        cnt = {}
        for v in vids:
            cnt[(v["trackId"], v["assetId"])] = cnt.get((v["trackId"], v["assetId"]), 0) + 1
        ptrack, passet = max(cnt, key=cnt.get)
        person = sorted([v for v in vids if v["trackId"] == ptrack and v["assetId"] == passet], key=lambda v: v["startFrame"])
        end = max(v["startFrame"] + v["durationFrames"] for v in person)
        fps = a.fps

        # 1 人物连续
        gaps, pos = [], 0
        for v in person:
            if v["startFrame"] > pos + 1:
                gaps.append("%.2f–%.2f s" % (pos / fps, v["startFrame"] / fps))
            pos = max(pos, v["startFrame"] + v["durationFrames"])
        add("❌" if gaps else "✅", "人物画面连续", "有 %d 处空档：%s（会黑屏或只剩动效）" % (len(gaps), "，".join(gaps[:5])) if gaps else "%d 段，0–%.2f s 没有空档" % (len(person), end / fps))

        # 2 人声和画面对齐
        auds = [x for x in tl["audioItems"] if x["assetId"] == passet]
        if not auds:
            add("⚠", "人声对齐", "没找到人物素材的音频片段（声音可能是别的素材，或被删了）")
        else:
            key = lambda x: (x["startFrame"], x["durationFrames"], round(x.get("sourceIn", 0) / 1000))
            ak = {key(x) for x in auds}
            bad = [v for v in person if key(v) not in ak and not any(abs(v["startFrame"] - x["startFrame"]) <= 1 and abs(v["durationFrames"] - x["durationFrames"]) <= 1
                                                                       and abs(v.get("sourceIn", 0) - x.get("sourceIn", 0)) <= 34000 for x in auds)]
            add("❌" if bad else "✅", "人声对齐", "%d 段画面找不到对得上的声音（切分或挪动时没带上联动音频），第一处在 %.2f s" % (len(bad), bad[0]["startFrame"] / fps) if bad else "%d 段画面都有对应的声音" % len(person))

        # 3 版式：A 人物全屏；B 上卡下人（人物下移）；C 全屏讲解（人物在左下圆窗里）。需要 --cues（gk_cues.py 的输出，带每段版式）
        order = tracks[ptrack]["order"]
        mg = tl.get("motionGraphicItems", [])
        above = [m for m in mg if tracks[m["trackId"]]["order"] > order]

        def y_at(v, f):  # 人物片段在时间线第 f 帧的纵向偏移（按关键帧线性插值，不算缓动）
            pts = sorted((((v.get("animation") or {}).get("tracks") or {}).get("transform.y") or {}).get("points") or [], key=lambda p: p["time"])
            if not pts:
                return 0.0
            t = (f - v["startFrame"]) / fps * 1e6
            if t <= pts[0]["time"]:
                return pts[0]["value"]
            for p, q in zip(pts, pts[1:]):
                if t <= q["time"]:
                    return p["value"] + (q["value"] - p["value"]) * (t - p["time"]) / max(1, q["time"] - p["time"])
            return pts[-1]["value"]

        small = [v for v in vids if v["assetId"] == passet and v["trackId"] != ptrack and v["transform"]["width"] < 1080 * 0.6]
        if a.cues:
            groups = [g for g in json.load(open(a.cues, encoding="utf-8"))["groups"] if g.get("layout")]
            cfps = json.load(open(a.cues, encoding="utf-8")).get("fps", fps)
            badB, badA, noCircle, noCard = [], [], [], []
            for g in groups:
                f0 = round(g["startFrame"] * fps / cfps)
                n = g.get("frames") or 0
                mid = f0 + n // 2
                cov = lambda items: sum(max(0, min(f0 + n, m["startFrame"] + m["durationFrames"]) - max(f0, m["startFrame"])) for m in items)
                if n and cov(above) < 0.9 * n:
                    noCard.append("%.2f s" % (f0 / fps))
                cover = [v for v in person if v["startFrame"] <= mid < v["startFrame"] + v["durationFrames"]]
                if not cover:
                    continue
                y = y_at(cover[0], mid)
                if g["layout"] == "B" and y < 150:
                    badB.append("%.2f s" % (f0 / fps))
                if g["layout"] == "A" and y > 20:
                    badA.append("%.2f s" % (f0 / fps))
                if g["layout"] == "C" and g.get("circle") and n and cov(small) < 0.9 * n:
                    noCircle.append("%.2f s" % (f0 / fps))
            nB = sum(1 for g in groups if g["layout"] == "B")
            nC = sum(1 for g in groups if g["layout"] == "C" and g.get("circle"))
            add("❌" if badB else "✅", "上卡下人时人物下移", "%d 处人物没有下移（卡片会盖住脸）：%s" % (len(badB), "，".join(badB[:5])) if badB else "%d 段上卡下人，人物都下移了" % nB)
            add("❌" if badA else "✅", "人物全屏时没有偏移", "%d 处人物还停在下移位置：%s" % (len(badA), "，".join(badA[:5])) if badA else "A 版式段人物都在原位")
            add("❌" if noCircle else "✅", "全屏讲解有人物圆窗", "%d 段全屏讲解里没有人物圆窗（gk_layout.py 的 circle 片段漏放）：%s" % (len(noCircle), "，".join(noCircle[:5])) if noCircle else "%d 段全屏讲解都有圆窗" % nC)
            add("⚠" if noCard else "✅", "每段都有卡片", "%d 段上方没有动效叠层：%s" % (len(noCard), "，".join(noCard[:5])) if noCard else "每段上方都有动效")
        else:
            add("⚠", "版式", "没给 --cues，跳过上卡下人 / 圆窗核对，改用 preview_timeline 抽帧看")
        # 同一时刻不能有两条人声（圆窗人物片段的联动音频要静音）
        loud = sorted([x for x in tl["audioItems"] if x["assetId"] == passet and (x.get("volume") or {}).get("level", 0) > -40], key=lambda x: x["startFrame"])
        dbl = [x for x, y in zip(loud, loud[1:]) if y["startFrame"] < x["startFrame"] + x["durationFrames"] - 1]
        add("❌" if dbl else "✅", "没有重叠的人声", "%d 处两条人声叠在一起（圆窗人物片段的联动音频没静音？）：%.2f s" % (len(dbl), dbl[0]["startFrame"] / fps) if dbl else "没有")

        # 碎片段：批量改位置、关键帧时，人物片段可能被切成很多小段
        tiny = [v for v in person if v["durationFrames"] < 6]
        add("⚠" if tiny else "✅", "人物片段没有碎块", "%d 段短于 0.2 s，可能是批量改动把片段切碎了，第一处在 %.2f s；对照 cut.json 的段数核对，碎得多就把人物轨整条删掉按 adds.json 重铺" % (len(tiny), tiny[0]["startFrame"] / fps) if tiny else "%d 段，都不短于 0.2 s" % len(person))

        # 5 超出、重叠
        over = [m for m in mg if m["startFrame"] + m["durationFrames"] > end + 1]
        add("⚠" if over else "✅", "动效不超出成片", "%d 段动效超出人物结尾 %.2f s（片尾会多出只有动效的画面）" % (len(over), end / fps) if over else "都在 %.2f s 以内" % (end / fps))
        clash = []
        allitems = tl["videoItems"] + tl["audioItems"] + mg
        bytrack = {}
        for it in allitems:
            bytrack.setdefault(it["trackId"], []).append(it)
        for tid, its in bytrack.items():
            its.sort(key=lambda x: x["startFrame"])
            for p, q in zip(its, its[1:]):
                if q["startFrame"] < p["startFrame"] + p["durationFrames"] - 1:
                    clash.append("%.2f s" % (q["startFrame"] / fps))
        add("❌" if clash else "✅", "同一轨没有重叠", "%d 处片段叠在一起：%s" % (len(clash), "，".join(clash[:5])) if clash else "没有")

        # 6 音效轨、字幕
        other_audio = [x for x in tl["audioItems"] if x["assetId"] != passet]
        add("✅" if other_audio else "⚠", "音效轨", "已放 %d 段" % len(other_audio) if other_audio else "时间线上没有音效（gk_bed.py 生成的 WAV 没放到音频轨？）")
        cap = (tl.get("captionSettings") or {}).get("enabled")
        add("✅" if cap else "❌", "字幕", "已开启" if cap else "字幕没开启（edit_captions action:\"enable\"）")
        return tl["durationFrames"] / fps
    except (KeyError, TypeError) as e:
        add("⚠", "时间线", "时间线文件结构和预期不同（%s），跳过时间线检查，改用 preview_timeline 抽帧人工核对" % e)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("--project")
    ap.add_argument("--timeline")
    ap.add_argument("--cues")
    ap.add_argument("--bed")
    ap.add_argument("--fps", type=float, default=30)
    a = ap.parse_args()
    if not os.path.exists(a.media):
        sys.exit("找不到成片：%s（export 的 outputPath，以 track_progress 返回的为准）" % a.media)
    tl_sec = timeline_checks(a) if a.project else None
    if not a.project:
        add("⚠", "时间线", "没给 --project，没检查时间线结构")
    audio_checks(load(a.media), tl_sec, a)
    order = {"❌": 0, "⚠": 1, "✅": 2}
    fail = sum(1 for r in rows if r[0] == "❌")
    warn = sum(1 for r in rows if r[0] == "⚠")
    print("| | 检查项 | 结果 |\n|---|---|---|")
    for lvl, item, detail in sorted(rows, key=lambda r: order[r[0]]):
        print("| %s | %s | %s |" % (lvl, item, detail))
    print("\n验收：%s（❌ %d 项，⚠ %d 项）" % ("未通过" if fail else "通过", fail, warn))
    if fail:
        print("有 ❌ 不能交付：先修好，重新导出，再跑一次。")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
