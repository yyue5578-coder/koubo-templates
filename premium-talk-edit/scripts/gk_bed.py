#!/usr/bin/env python3
"""【推荐用文件下方的「音效池模式」：--pool …。下面是旧的「放置表模式」，只在你用外部 sfx 技能挑音效时才需要。】
把 sfx 技能导出的放置表（placement.json）混成一整条音效轨 WAV（48 kHz 单声道 16 位），直接放进 ChatCut 的音频轨。

用法: gk_bed.py <sfx目录/placement.json> <out.wav> [--total 秒] [--gain dB] [--kind-gain whoosh=-2 tick=-3 …]
              [--events events.json] [--seed 视频名] [--no-vary]

  placement.json: `sfx.py export --project <目录>` 的输出，file 相对于它所在的 sfx/ 目录。
                  每项已算好 at（起点秒）、trim_in、dur、gain_db、fade_out，照放即对准。
  --total:   整条时长（秒）。不给就到最后一个音效结束。
  --gain:    整体增减 dB（人声大小不同时整体调）。
  --kind-gain: 按音色单独调，如 tick=-3。音色名取自事件清单 note 里的 kind（gk_cues.py 生成的 events.json 会写），
             需要同时给 --events。
  --seed:    同一个音效每次出现时音高 ±2%、音量 ±1.5 dB 轻微浮动，避免机械重复；同一 seed 结果固定。--no-vary 关闭。
只用 macOS 自带 python3 标准库。峰值超过 -3 dBFS 时整体压到 -3 dBFS，并打印提示。

音效池模式（推荐，模板默认用这个）:
  gk_bed.py --pool ../assets/sfx-pool/pool.json --cues cues.json <out.wav> --seed <视频名> --voice-median <dB> [--total 秒] [--gain dB] [--plan]
  cues.json 是 gk_cues.py 的输出（每个 cue 带「场合」）。每类音色 3 个变体，按 pool.json 的 rules 挑：
  同一条视频里同一场合固定用一个变体；同类不同场合尽量用不同变体；换视频名（seed）就换一套分配。
  --voice-median: 人声响度（measure_mix.py 对「不含音效的时间线导出」测出的语音段 50 ms RMS 中位数）。每类音效的响度 = 人声 + rules.rel_db 里的差值
  （点击类 +2～+6 dB，持续类 −1～−5 dB，这是用户认可过的起步值）；不给就按 -30.4 并提示。
  --plan 只打印这条视频的分配表和署名，不出 WAV。规则说明见 references/sfx.md。
"""
import argparse, array, itertools, json, math, os, random, sys, zlib

SR = 48000


def read_wav(path):
    b = open(path, "rb").read()
    if b[:4] != b"RIFF" or b[8:12] != b"WAVE":
        sys.exit("不是 WAV 文件：%s" % path)
    i, ch, bits, sr, data = 12, 1, 16, SR, b""
    while i < len(b) - 8:
        cid, n = b[i:i + 4], int.from_bytes(b[i + 4:i + 8], "little")
        if cid == b"fmt ":
            ch = int.from_bytes(b[i + 10:i + 12], "little")
            sr = int.from_bytes(b[i + 12:i + 16], "little")
            bits = int.from_bytes(b[i + 22:i + 24], "little")
        elif cid == b"data":
            data = b[i + 8:i + 8 + n]
        i += 8 + n + (n & 1)
    if bits != 16:
        sys.exit("只支持 16 位 WAV（sfx 技能 take 出来的就是 16 位）：%s" % path)
    a = array.array("h", data[: len(data) // 2 * 2])
    mono = [sum(a[j:j + ch]) / ch / 32768.0 for j in range(0, len(a) - ch + 1, ch)]
    if sr != SR:  # 线性重采样
        mono = resample(mono, sr / SR)
    return mono


def resample(x, ratio):
    """ratio>1 变快（音高变高）。"""
    n = int(len(x) / ratio)
    out = [0.0] * n
    for i in range(n):
        p = i * ratio
        j = int(p)
        f = p - j
        a = x[j] if j < len(x) else 0.0
        b = x[j + 1] if j + 1 < len(x) else 0.0
        out[i] = a + (b - a) * f
    return out


# ---------------- 音效池模式 ----------------
def _h(*parts):
    return zlib.crc32("|".join(str(p) for p in parts).encode())


def plan_pool(pool, seed):
    """返回 {(kind, role): variant}，以及每类的说明行。"""
    R = pool["rules"]
    out, lines = {}, []
    for kind, K in pool["kinds"].items():
        vs = [v for v in K["variants"] if not v.get("disabled")]
        if not vs:
            lines.append("%s：3 个都被 disabled，这类不出声" % kind)
            continue
        by_len = sorted(vs, key=lambda v: v["m"]["dur"])
        roles = list(R.get("roles", {}).get(kind, [])) or [""]
        # 固定场合（如 文件滑入 → 最长）
        for key, how in R.get("fixed", {}).items():
            k, _, role = key.partition(".")
            if k == kind:
                out[(kind, role)] = by_len[-1] if how == "longest" else by_len[0]
        # 所有分配：场合按顺序轮流用排列里的变体（场合多于变体时循环）
        cands = []
        for perm in itertools.permutations(vs):
            asg = {r: perm[i % len(perm)] for i, r in enumerate(roles)}
            ok = True
            for r, v in asg.items():
                key = "%s.%s" % (kind, r)
                if len(vs) >= 3 and key in R.get("frequent_not_longest", []) and v is by_len[-1]:
                    ok = False
                if len(vs) >= 2 and key in R.get("heavy_not_shortest", []) and v is by_len[0]:
                    ok = False
            if ok:
                cands.append(asg)
        if not cands:  # 约束放不下就不管约束
            cands = [{r: perm[i % len(perm)] for i, r in enumerate(roles)} for perm in itertools.permutations(vs)]
        asg = cands[_h(seed, kind) % len(cands)]
        for r, v in asg.items():
            out[(kind, r)] = v
        lines.append("%-6s %s" % (kind, "  ".join("%s→%d号" % (R.get("role_cn", {}).get(r, r or "默认"), v["no"]) for r, v in asg.items())
                                 + ("（%d 种可选分配）" % len(cands))))
    return out, lines


def rms50max(x, win=2400, hop=240):
    """x 里最响的 50 ms 窗口的 RMS（dBFS）。"""
    if len(x) <= win:
        win = max(1, len(x))
    best = 0.0
    for i in range(0, max(1, len(x) - win + 1), hop):
        w = x[i:i + win]
        best = max(best, sum(v * v for v in w) / win)
    return 10 * math.log10(max(best, 1e-12))


def pool_bed(a):
    pool = json.load(open(a.pool, encoding="utf-8"))
    R = pool["rules"]
    base = os.path.dirname(os.path.abspath(a.pool))
    plan, lines = plan_pool(pool, a.seed)
    print("音效分配（seed=%s）：" % a.seed)
    for l in lines:
        print("  " + l)
    cj = json.load(open(a.cues, encoding="utf-8"))
    fps = cj.get("fps", 30)
    evs = []
    for g in cj["groups"]:
        for c in g["cues"]:
            t = g["startFrame"] / fps + c[0]
            kind = c[1]
            dur = c[2] if len(c) > 2 else None
            role = c[3] if len(c) > 3 else ""
            why = c[4] if len(c) > 4 else ""
            pin = why.split("#")[1][:1] if "#" in (why or "") else ""
            evs.append({"t": t, "kind": kind, "dur": dur, "role": role, "why": why, "pin": pin, "group": g["name"]})
    evs.sort(key=lambda e: e["t"])
    # 密度：一段时间内 tick 太多时，去掉连发里非第一个的
    dropped = 0
    for kind, d in R.get("density", {}).items():
        win, mx = d["per_seconds"], d["max"]
        keep, recent, last_t = [], [], {}
        for e in evs:
            if e["kind"] != kind:
                keep.append(e)
                continue
            recent = [x for x in recent if e["t"] - x < win]
            in_run = e["t"] - last_t.get(e["group"], -99) < R.get("run", {}).get("window", 1.5)
            last_t[e["group"]] = e["t"]
            if len(recent) >= mx and in_run:
                dropped += 1
                continue
            recent.append(e["t"])
            keep.append(e)
        evs = keep
    # 连发：同一段同一场合 window 秒内接连出现，音高逐个升高
    run_keys, rstate = set(R.get("run", {}).get("roles", [])), {}
    for e in evs:
        key = "%s.%s" % (e["kind"], e["role"])
        if key in run_keys:
            st = rstate.get((e["group"], key))
            n = st[1] + 1 if st and e["t"] - st[0] < R["run"]["window"] else 0
            rstate[(e["group"], key)] = (e["t"], n)
            e["rise"] = min(R["run"]["max"], n * R["run"]["step"])
    if a.plan:
        print("音效点 %d 个（密度规则去掉 %d 个）" % (len(evs), dropped))
        return
    total = a.total or (cj.get("totalFrames", 0) / fps) or (max(e["t"] for e in evs) + 1.5)
    buf = [0.0] * int(total * SR + 1)
    cache, used, counts = {}, {}, {}

    def load(v):
        if v["file"] not in cache:
            x = read_wav(os.path.join(base, v["file"]))
            m = v["m"]
            on = int(m["onset"] * SR)
            cache[v["file"]] = (x, on, int(m["peak_t"] * SR), max(abs(y) for y in x) or 1e-9)
        return cache[v["file"]]

    def place(v, t, kind, role, rng, rise=0.0):
        x, on, pk_i, pk = load(v)
        L = int(R["max_len"].get(kind, 0.8) * SR)
        seg = x[on:on + L]
        lead = (pk_i - on) / SR if kind in R.get("align_peak", []) else 0.0
        ratio = 1 + rise + (rng.uniform(-1, 1) * R["vary"]["pitch"] if not a.no_vary else 0)
        if abs(ratio - 1) > 1e-4:
            seg = resample(seg, ratio)
            lead /= ratio
        peak_db = 20 * math.log10(max(max(abs(y) for y in seg), 1e-9))
        if kind in R.get("peak_rel", {}):  # 稀疏短促的声音（按键）按峰值定：人声 + peak_rel，且不超过 peak_max
            g_db = min(a.voice + R["peak_rel"][kind], R.get("peak_max", -6)) - peak_db
        else:  # 其余按「50 ms RMS 的最大值 = 人声中位数 + rel_db」定
            g_db = a.voice + R["rel_db"].get(kind, 0) - rms50max(seg)
        g_db += R.get("role_gain_db", {}).get(role, 0) + a.gain
        g_db = min(g_db, R.get("peak_max", -6) - peak_db)  # 任何一个声音的峰值都不超过 peak_max
        if not a.no_vary:
            g_db += rng.uniform(-1, 1) * R["vary"]["gain_db"]
        gn = 10 ** (g_db / 20)
        n = len(seg)
        fo = min(int(0.06 * SR), n // 3)
        at = int((t - lead) * SR)
        for i in range(n):
            k = at + i
            if k < 0:
                continue
            if k >= len(buf):
                break
            y = seg[i] * gn
            if i < 48:
                y *= i / 48
            if i >= n - fo:
                y *= (n - i) / max(1, fo)
            buf[k] += y
        used[v["file"]] = v
        counts["%s·%s·%d号" % (kind, role, v["no"])] = counts.get("%s·%s·%d号" % (kind, role, v["no"]), 0) + 1

    keys = [v for v in pool["kinds"].get("key", {}).get("variants", []) if not v.get("disabled")]
    for i, e in enumerate(evs):
        rng = random.Random(_h(a.seed, i, e["t"]))
        if e["kind"] == "type":  # 打字：按键声轮换，相邻两下不同
            if not keys:
                continue
            tt, end, prev = e["t"], e["t"] + (e["dur"] or 1.0), None
            while tt < end:
                choices = [k for k in keys if k is not prev] or keys
                v = rng.choice(choices)
                place(v, tt, "key", "type", rng)
                prev = v
                tt += (1 / R["typing"]["rate"]) * (1 + rng.uniform(-1, 1) * R["typing"]["jitter"])
            continue
        kv = pool["kinds"].get(e["kind"])
        if not kv:
            continue
        v = None
        if e["pin"]:
            v = next((x for x in kv["variants"] if str(x["no"]) == e["pin"]), None)
        if v is None:
            v = plan.get((e["kind"], e["role"])) or plan.get((e["kind"], (R["roles"].get(e["kind"]) or [""])[0]))
        if v is None:
            continue
        place(v, e["t"], e["kind"], e["role"], rng, e.get("rise", 0.0))
    pk = max((abs(x) for x in buf), default=0)
    lim = 10 ** (-3 / 20)
    if pk > lim:
        sc = lim / pk
        buf = [x * sc for x in buf]
        print("· 峰值 %.1f dBFS 超过 -3，整体压低 %.1f dB" % (20 * math.log10(pk), 20 * math.log10(sc)))
        pk = lim
    write_wav(a.out, buf)
    print("✓ %s  时长 %.2f 秒，%d 个音效点（密度规则去掉 %d 个），峰值 %.1f dBFS" % (a.out, total, len(evs), dropped, 20 * math.log10(max(pk, 1e-9))))
    print("  " + "  ".join("%s×%d" % kv for kv in sorted(counts.items())))
    must = [v["credit"] for v in used.values() if v.get("credit")]
    with open(os.path.splitext(a.out)[0] + "_CREDITS.txt", "w", encoding="utf-8") as fh:
        fh.write("本条视频用到的音效里需要署名的：\n" + ("\n".join(must) if must else "（无）") + "\n")
    print("  需要署名 %d 条，已写入 %s" % (len(must), os.path.splitext(a.out)[0] + "_CREDITS.txt"))


def write_wav(path, buf):
    with open(path, "wb") as f:
        data = array.array("h", [int(max(-1.0, min(1.0, x)) * 32767) for x in buf]).tobytes()
        f.write(b"RIFF" + (36 + len(data)).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little")
                + (1).to_bytes(2, "little") + (1).to_bytes(2, "little") + SR.to_bytes(4, "little")
                + (SR * 2).to_bytes(4, "little") + (2).to_bytes(2, "little") + (16).to_bytes(2, "little")
                + b"data" + len(data).to_bytes(4, "little") + data)


def main():
    if "--pool" in sys.argv:
        ap = argparse.ArgumentParser()
        ap.add_argument("out", nargs="?")
        ap.add_argument("--pool", required=True)
        ap.add_argument("--cues", required=True)
        ap.add_argument("--seed", default="gk")
        ap.add_argument("--total", type=float)
        ap.add_argument("--gain", type=float, default=0.0)
        ap.add_argument("--voice-median", type=float, default=None, dest="voice")
        ap.add_argument("--no-vary", action="store_true")
        ap.add_argument("--plan", action="store_true")
        a = ap.parse_args()
        if a.voice is None:
            a.voice = -30.4
            print("· 没给 --voice-median，按 -30.4 dBFS 估算。先对不含音效的时间线导出跑 measure_mix.py 测一次，再带上这个值重跑。")
        if not a.out and not a.plan:
            sys.exit("要给输出 WAV 路径，或者加 --plan 只看分配")
        return pool_bed(a)
    ap = argparse.ArgumentParser()
    ap.add_argument("placement")
    ap.add_argument("out")
    ap.add_argument("--total", type=float)
    ap.add_argument("--gain", type=float, default=0.0)
    ap.add_argument("--kind-gain", nargs="*", default=[])
    ap.add_argument("--events")
    ap.add_argument("--seed", default="gk")
    ap.add_argument("--no-vary", action="store_true")
    a = ap.parse_args()

    pl = json.load(open(a.placement, encoding="utf-8"))
    base = os.path.dirname(os.path.abspath(a.placement))
    kind_of = {}
    if a.events:
        for e in json.load(open(a.events, encoding="utf-8"))["events"]:
            note = (e.get("note") or "").split()
            kind_of[e.get("id")] = note[-1] if note else ""
    kg = {}
    for kv in a.kind_gain:
        k, v = kv.split("=")
        kg[k] = float(v)
    if kg and not kind_of:
        sys.exit("--kind-gain 需要同时给 --events（用来知道每个事件是哪种音色）")

    items = pl.get("items", [])
    if pl.get("missing"):
        print("· 放置表里还有 %d 个事件没选定音效（missing），这些位置没有声音" % len(pl["missing"]))
    end = max([it["at"] + it["dur"] for it in items] or [0])
    total = a.total or end + 0.2
    buf = [0.0] * int(total * SR + 1)
    cache, counts = {}, {}
    for it in items:
        eid = it["event"].split()[0]
        kind = kind_of.get(eid, "")
        path = os.path.join(base, it["file"])
        if path not in cache:
            cache[path] = read_wav(path)
        src = cache[path]
        s0 = int(it["trim_in"] * SR)
        seg = src[s0: s0 + int(it["dur"] * SR)]
        g_db = it.get("gain_db", 0) + a.gain + kg.get(kind, 0)
        if not a.no_vary:
            r = random.Random(zlib.crc32(("%s|%s" % (a.seed, eid)).encode()))
            seg = resample(seg, 1 + r.uniform(-0.02, 0.02))
            g_db += r.uniform(-1.5, 1.5)
        g = 10 ** (g_db / 20)
        fo = int(it.get("fade_out", 0.05) * SR)
        n = len(seg)
        at = int(it["at"] * SR)
        for i in range(n):
            k = at + i
            if k < 0:
                continue
            if k >= len(buf):
                break
            v = seg[i] * g
            if i >= n - fo and fo > 0:
                v *= (n - i) / fo
            if i < 48:  # 1 ms 淡入，防止裁头处爆点
                v *= i / 48
            buf[k] += v
        counts[kind or it["file"]] = counts.get(kind or it["file"], 0) + 1
    pk = max((abs(x) for x in buf), default=0)
    lim = 10 ** (-3 / 20)
    if pk > lim:
        sc = lim / pk
        buf = [x * sc for x in buf]
        print("· 峰值 %.1f dBFS 超过 -3，整体压低 %.1f dB" % (20 * math.log10(pk), 20 * math.log10(sc)))
        pk = lim
    with open(a.out, "wb") as f:
        data = array.array("h", [int(max(-1.0, min(1.0, x)) * 32767) for x in buf]).tobytes()
        f.write(b"RIFF" + (36 + len(data)).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little")
                + (1).to_bytes(2, "little") + (1).to_bytes(2, "little") + SR.to_bytes(4, "little")
                + (SR * 2).to_bytes(4, "little") + (2).to_bytes(2, "little") + (16).to_bytes(2, "little")
                + b"data" + len(data).to_bytes(4, "little") + data)
    print("✓ %s  时长 %.2f 秒，%d 个音效，峰值 %.1f dBFS" % (a.out, total, len(items), 20 * math.log10(max(pk, 1e-9))))
    print("  " + "  ".join("%s×%d" % kv for kv in sorted(counts.items())))


if __name__ == "__main__":
    main()
