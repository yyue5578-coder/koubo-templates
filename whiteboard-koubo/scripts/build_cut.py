#!/usr/bin/env python3
"""把「选条表」变成时间线片段，并在动手前检查每一刀里有没有混进多余的词。

用法:
  build_cut.py <pieces.json> [--fps 30] [--words words.json] [--asset ASSET_ID]
               [--src-dur 秒] [--offset-frames -1] [--size 1080x1920] [--out-dir .]

pieces.json: [[源起点秒, 源终点秒, 接法, "这一刀里应该听到的字"], ...]，按成片顺序排。
  起止点取自语音岛（islands.py），不是转写时间。
  接法决定这一刀后面留多少气口（秒）: "c" 0.12 句内 | "s" 0.18 句间 | "S" 0.26 段落 |
  "E" 片尾多留 0.45 | "X" 硬切：终点就是切点，不留尾（一个岛内部切掉后半句时用）。
输出:
  cut.json   [{srcF, dur, tl, txt}]  源帧、时长帧、时间线起点帧
  adds.json  有 --asset 时生成，可直接作为 ChatCut edit_item 的 adds（人物全屏放 V2，音频自动联动）
  --offset-frames: sourceIn 的整体偏移。ChatCut 导出的声音比源晚约 1 帧，默认 -1；
  新项目先用 measure_mix.py 的 --src-env/--cut 核对一次再信它。
--src-dur: 源素材时长（秒）。给了就把超出源末尾的片段截短（片尾 "E" 的 0.45 s 常会超出，
  ChatCut 会拒绝整批写入：source range exceeds asset）。
--words: 核对每一刀时间范围内转写到的字。出现了「应该听到的字」里没有的内容就标 ⚠
  （多切进了别的词，或转写写了错别字/同音字——后者正好是字幕要改的地方）；
  尾巴上重复了下一刀开头的标「重复」——那通常是重说的半句没切干净。
  另外列出「跨刀词」：时间跨过切点、同时落在相邻两段里的词。ChatCut 的字幕可能把它在切点两边
  各放一次（音频不重复，只是字幕叠字，如「做做自媒体」），开启字幕后到这些位置核对。
  这个预测会有误报，以字幕实际内容为准。
"""
import argparse, json, os, re
import sys
if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台/管道默认 GBK，打印 ⚠ ✓ 会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

GAP = {"c": 0.12, "s": 0.18, "S": 0.26}
PRE = 0.04  # 每刀起点前留一点，保住字头


def norm(s):
    return re.sub(r"[\W_]+", "", s).lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pieces")
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--words")
    ap.add_argument("--asset")
    ap.add_argument("--offset-frames", type=int, default=-1)
    ap.add_argument("--src-dur", type=float, help="源素材时长（秒），超出部分截掉")
    ap.add_argument("--size", default="1080x1920")
    ap.add_argument("--out-dir", default=".")
    a = ap.parse_args()
    P = json.load(open(a.pieces, encoding="utf-8"))
    fps = a.fps

    if a.words:
        W = [w for w in json.load(open(a.words, encoding="utf-8")) if "silent" not in w["text"]]
        bad = 0
        for i, (s, e, j, txt) in enumerate(P):
            heard = norm("".join(w["text"] for w in W if s - 0.05 <= (w["start"] + w["end"]) / 2000 <= e + 0.05))
            want = norm(txt)
            flag = ""
            if heard and heard not in want:  # 只少了头尾的字是转写时间漂移，不算
                flag = "⚠"
                if i + 1 < len(P):
                    nxt = norm(P[i + 1][3])
                    for k in range(min(6, len(nxt)), 1, -1):
                        if heard.endswith(nxt[:k]) and not want.endswith(nxt[:k]):
                            flag = "⚠ 重复「%s」" % nxt[:k]
                            break
                bad += 1
                print("%3d %8.2f-%8.2f %s\n      应听到: %s\n      转写到: %s" % (i, s, e, flag, want, heard))
        print("转写核对: %d/%d 刀有出入（⚠ 用 islands.py fine 看波形确认是多切了词，还是转写的错别字）\n" % (bad, len(P)))

    segs = []
    for i, (s, e, j, txt) in enumerate(P):
        st = s - PRE
        en = e if j == "X" else e + 0.45 if j == "E" else e + GAP[j] - PRE
        if segs and st <= segs[-1]["b"] + 0.001:  # 源上相连就并成一段
            segs[-1]["b"] = max(segs[-1]["b"], en)
            segs[-1]["txt"] += txt
        else:
            segs.append({"a": st, "b": en, "txt": txt})
    t, cut = 0, []
    last_f = int(a.src_dur * fps + 1e-6) - a.offset_frames if a.src_dur else None  # srcF+dur 的上限
    for sg in segs:
        fa, fb = round(sg["a"] * fps), round(sg["b"] * fps)
        if last_f is not None and fb > last_f:
            print("截短: 源 %.2f s 起的一段超出素材末尾 %d 帧" % (fa / fps, fb - last_f))
            fb = last_f
        cut.append({"srcF": fa, "dur": fb - fa, "tl": t, "txt": sg["txt"]})
        t += fb - fa
    for c in cut:
        print("%5d %6.2fs  src %8.2f +%4d  %s" % (c["tl"], c["tl"] / fps, c["srcF"] / fps, c["dur"], c["txt"]))
    print("共 %d 段, %d 帧 = %.2f s" % (len(cut), t, t / fps))
    if not a.src_dur:
        print("提示: 没给 --src-dur，最后一段可能超出源素材末尾")
    if a.words:
        rng = [((c["srcF"] + a.offset_frames) / fps, (c["srcF"] + a.offset_frames + c["dur"]) / fps) for c in cut]
        cross = []
        for w in W:
            s, e = w["start"] / 1000, w["end"] / 1000
            idx = [i for i, (x, y) in enumerate(rng) if s < y and e > x]
            if len(idx) > 1:
                cross.append("「%s」切点 %d（时间线 %.2f s）" % (w["text"], idx[1], cut[idx[1]]["tl"] / fps))
        if cross:
            print("跨刀词 %d 个（开启字幕后核对这些位置有没有叠字）:\n  " % len(cross) + "\n  ".join(cross))
    json.dump(cut, open(os.path.join(a.out_dir, "cut.json"), "w", encoding="utf-8"), ensure_ascii=False)
    if a.asset:
        w, h = map(int, a.size.split("x"))
        adds = [{"type": "video", "assetId": a.asset, "trackId": "V2", "startFrame": c["tl"], "durationFrames": c["dur"],
                 "sourceIn": round((c["srcF"] + a.offset_frames) / fps * 1e6, 3),
                 "left": 0, "top": 0, "width": w, "height": h} for c in cut]
        json.dump(adds, open(os.path.join(a.out_dir, "adds.json"), "w", encoding="utf-8"))
        print("adds.json: %d 条（sourceIn 单位微秒，已偏移 %d 帧）" % (len(adds), a.offset_frames))


if __name__ == "__main__":
    main()
