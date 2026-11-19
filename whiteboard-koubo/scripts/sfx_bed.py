#!/usr/bin/env python3
"""用纯 Python 合成整条音效轨（48 kHz 单声道 WAV），响度直接烘焙进文件，不靠轨道音量。

用法: sfx_bed.py <cues.json> <out.wav> [--voice-median -30.4] [--demo demo.wav]

cues.json（时间写成「每段动效内的相对秒」，重剪后只改 startFrame 就能整体平移）:
{
  "fps": 30, "totalFrames": 3345, "voiceMedian": -30.4,
  "groups": [
    {"name": "M1 减法", "startFrame": 341,
     "cues": [[-0.22, "whoosh"], [0.05, "pop"], [0.5, "tiny"], [2.8, "scribble", 0.9], [5.35, "stamp"]]}
  ],
  "offsets": {"stamp": 5}          // 可选：覆盖某一类相对人声的 dB
}
音色:
  合成: pop 弹出 | tiny 小弹出(连续出现的小元素) | tick 打勾 | whoosh 转场、飞入 | beep flat|beat 心电图平线/心跳 |
        fall 下滑音(泄气、没起来) | typing <秒> 键盘打字 | erase <秒> 橡皮擦来回擦
  真实录音(assets/sfx/，Freesound CC0): scribble <秒，0.3–3> 手写/划线/画圈/荧光笔（按 sound 用马克笔或铅笔笔画拼接）|
        stamp 盖章/重点落下 | paper 纸张拍上、翻过、便签贴上 | tear 撕纸、便签被撕走 | tape 撕胶带、胶带贴上 |
        crumple 揉纸、便签被揉掉 | cap 拔笔帽（手写段开头）
  每次出现随机挑一条录音，音高 ±6%、音量 ±1.5 dB 浮动，同一 seed 结果固定。
sound（cues.json 的 "sound" 或 --sound，scene_cues.py 会从 theme.jsx 带过来）:
  marker 马克笔（默认）| pencil 铅笔 | synth 全部用旧的合成音色（scribble、stamp 回到合成）
seed（cues.json 的 "seed" 或 --seed）: 用视频名，同一风格下每条视频挑到的录音不同。
voiceMedian: 「不含音效的时间线人声」语音段 50 ms RMS 中位数（measure_mix.py 可测）。
  各音色的响度 = voiceMedian + 下面的 OFFSETS（峰值 50 ms RMS）。
"""
import argparse, json, math, os, random, struct, wave
from array import array
import sys
if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台/管道默认 GBK，打印 ⚠ ✓ 会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SR = 48000
# 相对人声中位数的 dB（默认值，可按口味调）。实测听感合适的范围：弹出/盖章/打勾 ≈ 人声到 +6，手写/嗖声 ≈ 人声 -1 到 -5。
OFFSETS = {"pop": 4, "tiny": 2, "stamp": 6, "tick": 3, "scribble": -2, "whoosh": -1, "beep": -1, "fall": 0,
           # 以下是真实录音新音色的起步值（2026-11 新增，还没经过成片实听校准）
           "paper": -1, "tear": 0, "tape": 0, "crumple": -1, "cap": 0, "erase": -3}
SFX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sfx")
SAMPLE_VOICES = {"paper", "tear", "tape", "crumple", "cap"}
SOUND = "marker"
TYPING_PEAK = 17  # 打字声是稀疏的短促点击，按 RMS 归一会让峰值过高，所以按峰值定：人声中位 +17，且不超过 -9 dBFS


def noise(n):
    return [random.uniform(-1, 1) for _ in range(n)]


def bq(x, typ, f, q=0.8):
    w = 2 * math.pi * f / SR
    al, c = math.sin(w) / (2 * q), math.cos(w)
    b = [al, 0, -al] if typ == "bp" else [(1 - c) / 2, 1 - c, (1 - c) / 2] if typ == "lp" else [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    a = [1 + al, -2 * c, 1 - al]
    y, x1, x2, y1, y2 = [], 0, 0, 0, 0
    for v in x:
        o = (b[0] * v + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0]
        x2, x1, y2, y1 = x1, v, y1, o
        y.append(o)
    return y


def bq_sweep(x, fs, q=1.2):
    y, x1, x2, y1, y2 = [], 0, 0, 0, 0
    for i, v in enumerate(x):
        w = 2 * math.pi * fs(i / SR) / SR
        al, c = math.sin(w) / (2 * q), math.cos(w)
        o = (al * v - al * x2 + 2 * c * y1 - (1 - al) * y2) / (1 + al)
        x2, x1, y2, y1 = x1, v, y1, o
        y.append(o)
    return y


def norm(x, db):
    """缩放到「峰值 50 ms RMS = db dBFS」。"""
    w, m = SR // 20, 1e-9
    for i in range(0, max(1, len(x) - w), w // 4):
        seg = x[i:i + w]
        m = max(m, math.sqrt(sum(v * v for v in seg) / len(seg)))
    g = 10 ** (db / 20) / m
    return [v * g for v in x]


def pop(db, tiny=False):
    k = random.uniform(0.9, 1.12) * (1.3 if tiny else 1)
    out, ph = [], 0
    for i in range(int(SR * 0.09)):
        t = i / SR
        ph += 2 * math.pi * (950 * math.exp(-t / 0.018) + 260) * k / SR
        out.append(math.sin(ph) * math.exp(-t / 0.022))
    cl = bq(noise(int(SR * 0.004)), "hp", 2500)
    for i, v in enumerate(cl):
        out[i] += 0.35 * v * (1 - i / len(cl))
    return norm(out, db)


def stamp(db):
    n, out, ph = int(SR * 0.22), [], 0
    for i in range(n):
        t = i / SR
        ph += 2 * math.pi * (70 + 60 * math.exp(-t / 0.02)) / SR
        out.append(math.sin(ph) * math.exp(-t / 0.06))
    nz = bq(noise(n), "lp", 900)
    for i in range(n):
        out[i] += 1.4 * nz[i] * math.exp(-(i / SR) / 0.025)
    return norm(out, db)


def tick(db):
    out = [0.0] * int(SR * 0.09)
    for off, amp, dur in [(0, 1, 0.018), (0.035, 0.7, 0.03)]:
        z = bq(noise(int(SR * dur)), "bp", 3200, 1.0)
        for i, v in enumerate(z):
            out[int(off * SR) + i] += amp * v * math.sin(math.pi * i / len(z))
    return norm(out, db)


def scribble(db, d=0.6):
    d = min(max(d, 0.3), 3.0)
    n = int(SR * d)
    z = bq(bq(noise(n), "bp", 2200, 0.7), "hp", 900)
    rate, out = random.uniform(5, 7), []
    for i, v in enumerate(z):
        t = i / SR
        am = 0.35 + 0.65 * abs(math.sin(math.pi * rate * t + 0.6 * math.sin(13 * t)))
        out.append(v * am * max(0, min(1, t / 0.04, (d - t) / 0.08)))
    return norm(out, db)


def whoosh(db):
    d = 0.45
    n = int(SR * d)
    z = bq_sweep(noise(n), lambda t: 300 + 2400 * math.sin(math.pi * t / d) ** 2, 1.0)
    return norm([v * math.sin(math.pi * i / n) ** 2 for i, v in enumerate(z)], db)


def beep(db, mode="flat"):
    if mode == "flat":
        d = 0.85
        out = [(math.sin(2 * math.pi * 880 * i / SR) + 0.25 * math.sin(2 * math.pi * 1760 * i / SR))
               * min(1, i / SR / 0.02, (d - i / SR) / 0.15) for i in range(int(SR * d))]
    else:
        out = [0.0] * int(SR * 0.75)
        for st in (0.0, 0.42):
            for i in range(int(SR * 0.12)):
                t = i / SR
                out[int(st * SR) + i] += (math.sin(2 * math.pi * 988 * t) + 0.2 * math.sin(2 * math.pi * 1976 * t)) * min(1, t / 0.005) * math.exp(-t / 0.04)
    return norm(out, db)


def fall(db):
    d, out, ph = 0.6, [], 0
    for i in range(int(SR * d)):
        t = i / SR
        ph += 2 * math.pi * 520 * (220 / 520) ** (t / d) / SR
        out.append((math.sin(ph) + 0.3 * math.sin(2 * ph)) * min(1, t / 0.01) * (1 - t / d) ** 1.5)
    return norm(out, db)


def typing(peak_db, d=1.5):
    n = int(SR * d)
    out, t = [0.0] * n, 0.0
    while t < d - 0.05:
        z = bq(noise(int(SR * 0.012)), "bp", random.uniform(2200, 3600), 1.4)
        a, s = random.uniform(0.6, 1.0), int(t * SR)
        for i, v in enumerate(z):
            out[s + i] += a * v * math.exp(-i / SR / 0.003)
        t += random.uniform(0.07, 0.13)
    g = 10 ** (peak_db / 20) / max(abs(v) for v in out)
    return [v * g for v in out]


_PACKS, _LAST = {}, {}


def read_wav(path):
    """读 16 位 PCM WAV（单/双声道都行，双声道取平均），返回 [-1,1] 浮点列表。"""
    with open(path, "rb") as f:
        b = f.read()
    i, ch, sr, data = 12, 1, SR, b""
    while i + 8 <= len(b):
        cid, sz = b[i:i + 4], struct.unpack("<I", b[i + 4:i + 8])[0]
        if cid == b"fmt ":
            ch, sr = struct.unpack("<H", b[i + 10:i + 12])[0], struct.unpack("<I", b[i + 12:i + 16])[0]
        elif cid == b"data":
            data = b[i + 8:i + 8 + sz]
            break
        i += 8 + sz + (sz & 1)
    a = array("h")
    a.frombytes(data[:len(data) // 2 * 2])
    x = [v / 32768 for v in a]
    if ch == 2:
        x = [(x[j] + x[j + 1]) / 2 for j in range(0, len(x) - 1, 2)]
    if sr != SR:
        x = resample(x, sr / SR)
    return x


def resample(x, r):
    """r > 1 变快变高。线性插值，够用。"""
    n = int(len(x) / r)
    out = []
    for i in range(n):
        p = i * r
        j = int(p)
        f = p - j
        out.append(x[j] * (1 - f) + (x[j + 1] if j + 1 < len(x) else 0) * f)
    return out


def pack(name):
    if name not in _PACKS:
        d = os.path.join(SFX_DIR, name)
        files = sorted(f for f in os.listdir(d) if f.lower().endswith(".wav")) if os.path.isdir(d) else []
        if not files:
            raise SystemExit("找不到音效素材 %s（应在 %s）。素材缺失时可以用 --sound synth 先跑合成版" % (name, d))
        _PACKS[name] = [read_wav(os.path.join(d, f)) for f in files]
    return _PACKS[name]


def variant(name):
    """随机挑一条录音（不和上一次重复），音高 ±6%，音量 ±1.5 dB。"""
    p = pack(name)
    k = random.randrange(len(p))
    if len(p) > 1 and k == _LAST.get(name):
        k = (k + 1 + random.randrange(len(p) - 1)) % len(p)
    _LAST[name] = k
    g = 10 ** (random.uniform(-1.5, 1.5) / 20)
    return [v * g for v in resample(p[k], random.uniform(0.94, 1.06))]


def sample(name, db):
    return norm(variant(name), db)


def strokes(name, db, d):
    """把几条笔画录音接成 d 秒的书写声：笔画之间略有重叠或停顿，最后淡出。"""
    d = min(max(d, 0.3), 3.0)
    n = int(SR * d)
    out, pos = [0.0] * n, 0
    while pos < n - int(SR * 0.08):
        s = variant(name)[:n - pos]
        fo = min(len(s) // 3, int(SR * 0.015))
        for j in range(len(s)):
            out[pos + j] += s[j] * (min(1, (len(s) - j) / fo) if fo else 1)
        pos += int(len(s) * random.uniform(0.75, 0.95)) + int(SR * random.uniform(0, 0.06))
    fo = int(SR * 0.06)
    for j in range(min(fo, n)):
        out[n - 1 - j] *= j / fo
    return norm(out, db)


def erase(db, d=0.6):
    """橡皮擦：中频噪声，按来回擦的节奏起伏（素材库里没有合适的橡皮擦录音，用合成）。"""
    d = min(max(d, 0.3), 3.0)
    n = int(SR * d)
    z = bq(bq(noise(n), "bp", 1300, 0.9), "lp", 3000)
    rate = random.uniform(6, 8)
    out = [v * (0.25 + 0.75 * abs(math.sin(math.pi * rate * i / SR))) * max(0, min(1, i / SR / 0.03, (d - i / SR) / 0.08))
           for i, v in enumerate(z)]
    return norm(out, db)


def make(kind, param, vm, off):
    if kind == "typing":
        return typing(min(-9, vm + TYPING_PEAK), param or 1.5)
    db = vm + off[kind]
    if kind == "pop":
        return pop(db)
    if kind == "tiny":
        return pop(db, True)
    if kind == "scribble":
        return scribble(db, param or 0.6) if SOUND == "synth" else strokes(SOUND, db, param or 0.6)
    if kind == "stamp" and SOUND != "synth":
        return sample("stamp", db)
    if kind in SAMPLE_VOICES:
        return sample(kind, db)
    if kind == "erase":
        return erase(db, param or 0.6)
    if kind == "beep":
        return beep(db, param or "flat")
    return {"stamp": stamp, "tick": tick, "whoosh": whoosh, "fall": fall}[kind](db)


def write(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v)) * 32767)) for v in x))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cues")
    ap.add_argument("out")
    ap.add_argument("--voice-median", type=float)
    ap.add_argument("--demo", help="另存一个每种音色各响一次的试听文件")
    ap.add_argument("--sound", choices=["marker", "pencil", "synth"], help="覆盖 cues.json 的 sound")
    ap.add_argument("--seed", help="覆盖 cues.json 的 seed（用视频名）")
    a = ap.parse_args()
    cfg = json.load(open(a.cues, encoding="utf-8"))
    global SOUND
    SOUND = a.sound or cfg.get("sound") or "marker"
    if SOUND not in ("marker", "pencil", "synth"):
        raise SystemExit("sound 只能是 marker / pencil / synth，收到 %s" % SOUND)
    random.seed(str(a.seed or cfg.get("seed", 11)))
    vm = a.voice_median if a.voice_median is not None else cfg["voiceMedian"]
    off = {**OFFSETS, **cfg.get("offsets", {})}
    fps = cfg["fps"]
    bed = array("f", [0.0]) * int(SR * cfg["totalFrames"] / fps)
    n = 0
    for g in cfg["groups"]:
        for c in g["cues"]:
            t, kind, param = g["startFrame"] / fps + c[0], c[1], (c[2] if len(c) > 2 else None)
            st = int(t * SR)
            for i, v in enumerate(make(kind, param, vm, off)):
                if 0 <= st + i < len(bed):
                    bed[st + i] += v
            n += 1
    pk = 20 * math.log10(max(max(abs(v) for v in bed), 1e-9))
    write(a.out, bed)
    print("%d 个音效, %.2f s, 峰值 %.1f dBFS%s -> %s" % (n, len(bed) / SR, pk, "  ⚠ 峰值高于 -6，检查是否有音效叠在一起" if pk > -6 else "", a.out))
    print("sound=%s seed=%s" % (SOUND, a.seed or cfg.get("seed", 11)))
    print("人声中位 %.1f dBFS；各音色目标(峰值50ms RMS): " % vm + ", ".join("%s %.0f" % (k, vm + v) for k, v in off.items()) + ", typing 峰值 %.0f" % min(-9, vm + TYPING_PEAK))
    if a.demo:
        demo = []
        for kind, p in [("pop", None), ("tiny", None), ("stamp", None), ("stamp", None), ("tick", None), ("scribble", 0.4), ("scribble", 1.5),
                        ("whoosh", None), ("paper", None), ("paper", None), ("tear", None), ("tear", None), ("tape", None), ("tape", None),
                        ("crumple", None), ("cap", None), ("erase", 0.8), ("beep", "flat"), ("beep", "beat"), ("fall", None), ("typing", 1.2)]:
            demo += make(kind, p, vm, off) + [0.0] * int(SR * 0.5)
        write(a.demo, demo)


if __name__ == "__main__":
    main()
