#!/usr/bin/env python3
"""交付前的验收单：成片的声音 + ChatCut 时间线的结构，逐项给出 ✅ / ⚠ / ❌。

用法: final_check.py <成片.mp4> --project <projectPath> [--timeline ID] [--cues cues.json --bed bed.wav] [--fps 30]

  projectPath: read_project 返回的 projectHome.projectPath。
  --cues/--bed: 给了就同时核对每种音效在成片里相对人声多响。
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
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from sfx_bed import OFFSETS  # noqa: E402
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

        # 3 全屏动效段人物在圆圈里；4 相框
        order = tracks[ptrack]["order"]
        mg = tl.get("motionGraphicItems", [])
        below = [m for m in mg if tracks[m["trackId"]]["order"] < order]
        above = [m for m in mg if tracks[m["trackId"]]["order"] > order]
        full, noring = [], []
        for m in below:
            s0, s1 = m["startFrame"], m["startFrame"] + m["durationFrames"]
            for v in person:
                ov = min(s1, v["startFrame"] + v["durationFrames"]) - max(s0, v["startFrame"])
                if ov > 3 and v["transform"]["width"] >= 1080 * 0.6:
                    full.append("%.2f s" % (max(s0, v["startFrame"]) / fps))
            cov = sum(max(0, min(s1, r["startFrame"] + r["durationFrames"]) - max(s0, r["startFrame"])) for r in above)
            if cov < 0.9 * (s1 - s0):
                noring.append("%.2f s" % (s0 / fps))
        add("❌" if full else "✅", "全屏动效时人物缩进圆圈", "%d 处人物还是全屏，会挡住动效：%s" % (len(full), "，".join(full[:5])) if full else "%d 段全屏动效，人物都在圆圈里" % len(below))
        if below:
            add("⚠" if noring else "✅", "圆圈相框", "%d 段全屏动效上方没有叠层（相框 ring.jsx 可能漏放）：%s" % (len(noring), "，".join(noring[:5])) if noring else "每段全屏动效上方都有叠层")
        # 人物缩在圆圈里时，底下必须有全屏动效（漏推、漏放一段就会只剩圆圈和空底）
        empty = []
        for v in person:
            if v["transform"]["width"] >= 1080 * 0.6:
                continue
            s0, s1 = v["startFrame"], v["startFrame"] + v["durationFrames"]
            hit = sorted((max(s0, m["startFrame"]), min(s1, m["startFrame"] + m["durationFrames"])) for m in below)
            pos, miss = s0, []
            for a0, a1 in hit:
                if a1 <= a0:
                    continue
                if a0 > pos:
                    miss.append((pos, a0))
                pos = max(pos, a1)
            if s1 > pos:
                miss.append((pos, s1))
            empty += ["%.2f–%.2f s" % (x0 / fps, x1 / fps) for x0, x1 in miss if x1 - x0 > 6]
        add("❌" if empty else "✅", "圆圈下面有动效", "%d 处人物在圆圈里、底下却没有全屏动效（动效漏放或没推上去）：%s" % (len(empty), "，".join(empty[:5])) if empty else "人物在圆圈里的地方都有全屏动效")

        # 碎片段：批量改位置、关键帧时，人物片段可能被切成很多小段
        tiny = [v for v in person if v["durationFrames"] < 6]
        add("⚠" if tiny else "✅", "人物片段没有碎块", "%d 段短于 0.2 s，可能是批量改动把片段切碎了，第一处在 %.2f s；对照 cut.json 的段数核对，碎得多就整条 V2 删掉按 adds.json 重铺" % (len(tiny), tiny[0]["startFrame"] / fps) if tiny else "%d 段，都不短于 0.2 s" % len(person))

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
        add("✅" if other_audio else "⚠", "音效轨", "已放 %d 段" % len(other_audio) if other_audio else "时间线上没有音效（sfx_bed.py 生成的 WAV 没放到 A1？）")
        cap = (tl.get("captionSettings") or {}).get("enabled")
        add("✅" if cap else "❌", "字幕", "已开启" if cap else "字幕没开启（edit_captions action:\"enable\"）")
        # 字幕位置：y≈1440 以下是抖音/小红书的博主 ID 和标题区，字幕不能落进去（定稿位置 top 1200、高 90）
        boxes = []
        def _find(o, path=""):
            if isinstance(o, dict):
                if "caption" in path.lower() and isinstance(o.get("top"), (int, float)):
                    boxes.append((o["top"], o.get("height") or 0))
                for k, v in o.items():
                    _find(v, path + "/" + str(k))
            elif isinstance(o, list):
                for v in o:
                    _find(v, path)
        _find(tl)
        if cap and boxes:
            low = max(t + h for t, h in boxes)
            add("❌" if low > 1440 else "✅", "字幕位置", "字幕下沿 y=%d，落进了平台 ID/标题区（y>1440）。update_track 把 layout.top 设回 1200" % low if low > 1440 else "字幕下沿 y=%d，避开了底部 ID/标题区" % low)
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
