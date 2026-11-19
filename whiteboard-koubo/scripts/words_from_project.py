#!/usr/bin/env python3
"""从 ChatCut 项目里取出某个素材的转写结果，拍平成 words.json（逐词，毫秒）。

用法: words_from_project.py <workspacePath> <assetId 或前缀> [-o words.json]

  workspacePath: ChatCut read_project 返回的 projectHome.workspacePath（不要自己拼路径，
    不同系统、不同版本的 ChatCut 存放位置可能不同）。
  assetId: push_asset 返回的素材 id，10 位前缀也行。
  会在 <workspacePath>/transcription/<assetId>/ 下找 raw-result.json，有多份时取最新的一份。
输出: [{"start": ms, "end": ms, "text": "..."}]，给 islands.py / build_cut.py 用。
找不到时说明转写还没完成（track_progress target:"transcription" 等它），或 ChatCut 改了存放结构，
此时改用 inspect_asset 的 transcriptRanges 读逐词时间。
"""
import argparse, glob, json, os, sys
if hasattr(sys.stdout, "reconfigure"):  # Windows 控制台/管道默认 GBK，打印中文符号会崩
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ap = argparse.ArgumentParser()
ap.add_argument("workspace")
ap.add_argument("asset")
ap.add_argument("-o", "--out", default="words.json")
a = ap.parse_args()

root = os.path.join(a.workspace, "transcription")
dirs = [d for d in glob.glob(os.path.join(root, a.asset + "*")) if os.path.isdir(d)]
if len(dirs) > 1:
    sys.exit("assetId 前缀 %s 对应多个素材，请给完整 id：\n  " % a.asset + "\n  ".join(os.path.basename(d) for d in dirs))
files = glob.glob(os.path.join(dirs[0], "**", "raw-result.json"), recursive=True) if dirs else []
if not files:
    sys.exit("没找到 %s 的转写结果（%s）。转写可能还没完成；或 ChatCut 改了存放结构，改用 inspect_asset transcriptRanges。" % (a.asset, root))
path = max(files, key=os.path.getmtime)
d = json.load(open(path, encoding="utf-8"))
words = [w for u in d.get("utterances", []) for w in u.get("words", [])]
if not words:
    sys.exit("转写结果里没有逐词时间：%s" % path)
json.dump(words, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
print("%d 个词，%.1f–%.1f s → %s\n来源: %s" % (len(words), words[0]["start"] / 1000, words[-1]["end"] / 1000, a.out, path))
