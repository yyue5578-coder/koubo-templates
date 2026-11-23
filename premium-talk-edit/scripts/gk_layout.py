#!/usr/bin/env python3
"""版式切换：按 gk_cues.py 的 cues.json，生成「上卡下人」时人物下移的关键帧，和「全屏讲解」时左下角人物圆窗的片段。

三种版式（场景自己决定，见 references/scenes.md）：
  A 人物全屏，卡片叠在人物上方          → 人物不动
  B 上卡下人：顶部深色底 + 卡片，人物下移 --shift 像素（默认 200）
                                       → 每个 B 段进出各 --ramp 帧（默认 13）缓入缓出下移 / 回位
  C 全屏讲解：整屏底色 + 内容，人物缩进左下角圆窗（x72 y1290 直径240）
                                       → 在上层轨道叠一个裁成圆的人物片段（联动音频要静音）

用法:
  gk_layout.py cues.json --project <projectPath> [--timeline ID] [--asset ID前缀]
               [--shift 200] [--ramp 13] [--batch 60]
               [--face cx,cy,w] [--src 1080x1920] [--circle-track V3] [--out-dir .]

  projectPath: read_project 返回的 projectHome.projectPath。直接读当前时间线上的人物片段（最多的那个视频素材），
               所以粗剪后又切分、挪动都没关系，改完重跑一次。
  --face:      圆窗里人物的脸中心 cx,cy 和脸宽 w（源画面像素，faces.swift 输出）。不给就按画面中上部估一个并提示。
输出（--out-dir）:
  layout_keyframes_01.json …  每个是一个数组，作为 edit_item 的 keyframes 参数（先 remove 旧的，再 set / curve）。
                              按 --batch 个左右一批拆开（同一个片段的关键帧不拆开，所以个别批会多一些）：ChatCut 会把每个点回显一遍，一次写太多返回结果会超长，超长时结果会被存成文件，写入本身是成功的，用 read_project / 保存的时间线文件核对。
  layout_circle.json          {"adds":[…]}：全屏讲解的圆窗人物片段，作为 edit_item 的 adds。写入后把返回的
                              linkedItemIds（联动音频）全部 updates 成 {"id":…,"muted":true}，否则同一时刻有两条人声。
  layout_manifest.json        关键帧批次文件的先后顺序（以它为准）。
  layout_report.txt           每段的版式、人物下移区间、圆窗片段数。
"""
import argparse, glob, json, math, os, sys
from collections import Counter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CIRCLE = {"x": 72, "y": 1290, "d": 240}  # 与 assets/mg/lib.jsx 的 CIRCLE 一致，改一边要同步改这里


def load_timeline(project, tid):
    files = glob.glob(os.path.join(project, "timelines", "*.json"))
    if tid:
        files = [f for f in files if os.path.basename(f).startswith(tid)]
    if not files:
        sys.exit("在 %s 下没找到 timelines/*.json。projectPath 要用 read_project 返回的 projectHome.projectPath" % project)
    return json.load(open(max(files, key=os.path.getmtime), encoding="utf-8"))


def person_clips(tl, asset):
    vids = [v for v in tl.get("videoItems", []) if v.get("sourceIn") is not None]
    if asset:
        vids = [v for v in vids if v["assetId"].startswith(asset)]
    if not vids:
        sys.exit("时间线上没有人物视频片段（先铺人物，再跑这个脚本）")
    cnt = Counter((v["trackId"], v["assetId"]) for v in vids)
    (track, aid), _ = cnt.most_common(1)[0]
    clips = sorted([v for v in vids if v["trackId"] == track and v["assetId"] == aid], key=lambda v: v["startFrame"])
    return clips, aid, track


def b_intervals(groups, ramp, fps_ratio, last_frame):
    """B 段合并成「人物下移区间」。上一段 panelOut:false、下一段 panelIn:false 且首尾相接时人物不回位。"""
    bs = []
    for g in sorted(groups, key=lambda g: g["startFrame"]):
        if g.get("layout") != "B":
            continue
        s = round(g["startFrame"] * fps_ratio)
        # 终点不能超过人物片段最后一帧（关键帧必须落在片段内），否则最后一帧的位置会停在半路
        bs.append([s, min(s + int(g.get("frames") or 0), last_frame), g.get("panelIn", True), g.get("panelOut", True)])
    out = []
    for s, e, pin, pout in bs:
        if out and abs(s - out[-1][1]) <= 2 and out[-1][3] is False and pin is False:
            out[-1][1] = e
            out[-1][3] = pout
        else:
            out.append([s, e, pin, pout])
    return [(s, e) for s, e, _, _ in out if e - s >= 2 * ramp + 2]


def y_func(intervals, shift, ramp):
    pts = []  # (帧, 值)，帧单调不减
    for s, e in intervals:
        pts += [(s, 0), (s + ramp, shift), (e - ramp, shift), (e, 0)]

    def y(f):
        for (f0, v0), (f1, v1) in zip(pts, pts[1:]):
            if f0 <= f <= f1 and f1 > f0:
                return v0 + (v1 - v0) * (f - f0) / (f1 - f0)
        return 0.0
    return pts, y


def clip_keyframes(c, pts, y, ramp_starts, ramp):
    cs, ce = c["startFrame"], c["startFrame"] + c["durationFrames"] - 1
    inside = sorted({f for f, _ in pts if cs < f < ce})
    frames = sorted({cs, ce, *inside})
    if all(abs(y(f)) < 1e-6 for f in frames) and not any(rs < ce and rs + ramp > cs for rs in ramp_starts):
        return []  # 这个片段全程在原位
    iid = c["id"].replace("-", "")[:10]
    kfs = [{"itemId": iid, "path": "transform.y", "action": "set", "frame": f, "value": round(y(f), 2)} for f in frames]
    for f in frames:
        in_ramp = any(rs <= f < rs + ramp for rs in ramp_starts)  # 缓入 / 缓出：从 rs 起 ramp 帧
        if in_ramp:
            kfs.append({"itemId": iid, "path": "transform.y", "action": "curve", "frame": f, "easing": "ease-in-out-cubic"})
    return kfs


def old_points(c, fps):
    pts = (((c.get("animation") or {}).get("tracks") or {}).get("transform.y") or {}).get("points") or []
    iid = c["id"].replace("-", "")[:10]
    return [{"itemId": iid, "path": "transform.y", "action": "remove", "frame": c["startFrame"] + round(p["time"] * fps / 1e6)} for p in pts]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cues")
    ap.add_argument("--project", required=True)
    ap.add_argument("--timeline")
    ap.add_argument("--asset")
    ap.add_argument("--shift", type=float, default=200)
    ap.add_argument("--ramp", type=int, default=13)
    ap.add_argument("--batch", type=int, default=60)
    ap.add_argument("--face")
    ap.add_argument("--src", default="1080x1920")
    ap.add_argument("--circle-track", default="V3")
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--out-dir", default=".")
    a = ap.parse_args()
    cj = json.load(open(a.cues, encoding="utf-8"))
    groups = [g for g in cj["groups"] if g.get("layout")]
    if not groups:
        sys.exit("cues.json 里没有版式信息：用当前版本的 gk_cues.py 重新生成")
    ratio = a.fps / cj.get("fps", a.fps)
    tl = load_timeline(a.project, a.timeline)
    clips, aid, track = person_clips(tl, a.asset)
    os.makedirs(a.out_dir, exist_ok=True)
    report = []

    # ---- B：人物下移
    last_frame = max(c["startFrame"] + c["durationFrames"] - 1 for c in clips)
    ivs = b_intervals(groups, a.ramp, ratio, last_frame)
    pts, y = y_func(ivs, a.shift, a.ramp)
    ramp_starts = [s for s, _ in ivs] + [e - a.ramp for _, e in ivs]
    units = []  # 一个单位不能拆开：同一个片段的 set / curve 必须在同一批里
    removes = []
    for c in clips:
        removes += old_points(c, a.fps)
    units += [[r] for r in removes]
    for c in clips:
        ks = clip_keyframes(c, pts, y, ramp_starts, a.ramp)
        if ks:
            units.append(ks)
    batches, cur = [], []
    for u in units:
        if cur and len(cur) + len(u) > a.batch:
            batches.append(cur)
            cur = []
        cur += u
    if cur:
        batches.append(cur)
    files = []
    for i, b in enumerate(batches, 1):
        fn = "layout_keyframes_%02d.json" % i
        json.dump(b, open(os.path.join(a.out_dir, fn), "w", encoding="utf-8"), ensure_ascii=False)
        files.append(fn)
    json.dump({"keyframe_batches_in_order": files, "circle": "layout_circle.json"}, open(os.path.join(a.out_dir, "layout_manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    report.append("人物下移 %d 段区间：%s" % (len(ivs), "  ".join("%.1f–%.1f s" % (s / a.fps, e / a.fps) for s, e in ivs)))
    report.append("人物片段 %d 个，其中 %d 个要写关键帧；旧关键帧 %d 个要先 remove；共 %d 批（每批约 %d 个；同一个片段的关键帧不拆开，所以个别批会多一些）" % (
        len(clips), len({k["itemId"] for b in batches for k in b if k["action"] == "set"}), len(removes), len(batches), a.batch))
    report.append("顺序按 layout_manifest.json：逐批 edit_item（前面几批是 remove，后面是 set / curve）。目录里如有以前留下的更高编号文件，以 manifest 为准。")

    # ---- C：圆窗
    S_W, S_H = map(float, a.src.split("x"))
    if a.face:
        fx, fy, fw = map(float, a.face.split(","))
    else:
        fx, fy, fw = S_W / 2, S_H * 0.33, 380.0
        report.append("⚠ 没给 --face：按画面中上部估了脸中心（%.0f,%.0f，脸宽 %.0f）。用 faces.swift 量一下再重跑，圆窗里才会是头肩" % (fx, fy, fw))
    S = min(2.4 * fw, S_W, S_H)
    x0 = min(max(fx - S / 2, 0), S_W - S)
    y0 = min(max(fy - S / 2, 0), S_H - S)
    k = CIRCLE["d"] / S
    cx, cy = CIRCLE["x"] + CIRCLE["d"] / 2, CIRCLE["y"] + CIRCLE["d"] / 2
    lay = {"left": round(cx - CIRCLE["d"] / 2 - x0 * k, 2), "top": round(cy - CIRCLE["d"] / 2 - y0 * k, 2),
           "width": round(S_W * k, 2), "height": round(S_H * k, 2),
           "cropLeft": round(x0 / S_W, 4), "cropRight": round((S_W - x0 - S) / S_W, 4),
           "cropTop": round(y0 / S_H, 4), "cropBottom": round((S_H - y0 - S) / S_H, 4),
           "borderRadius": CIRCLE["d"] / 2}
    adds, ncirc = [], 0
    for g in sorted(groups, key=lambda g: g["startFrame"]):
        if not (g.get("layout") == "C" and g.get("circle")):
            continue
        s = round(g["startFrame"] * ratio)
        e = s + int(g.get("frames") or 0)
        ncirc += 1
        for c in clips:
            o0, o1 = max(s, c["startFrame"]), min(e, c["startFrame"] + c["durationFrames"])
            if o1 - o0 < 1:
                continue
            adds.append(dict({"type": "video", "assetId": aid, "trackId": a.circle_track, "startFrame": o0, "durationFrames": o1 - o0,
                              "sourceIn": int(round(c["sourceIn"] + (o0 - c["startFrame"]) * 1e6 / a.fps))}, **lay))
    json.dump({"adds": adds}, open(os.path.join(a.out_dir, "layout_circle.json"), "w", encoding="utf-8"), ensure_ascii=False)
    report.append("全屏讲解圆窗：%d 段，%d 个圆窗片段 → layout_circle.json（放在 %s；轨道必须在动效叠层轨之上，否则被全屏底色盖住）" % (ncirc, len(adds), a.circle_track))
    if adds:
        report.append("圆窗参数：%s" % json.dumps(lay))
        report.append("写入后：把返回的 linkedItemIds 全部 updates 成 muted:true（圆窗人物的联动音频），再跑 final_check.py 核对。")
    txt = "\n".join(report)
    open(os.path.join(a.out_dir, "layout_report.txt"), "w", encoding="utf-8").write(txt + "\n")
    print(txt)


if __name__ == "__main__":
    main()
