#!/usr/bin/env python3
"""把 ChatCut 的转写原始结果拼成逐词时间文件 words.json（毫秒），给 islands.py / build_cut.py / timeline_words.py 用。

用法: words_from_raw.py <raw-result.json> [-o words.json]
  raw-result.json 在项目目录的 workspace/transcription/<assetId>/<id>/raw-result.json。
  里面 utterances[].words 是 {start, end, text}（毫秒）。
"""
import argparse, json, sys

ap = argparse.ArgumentParser()
ap.add_argument("raw")
ap.add_argument("-o", "--out", default="words.json")
a = ap.parse_args()
d = json.load(open(a.raw, encoding="utf-8"))
try:
    words = [w for u in d["utterances"] for w in u["words"]]
except (KeyError, TypeError):
    sys.exit("没找到 utterances[].words：这不是 ChatCut 的转写原始结果，或结构变了。")
json.dump(words, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
print("%d 个词 → %s（%.1f–%.1f 秒）" % (len(words), a.out, words[0]["start"] / 1000 if words else 0, words[-1]["end"] / 1000 if words else 0))
