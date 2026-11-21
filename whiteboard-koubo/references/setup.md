# 环境安装引导

面向第一次用的人。官方信息以 [ChatCut 桌面端安装指南](https://chatcut.io/desktop) 为准（2026-11-18 核对）。

## 1 安装 ChatCut Desktop

支持 macOS 13 或更新版本（Apple Silicon 或 Intel），Windows 10 或更新版本（x64）。暂不支持 Linux。

先读官方指南 `https://chatcut.io/desktop` 并照着做（网页工具只返回摘要时，用 `curl -fsSL https://chatcut.io/desktop` 取全文；Windows PowerShell 里用 `curl.exe`）。官方安装命令：

| 系统 | 命令 |
|---|---|
| macOS | `curl -fsSL https://chatcut.io/install.sh \| sh` |
| Windows（PowerShell） | `irm https://chatcut.io/install.ps1 \| iex` |

- 运行前告诉用户这条命令会下载并安装 ChatCut，得到同意再运行。宿主有权限确认时走权限确认；无法代为运行时，把命令原样给用户自己运行。
- 只用官方安装脚本，不要从别处下载安装包，也不要关闭系统的签名检查。
- 已经是最新版时脚本会直接复用，不会重复安装。
- 安装后会自动打开 ChatCut，并自动连接这台电脑上的 Claude Code、Codex、WorkBuddy 等智能体。其他智能体在 ChatCut 里打开 **Agents on this computer → Connect any agent** 按提示设置。

## 2 登录

脚本会打开浏览器登录页，**由用户自己登录**，不要代填账号密码。转写走 ChatCut 云端识别，必须登录。

## 3 新开对话继续

智能体只在对话开始时加载 ChatCut 的工具，安装用的这个对话里不会出现。给用户一段可以直接粘贴到新对话的提示，例如：

> 用白板便签风帮我剪口播。素材在 `<素材路径>`，脚本原文在 `<脚本路径或「没有」>`。

新对话里还是没有 ChatCut 工具，多半是还没登录：先在 ChatCut 里登录，再开一个新对话。重装解决不了。

## 4 Python 3 和 ffmpeg（ffmpeg 仅 Windows 需要）

| | macOS | Windows |
|---|---|---|
| Python 3 | 系统一般自带 `python3`；没有时运行 `xcode-select --install` | `winget install Python.Python.3.12`，装好后重开终端 |
| ffmpeg | 不用装（脚本自动用系统自带的 afconvert）；非要装才用 `brew install ffmpeg` | `winget install Gyan.FFmpeg`，装好后重开终端 |

## 5 WorkBuddy 频繁弹出「删除文件」确认

WorkBuddy 的安全设置会拦下工作目录以外的删除操作，等用户点同意。剪辑时常见两种：

- **ChatCut 日志文件夹里的锁文件**（路径里有 `ChatCut/logs/mcp-failures/`，文件名如 `.sender-lock`）：这是 ChatCut 在某次工具调用出错后写错误报告时删的，不是本 Skill 删的，同意即可。想不再弹出，请用户在 WorkBuddy 的安全设置（安全中心的文件规则）里，给 macOS 的 `~/Library/Application Support/ChatCut/logs/` 加一条允许删除的规则。只放行 `logs/`，不要放行整个 ChatCut 文件夹（里面有项目文件）。
- **项目里的文件**：本 Skill 要求覆盖写入、不删文件；如果还是弹出，说明哪一步先删后建了，改成直接覆盖。

工具调用出错越少，弹窗越少：出错时先读报错文字，按提示改参数再调（见 chatcut-notes.md「通用要点」）。

## 费用

按官方 [积分说明](https://chatcut.io/zh/docs/credits-policy)：上传素材、手动编辑时间线、**转写**、字幕编辑和导出都不消耗 ChatCut 积分。用 Claude Code、Codex 等外部智能体操作 ChatCut 时，智能体的推理用的是它自己的套餐或 API 额度。本 Skill 不调用 ChatCut 的付费生成（视频、图片、音乐、配音），音效由本地代码合成。
