#!/usr/bin/env python3
"""把组件库复制到 ChatCut 项目的 workspace/mg/（不删除任何文件；已有的 theme.jsx 默认保留，免得覆盖用户选好的风格）。

用法: install_mg.py <projectPath> [--force-theme] [--demo]
  projectPath: read_project 返回的 projectHome.projectPath
              （~/Library/Application Support/ChatCut/projects/<projectId>/project.chatcutproject）。
复制的文件: assets/mg/ 下的 theme / lib / scenes / scenes_a / scenes_b / scenes_c .jsx（gallery、combos 是演示用，加 --demo 才复制）。
之后每段动效写成 workspace/mg/<段名>.jsx，和这些文件放在同一个目录。
"""
import argparse, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "assets", "mg"))
CORE = ["lib.jsx", "scenes.jsx", "scenes_a.jsx", "scenes_b.jsx", "scenes_c.jsx", "theme.jsx"]
DEMO = ["gallery.jsx", "combos.jsx"]

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--force-theme", action="store_true", help="theme.jsx 已存在也覆盖")
ap.add_argument("--demo", action="store_true", help="同时复制 gallery.jsx / combos.jsx（演示合集）")
a = ap.parse_args()
if not os.path.isdir(a.project):
    sys.exit("找不到项目目录 %s（要用 read_project 返回的 projectPath）" % a.project)
dst = os.path.join(a.project, "workspace", "mg")
os.makedirs(dst, exist_ok=True)
for fn in CORE + (DEMO if a.demo else []):
    d = os.path.join(dst, fn)
    if fn == "theme.jsx" and os.path.exists(d) and not a.force_theme:
        print("保留已有的 theme.jsx（你选好的风格）")
        continue
    shutil.copyfile(os.path.join(SRC, fn), d)
    print("复制", fn)
print("完成 →", dst)
