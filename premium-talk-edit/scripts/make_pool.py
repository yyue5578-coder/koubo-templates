#!/usr/bin/env python3
"""（维护者工具，剪片不需要）把 sfx 技能（另装的 Skill，用来在 Freesound 上找音效）取回的 24 个音效（8 类 × 3 个）整理成「音效池」：复制成 assets/sfx-pool/<音色>_<号>.wav，量测并写 pool.json 和 CREDITS.md。

用法: make_pool.py [--sfx <sfx 技能工程目录>/sfx] [--out ../assets/sfx-pool]
  --sfx: sfx 技能的工程目录下的 sfx/（里面有 candidates.json 和 audio/）。候选按 candidates.json 里每组的顺序编 1、2、3 号。
  --out: 音效池目录。已有的 pool.json 里手写的 disabled / note 会保留。
量测（只用标准库，不靠耳朵）：有效时长、起音位置（裁掉开头静音）、峰值时刻、峰值 dB、亮度（过零率，越大越「脆」）。
"""
import argparse, array, json, math, os, shutil, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gk_bed import read_wav, SR  # noqa: E402

KIND_OF_ACTION = {"transition": "whoosh", "card_in": "pop", "click": "tick", "impact": "hit",
                  "paper_slide": "swipe", "success": "ok", "error": "no", "typing": "key"}
CN = {"whoosh": "转场嗖声", "pop": "卡片弹出", "tick": "轻点", "hit": "数字落定", "swipe": "纸张/荧光笔",
      "ok": "完成提示", "no": "错误提示", "key": "按键"}


def measure(x):
    pk = max((abs(v) for v in x), default=0) or 1e-9
    thr = pk * 0.05  # 低于峰值 26 dB 算静音
    on = next((i for i, v in enumerate(x) if abs(v) >= thr), 0)
    off = len(x) - next((i for i, v in enumerate(reversed(x)) if abs(v) >= thr), 0)
    pi = max(range(len(x)), key=lambda i: abs(x[i])) if x else 0
    seg = x[on:off] or x
    zc = sum(1 for a, b in zip(seg, seg[1:]) if (a < 0) != (b < 0)) / max(1, len(seg)) * SR
    return {"onset": round(on / SR, 3), "end": round(off / SR, 3), "dur": round((off - on) / SR, 3),
            "peak_t": round(pi / SR, 3), "peak_db": round(20 * math.log10(pk), 1), "zcr": int(zc)}


def describe(kind, m, all_m):
    """按同类 3 个的相对量测给一句客观描述（不是听感判断）。"""
    durs = sorted(v["dur"] for v in all_m)
    zcs = sorted(v["zcr"] for v in all_m)
    d = "最短" if m["dur"] == durs[0] else "最长" if m["dur"] == durs[-1] else "中等长度"
    b = "最脆亮" if m["zcr"] == zcs[-1] else "最低沉" if m["zcr"] == zcs[0] else "中等明亮"
    return "%s（%.2f 秒）、%s（过零率 %d/秒）" % (d, m["dur"], b, m["zcr"])


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--sfx", default=os.path.join(here, "..", "sfx"))
    ap.add_argument("--out", default=os.path.join(here, "..", "assets", "sfx-pool"))
    a = ap.parse_args()
    cand = json.load(open(os.path.join(a.sfx, "candidates.json"), encoding="utf-8"))
    os.makedirs(a.out, exist_ok=True)
    old, old_rules = {}, None
    pj = os.path.join(a.out, "pool.json")
    if os.path.exists(pj):
        prev = json.load(open(pj, encoding="utf-8"))
        old_rules = prev.get("rules")
        for k, vs in prev.get("kinds", {}).items():
            for v in vs.get("variants", []):
                old[v["id"]] = v
    kinds, credits_must, credits_free = {}, [], []
    for g in cand["groups"]:
        kind = KIND_OF_ACTION.get(g["action"])
        if not kind:
            continue
        vs = []
        for i, c in enumerate(g["candidates"][:3], 1):
            num = c["id"].split(":")[1]
            src = os.path.join(a.sfx, "audio", "freesound-%s.wav" % num)
            if not os.path.exists(src):
                sys.exit("缺 %s：先用 sfx.py take 把这一个取回来" % src)
            dst = "%s_%d.wav" % (kind, i)
            shutil.copyfile(src, os.path.join(a.out, dst))
            m = measure(read_wav(src))
            need = c.get("license") not in ("cc0",)
            credit = '"%s" by %s ( %s ) licensed under %s' % (c["title"], c["author"], c["url"], c["license_label"]) if need else None
            v = {"no": i, "file": dst, "id": c["id"], "title": c["title"], "author": c["author"], "url": c["url"],
                 "license": c["license_label"], "credit": credit, "m": m,
                 "disabled": old.get(c["id"], {}).get("disabled", False), "note": old.get(c["id"], {}).get("note", "")}
            vs.append(v)
            (credits_must if need else credits_free).append("- %s_%d：%s" % (kind, i, credit or "%s｜%s｜%s｜%s" % (c["title"], c["author"], c["license_label"], c["url"])))
        for v in vs:
            v["desc"] = describe(kind, v["m"], [x["m"] for x in vs])
        kinds[kind] = {"cn": CN[kind], "variants": vs}
    out = {"_说明": "高级感干货风音效池：8 类音色各 3 个（来自 Freesound，经 sfx 技能取回）。挑选规则见 references/sfx.md，由 gk_bed.py --pool 执行。"
                    "听过觉得不合适的，把那一个的 disabled 改成 true（规则会自动跳过），note 写原因。",
           "kinds": kinds}
    if old_rules:
        out["rules"] = old_rules  # 挑选规则是手写的，重建音效池时保留
    with open(pj, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, "CREDITS.md"), "w", encoding="utf-8") as fh:
        fh.write("# 音效池署名清单\n\n用到下面「必须署名」的音效时，在视频简介或片尾写上署名。gk_bed.py 会按实际用到的列出来。\n\n## 必须署名\n\n")
        fh.write("\n".join(credits_must) or "（无）")
        fh.write("\n\n## 无需署名（CC0，存档备查）\n\n" + "\n".join(credits_free) + "\n")
    for k, v in kinds.items():
        print("%-6s %s" % (k, v["cn"]))
        for x in v["variants"]:
            print("   %d  %-46s %-10s %s" % (x["no"], x["title"][:46], x["license"], x["desc"]))
    print("✓ 写入 %s（%d 类）和 CREDITS.md" % (pj, len(kinds)))


if __name__ == "__main__":
    main()
