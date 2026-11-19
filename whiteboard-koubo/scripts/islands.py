#!/usr/bin/env python3
"""从 10 ms 包络里找「语音岛」（连续有声段），用来定剪辑点——不要直接信转写的词级时间。

用法:
  islands.py list <env.json> [--words words.json] [--from T0] [--to T1] [--lo 80] [--min-gap 0.12]
      列出 [T0,T1] 内每个语音岛的起止、时长、峰值，以及落在附近的转写词（带词序号）。
  islands.py fine <env.json> T0 T1
      逐 10 ms 打印包络条形图，用来在一个岛内部找音节之间的谷（硬切点）。

words.json: [{"start": ms, "end": ms, "text": "..."}]，可由 ChatCut 的 raw-result.json 里
utterances[].words 拼出来。转写时间可能偏 ±0.5 s，所以只把它当「这附近说了什么」的提示。
"""
import argparse, json
import sys
if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台/管道默认 GBK，打印 ⚠ ✓ 会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def islands(env, lo=80, min_gap=12, min_len=4):
    out, st, last = [], None, None
    for i, v in enumerate(env):
        if v >= lo:
            if st is None:
                st = i
            last = i
        elif st is not None and i - last >= min_gap:
            if last - st >= min_len:
                out.append((st, last + 1))
            st = None
    if st is not None and last - st >= min_len:
        out.append((st, last + 1))
    return out


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("list")
    a.add_argument("env")
    a.add_argument("--words")
    a.add_argument("--from", dest="t0", type=float, default=0)
    a.add_argument("--to", dest="t1", type=float, default=1e9)
    a.add_argument("--lo", type=int, default=80)
    a.add_argument("--min-gap", type=float, default=0.12)
    b = sub.add_parser("fine")
    b.add_argument("env")
    b.add_argument("t0", type=float)
    b.add_argument("t1", type=float)
    args = ap.parse_args()
    env = json.load(open(args.env, encoding="utf-8"))
    if args.cmd == "fine":
        for i in range(int(args.t0 * 100), min(len(env), int(args.t1 * 100))):
            v = env[i]
            print("%8.2f %6d %s" % (i / 100, v, "#" * min(60, int(v / 40))))
        return
    words = []
    if args.words:
        words = [(i, w) for i, w in enumerate(json.load(open(args.words, encoding="utf-8"))) if "silent" not in w["text"]]
    for s, e in islands(env, args.lo, round(args.min_gap * 100)):
        if e / 100 < args.t0 or s / 100 > args.t1:
            continue
        near = ["%d%s" % (i, w["text"]) for i, w in words
                if s / 100 - 0.25 < (w["start"] + w["end"]) / 2000 < e / 100 + 0.25]
        print("%8.2f-%8.2f (%.2fs pk%5d) %s" % (s / 100, e / 100, (e - s) / 100, max(env[s:e]), " ".join(near)))


if __name__ == "__main__":
    main()
