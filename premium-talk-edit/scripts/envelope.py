#!/usr/bin/env python3
"""把音频/视频转成 10 ms RMS 包络（int16 量纲），存成 JSON 数组。

用法: envelope.py <media> <out.json>
依赖: macOS 自带 afconvert（没有 ffmpeg 也能跑）；有 ffmpeg 时自动回退使用。
包络第 i 个值对应源文件 i*0.01 秒处。经验阈值：>=80 算有声，>=300 算清晰语音。
"""
import array, json, math, os, shutil, subprocess, sys, tempfile, wave


def to_wav16k(src, dst):
    if shutil.which("afconvert"):
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@16000", "-c", "1", src, dst], check=True)
    elif shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ac", "1", "-ar", "16000", dst], check=True)
    else:
        sys.exit("需要 afconvert 或 ffmpeg")


def envelope(wav_path):
    w = wave.open(wav_path)
    sr, n = w.getframerate(), w.getnframes()
    a = array.array("h")
    a.frombytes(w.readframes(n))
    win = sr // 100
    out = []
    for i in range(0, len(a) - win + 1, win):
        s = 0
        for x in a[i:i + win]:
            s += x * x
        out.append(round(math.sqrt(s / win)))
    return out


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    tmp = os.path.join(tempfile.mkdtemp(), "a.wav")
    to_wav16k(sys.argv[1], tmp)
    env = envelope(tmp)
    json.dump(env, open(sys.argv[2], "w"))
    print(f"{len(env) / 100:.2f}s, {len(env)} 帧包络 -> {sys.argv[2]}")
