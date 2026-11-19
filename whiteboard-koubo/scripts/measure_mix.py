#!/usr/bin/env python3
"""导出后实测成片声音：人声响度、峰值、有没有爆音、音效相对人声多响、声音和剪辑点差几帧。

用法:
  measure_mix.py <成片或音频> [--top 6]
      时长、峰值 dBFS、削波采样数、语音段 50 ms RMS 中位数、最响的几个时刻。
      对「不含音效的时间线导出」跑一次，得到 sfx_bed.py 要的 voiceMedian。
  measure_mix.py <成片> --sfx bed.wav --cues cues.json
      估算音效轨在成片里的增益，并按音色列出成片里的响度和相对人声的 dB。
  measure_mix.py <导出音频或成片> --src-env env.json --cut cut.json [--fps 30]
      核对成片里听到的内容和选条表的切点差多少毫秒。ChatCut 导出的声音相对 sourceIn 有约 1 帧的
      固定偏移（build_cut.py 默认已补 -1 帧），每个新项目铺完人声后先导出音频核对一次。
"""
import argparse, array, json, math, os, shutil, subprocess, sys, tempfile, wave
if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台/管道默认 GBK，打印 ⚠ ✓ 会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SR = 16000


def load(path):
    tmp = os.path.join(tempfile.mkdtemp(), "a.wav")
    if shutil.which("afconvert"):
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@%d" % SR, "-c", "1", path, tmp], check=True)
    elif shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), tmp], check=True)
    else:
        sys.exit("需要 ffmpeg（macOS 自带的 afconvert 也行）。Windows 可用 `winget install Gyan.FFmpeg` 安装，装好后重开终端。")
    w = wave.open(tmp)
    a = array.array("h")
    a.frombytes(w.readframes(w.getnframes()))
    return a


def db(v):
    return 20 * math.log10(max(v, 1e-9))


def rms50(x, i0, i1):
    """[i0,i1) 内 50 ms 窗 RMS 的最大值（满幅=1）。"""
    win, m = SR // 20, 0
    for i in range(max(0, i0), min(len(x), i1) - win + 1, win // 4):
        s = 0
        for v in x[i:i + win]:
            s += v * v
        m = max(m, math.sqrt(s / win) / 32768)
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("media")
    ap.add_argument("--top", type=int, default=6)
    ap.add_argument("--sfx")
    ap.add_argument("--cues")
    ap.add_argument("--src-env")
    ap.add_argument("--cut")
    ap.add_argument("--fps", type=float, default=30)
    a = ap.parse_args()
    x = load(a.media)
    n, win = len(x), SR // 20
    pk = max(abs(v) for v in x)
    act = sorted(d for d in (db(math.sqrt(sum(v * v for v in x[i:i + win]) / win) / 32768) for i in range(0, n - win, win)) if d > -45)
    vm = act[len(act) // 2]
    print("时长 %.2f s | 峰值 %.1f dBFS | 削波采样 %d | 语音段 50ms RMS 中位数 %.1f dBFS" % (n / SR, db(pk / 32768), sum(1 for v in x if abs(v) >= 32767), vm))
    seen = []
    for i in sorted(range(0, n, 4), key=lambda i: -abs(x[i])):
        if all(abs(i - j) > SR * 0.3 for j in seen):
            seen.append(i)
            if len(seen) >= a.top:
                break
    print("最响的时刻: " + ", ".join("%.2fs %.1f" % (i / SR, db(abs(x[i]) / 32768)) for i in seen))

    if a.sfx:
        bed = load(a.sfx)
        m = min(n, len(bed))
        num = den = 0
        for i in range(m):
            b = bed[i]
            if b:
                num += x[i] * b
                den += b * b
        gain = db(abs(num / den)) if den else float("nan")
        print("音效轨在成片里的增益 %+.1f dB（人声与音效不相关，按最小二乘估算）" % gain)
        if a.cues:
            cfg = json.load(open(a.cues, encoding="utf-8"))
            allc = sorted((g["startFrame"] / cfg["fps"] + c[0], c[1]) for g in cfg["groups"] for c in g["cues"])
            by = {}
            for i, (t, kind) in enumerate(allc):
                nxt = allc[i + 1][0] if i + 1 < len(allc) else t + 1
                i0 = int(t * SR)
                by.setdefault(kind, []).append(db(rms50(bed, i0, i0 + int(SR * min(0.6, max(0.1, nxt - t))))) + gain)
            print("音色      个数  成片里峰值50ms RMS  相对人声（typing 是稀疏点击，RMS 偏低属正常）")
            for k, v in sorted(by.items()):
                med = sorted(v)[len(v) // 2]
                print("%-9s %4d  %8.1f dBFS      %+5.1f dB" % (k, len(v), med, med - vm))

    if a.src_env and a.cut:
        src, cut = json.load(open(a.src_env, encoding="utf-8")), json.load(open(a.cut, encoding="utf-8"))
        env = [math.sqrt(sum(v * v for v in x[i:i + 160]) / 160) for i in range(0, n - 160, 160)]

        def pearson(p, q):
            mp, mq = sum(p) / len(p), sum(q) / len(q)
            num = sum((u - mp) * (v - mq) for u, v in zip(p, q))
            return num / (math.sqrt(sum((u - mp) ** 2 for u in p) * sum((v - mq) ** 2 for v in q)) + 1e-9)

        late = []
        for c in cut:
            if c["dur"] < a.fps:  # 太短的段不稳
                continue
            e0, ln, s0 = round(c["tl"] / a.fps * 100), round(c["dur"] / a.fps * 100), round(c["srcF"] / a.fps * 100)
            if e0 + ln > len(env) or s0 + ln + 12 > len(src) or s0 < 12:
                continue
            late.append(10 * max(range(-8, 9), key=lambda d: pearson(env[e0 + 4:e0 + ln - 4], src[s0 + 4 + d:s0 + ln - 4 + d])))
        late.sort()
        med = late[len(late) // 2]
        print("成片里每段听到的内容，比 cut.json 的切点%s %d ms（%d 段的中位数，分辨率 10 ms）" % ("靠后" if med >= 0 else "靠前", abs(med), len(late)))
        print("  |偏差| < 25 ms 可以不管；靠后 ≥ 25 ms 说明字头被吃掉，sourceIn 再整体提前 1 帧；靠前 ≥ 25 ms 则推后 1 帧。")

if __name__ == "__main__":
    main()
