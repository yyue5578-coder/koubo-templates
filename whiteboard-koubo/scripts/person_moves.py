#!/usr/bin/env python3
"""人物画面的镜头动作：生成 ChatCut edit_item 的 keyframes 数组（直接作为 edit_item 的 keyframes 参数）。

用法:
  person_moves.py push   --item ID --start F --end F [--zoom 1.12] [--in 0.3] [--out 0] --face CX,CY
      推镜头：说到重点句时人物画面以脸为中心慢慢放大，--out 给秒数就在 end 前缩回去（0 = 保持到片段结束）。
  person_moves.py shake  --item ID --at F [--amp 12] [--dur 0.3]
      轻震：重音、反转处左右震几下。
  person_moves.py shrink --item ID --start F --to '<circle_layout.py 输出的 JSON>' [--dur 0.4]
      版式 A → B：人物从全屏缩进右下圆圈。ID 是版式 B 那段人物片段，F 是它的起始帧。
  person_moves.py grow   --item ID --end F --frm '<circle_layout.py 输出的 JSON>' [--dur 0.4]
      版式 B → A：圆圈放大回全屏。ID 是版式 B 那段人物片段，F 是它的结束帧（startFrame+durationFrames）。

通用参数: --fps 30  --canvas 1080x1920  --base left,top,width,height（人物片段当前的位置大小，默认全屏）
帧号都是时间线上的绝对帧（含片段的 startFrame）。
--face: 脸中心在**画布**上的坐标（全屏人物时就等于源画面坐标 × 画布宽/源宽）。
注意: shrink/grow 只动位置、大小和裁切；圆角（borderRadius）不能做关键帧，要先用 edit_item updates 设成
  circle_layout.py 给的值，所以缩放开始那一瞬间全屏画面会带圆角，0.4 秒内就过去了。
"""
import argparse, json, sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ap = argparse.ArgumentParser()
ap.add_argument("mode", choices=["push", "shake", "shrink", "grow"])
ap.add_argument("--item", required=True)
ap.add_argument("--start", type=int)
ap.add_argument("--end", type=int)
ap.add_argument("--at", type=int)
ap.add_argument("--zoom", type=float, default=1.12)
ap.add_argument("--in", dest="tin", type=float, default=0.3)
ap.add_argument("--out", type=float, default=0)
ap.add_argument("--face")
ap.add_argument("--amp", type=float, default=12)
ap.add_argument("--dur", type=float)
ap.add_argument("--to")
ap.add_argument("--frm")
ap.add_argument("--fps", type=float, default=30)
ap.add_argument("--canvas", default="1080x1920")
ap.add_argument("--base")
a = ap.parse_args()
CW, CH = map(float, a.canvas.split("x"))
base = dict(zip(["left", "top", "width", "height"], map(float, a.base.split(",")))) if a.base else {"left": 0, "top": 0, "width": CW, "height": CH}
PATH = {"left": "transform.x", "top": "transform.y", "width": "transform.width", "height": "transform.height",
        "cropTop": "cropTop", "cropBottom": "cropBottom", "cropLeft": "cropLeft", "cropRight": "cropRight"}
ops = []


def key(frame, vals):
    for k, v in vals.items():
        ops.append({"itemId": a.item, "path": PATH[k], "action": "set", "frame": int(frame), "value": round(v, 3)})


def curve(frame, keys, easing):
    for k in keys:
        ops.append({"itemId": a.item, "path": PATH[k], "action": "curve", "frame": int(frame), "easing": easing})


def need(*names):
    miss = [n for n in names if getattr(a, n) is None]
    if miss:
        sys.exit("%s 需要参数: %s" % (a.mode, ", ".join("--" + m for m in miss)))


if a.mode == "push":
    need("start", "end", "face")
    fx, fy = map(float, a.face.split(","))
    z = a.zoom
    zoomed = {"left": fx - (fx - base["left"]) * z, "top": fy - (fy - base["top"]) * z, "width": base["width"] * z, "height": base["height"] * z}
    f1 = a.start + max(1, round(a.tin * a.fps))
    key(a.start, base)
    key(f1, zoomed)
    curve(a.start, base, "ease-out-cubic")
    if a.out > 0:
        f2 = a.end - max(1, round(a.out * a.fps))
        key(f2, zoomed)
        key(a.end - 1, base)
        curve(f2, base, "ease-in-out-cubic")
elif a.mode == "shake":
    need("at")
    n = max(4, round((a.dur or 0.3) * a.fps))
    for i in range(n + 1):
        amp = a.amp * (1 - i / n)
        dx = 0 if i in (0, n) else (amp if i % 2 else -amp)
        key(a.at + i, {"left": base["left"] + dx})
elif a.mode in ("shrink", "grow"):
    circ = json.loads(a.to if a.mode == "shrink" else (a.frm or "null") or "null")
    if not circ:
        sys.exit("shrink 要 --to，grow 要 --frm（circle_layout.py 的输出 JSON）")
    full = dict(base, cropTop=0, cropBottom=0, cropLeft=0, cropRight=0)
    small = {k: circ[k] for k in ["left", "top", "width", "height", "cropTop", "cropBottom", "cropLeft", "cropRight"]}
    n = max(2, round((a.dur or 0.4) * a.fps))
    if a.mode == "shrink":
        need("start")
        key(a.start, full)
        key(a.start + n, small)
        curve(a.start, full, "ease-in-out-cubic")
    else:
        need("end")
        key(a.end - 1 - n, small)
        key(a.end - 1, full)
        curve(a.end - 1 - n, full, "ease-in-out-cubic")

print(json.dumps(ops, ensure_ascii=False))
print("%d 个关键帧操作（%s）。作为 edit_item 的 keyframes 参数传入；改完用 preview_timeline 抽帧看。" % (len(ops), a.mode), file=sys.stderr)
