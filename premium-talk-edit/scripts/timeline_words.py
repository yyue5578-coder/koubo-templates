#!/usr/bin/env python3
"""把逐词转写（源素材时间）换算成「成片时间线上的时间」，给 gk_cues.py 的 say 定时用。

用法: timeline_words.py <projectPath> --words words.json [--asset ID] [--timeline ID] [--fps 30] [-o tl_words.json]

  projectPath: read_project 返回的 projectHome.projectPath（里面有 project.json 和 timelines/）。
  words.json:  words_from_raw.py 的输出（源素材里的逐词时间，毫秒）。
  --asset:     人物素材的 assetId（或前缀）。不给就用时间线上片段最多的那个视频素材。
  --timeline:  时间线 id（preview_timeline 返回第一行里那串）。不给就用最近改过的那条。
直接读当前时间线，所以粗剪之后又切分、挪动、删掉片段都没关系，重跑一次就是最新的。
输出: [{"t": 秒, "end": 秒, "text": "字"}]，按时间排好；被剪掉的词不在里面。
"""
import argparse, glob, json, os, sys
from collections import Counter
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load_timeline(project, tid=None):
    files = glob.glob(os.path.join(project, "timelines", "*.json"))
    if not files:
        sys.exit("在 %s 下没找到 timelines/*.json。projectPath 要用 read_project 返回的 projectHome.projectPath；"
                 "如果路径没错，可能是 ChatCut 改了存放结构，这一步跳过，改用秒数写 at。" % project)
    if tid:
        files = [f for f in files if os.path.basename(f).startswith(tid)]
        if not files:
            sys.exit("没有 id 以 %s 开头的时间线" % tid)
    path = max(files, key=os.path.getmtime)
    return json.load(open(path, encoding="utf-8")), path


def person_items(tl, asset=None):
    vids = [v for v in tl.get("videoItems", []) if v.get("sourceIn") is not None]
    if not vids:
        sys.exit("时间线上没有视频片段（人物还没铺上去？）")
    if asset:
        vids = [v for v in vids if v["assetId"].startswith(asset)]
        if not vids:
            sys.exit("时间线上没有素材 %s 的片段" % asset)
    else:
        top = Counter(v["assetId"] for v in vids).most_common(1)[0][0]
        vids = [v for v in vids if v["assetId"] == top]
    return sorted(vids, key=lambda v: v["startFrame"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--words", required=True)
    ap.add_argument("--asset")
    ap.add_argument("--timeline")
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("-o", "--out", default="tl_words.json")
    a = ap.parse_args()
    tl, path = load_timeline(a.project, a.timeline)
    items = person_items(tl, a.asset)
    W = [w for w in json.load(open(a.words, encoding="utf-8")) if "silent" not in w.get("text", "") and w.get("text", "").strip()]
    out = []
    for w in W:
        s, e = w["start"] / 1000, w["end"] / 1000
        mid = (s + e) / 2
        for v in items:
            src0 = v["sourceIn"] / 1e6
            src1 = src0 + v["durationFrames"] / a.fps
            if src0 <= mid < src1:
                t0 = v["startFrame"] / a.fps
                out.append({"t": round(t0 + max(s, src0) - src0, 3), "end": round(t0 + min(e, src1) - src0, 3), "text": w["text"]})
    out.sort(key=lambda w: w["t"])
    json.dump(out, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
    kept = len(out) / max(1, len(W))
    print("时间线 %s：%d 段人物，%d/%d 个词落在成片里（%.0f%%）→ %s" % (os.path.basename(path)[:8], len(items), len(out), len(W), kept * 100, a.out))
    if kept < 0.3:
        print("⚠ 落进成片的词太少：words.json 和时间线上的素材可能不是同一个（检查 --asset），或者 --fps 不对")
    if out:
        print("开头: " + "".join(w["text"] for w in out[:20]) + " …")


if __name__ == "__main__":
    main()
