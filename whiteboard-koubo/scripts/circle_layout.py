#!/usr/bin/env python3
"""把「人脸中心」换算成人物圆圈的摆放参数（ChatCut edit_item 的 left/top/width/height/crop*/borderRadius）。

用法: circle_layout.py <脸中心x> <脸中心y> [--face-w 脸宽 | --S 820] [--center 770,1480] [--d 320] [--src 1080x1920]
  脸中心: 源画面像素，faces.swift 输出的 cx cy。每个片段各算一次（人会动）。
  S: 以脸为中心、要装进圆圈的源画面正方形边长；头肩入画约为脸宽的 2.3–2.6 倍。
     给 --face-w（faces.swift 输出的 w）时按 2.4 倍脸宽算；S 不会超过源画面宽高。
     默认 820 是固定值，脸大的素材会只拍到脸，优先用 --face-w。
  center/d: 圆圈在画布上的圆心和直径。默认右下角 (770,1480)、直径 320。
  radius: 圆角，默认 d/2 是圆形；风格包相框是 polaroid（拍立得）时传 8。
原理: 整个视频按 k=d/S 缩小摆到画布上，再用 crop 只露出那块正方形，圆角设为半径。
"""
import argparse, json
import sys
if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台/管道默认 GBK，打印 ⚠ ✓ 会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ap = argparse.ArgumentParser()
ap.add_argument("cx", type=float)
ap.add_argument("cy", type=float)
ap.add_argument("--S", type=float, default=820)
ap.add_argument("--face-w", type=float, help="脸宽（源像素），给了就用 S=2.4×脸宽")
ap.add_argument("--center", default="770,1480")
ap.add_argument("--d", type=float, default=320)
ap.add_argument("--src", default="1080x1920")
ap.add_argument("--radius", type=float, help="圆角半径，默认 d/2（圆形）；风格包相框选 polaroid 时用 8（方形）")
a = ap.parse_args()
W, H = map(float, a.src.split("x"))
X, Y = map(float, a.center.split(","))
S = min(2.4 * a.face_w if a.face_w else a.S, W, H)
x0 = min(max(a.cx - S / 2, 0), W - S)
y0 = min(max(a.cy - S / 2, 0), H - S)
k = a.d / S
print(json.dumps({
    "left": round(X - a.d / 2 - x0 * k, 2), "top": round(Y - a.d / 2 - y0 * k, 2),
    "width": round(W * k, 2), "height": round(H * k, 2),
    "cropLeft": round(x0 / W, 4), "cropRight": round((W - x0 - S) / W, 4),
    "cropTop": round(y0 / H, 4), "cropBottom": round((H - y0 - S) / H, 4),
    "borderRadius": a.radius if a.radius is not None else a.d / 2,
}))
