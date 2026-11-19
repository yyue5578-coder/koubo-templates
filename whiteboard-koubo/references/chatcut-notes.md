# ChatCut 操作备忘

参数以 ChatCut `list_tools(category)` 返回的 inputSchema 为准，这里只记容易踩的坑。内容来自 2026-11 的实操，ChatCut 更新后个别细节可能变化，以工具实际返回为准。

## 调用方式

- **Claude Code、Codex 等直接连 ChatCut MCP 的宿主**：直接调用 ChatCut 的工具（`create_project`、`push_asset` …）。
- **Cindy**：ChatCut 是一个插件。先用 `ghost_info({ghost_id:"chatcut-desktop"})` 查到它的实际身份，把返回的 `namespace` 原样带上（不要写死），再用 `ghost_call` 的 `tool:"call_tool"`、`args:{name:"<工具>", args:{...}}` 调用。
- 不确定参数时先查 schema：`list_tools`，`category` 取 `project` / `assets` / `timeline` / `captions` 等。

通用要点：

- **每个工具都要带 `projectId`**（`create_project` 返回，记下来）。
- **`projectId` 用工具返回的完整 id**，不要截短、不要自己补位（如 `xxxxxxxx-0000-0000-…`），否则报「Project … was not found」。
- **报错先看报错文字再重试**，ChatCut 的报错会写明缺什么、该怎么传；同样的参数原样重试只会再错一次。每次工具出错，ChatCut 都会写一份错误报告，有的宿主会因此弹出文件确认。
- **不要一段一段地挪人物片段。** 要整体调整人物片段的位置或时长时，把 V2（和联动音频）整条删掉，按 `adds.json` 一次重铺；逐条 `edit_item` 改位置、尤其同时带 transform/keyframes 时，片段可能被切成碎块、顺序打乱。每次批量改完都用 `read_project` 数一下 V2 的段数，和 `cut.json` 对不上就立刻重铺。`final_check.py` 的「人物片段没有碎块」也会报。
- **id 会变**：`split_item`、删除、改字幕样式或分组之后，旧的片段 id、字幕 card id 可能失效（报「Item … was not found」），先重新读再改。
- **转写只做一次**：素材已有转写时，`trigger_transcript` / `manage_transcript` 会报已存在，直接用现有的；确实要重转才带 `replace:true`。
- **返回结果常常很大**（`read_project` 约 70 KB，`edit_item` 一次加几十条、`read_captions` 一页都有几十 KB），宿主可能把它存成文件，用 python 解析。`edit_item` 写入人物片段后，把返回里每段视频和联动音频的 id 存一份 `items.json`，后面改圆圈、切分、对齐音效都要用。
- **图片可能不经工具通道返回**：返回文本里有 `saved <路径>.jpg` 或 `sheets`/`framesDirectory` 时，从那个路径读图。

## 路径一律从工具返回里取

不要自己拼 `~/Library/...` 之类的路径，不同系统、不同版本的 ChatCut 存放位置不一样。

| 要什么 | 从哪取 |
|---|---|
| 项目目录、工作目录 | `read_project` 返回的 `projectHome.projectPath`、`projectHome.workspacePath`（`list_projects` 也给 `projectPath`）。`timeline_words.py`、`final_check.py` 读 `projectPath` 下的 `timelines/*.json`（当前时间线），读不到时会提示改用抽帧人工核对 |
| 转写逐词时间 | `scripts/words_from_project.py <workspacePath> <assetId>` → `words.json`（它在 `workspacePath/transcription/<assetId>/` 下找 `raw-result.json`）。找不到时用 `inspect_asset` 的 `transcriptRanges` |
| 动效源码、音效文件 | 自己放进 `workspacePath` 下的 `mg/`、`sfx/` |
| 时间线抽帧 | `preview_timeline` 的 `views:["viewer"]` + `viewerFrames`，图存在返回的 `saved` 路径 |
| 成片或任意视频文件抽帧 | `inspect_asset` 的 `sources:[文件路径]` + `sourceTimes:[微秒整数…]`，返回 `sheets`（拼图）和 `framesDirectory`（单帧，最宽 1280 px） |
| 导出的成片 | `export` 时用 `outputPath` 指定放哪（例如用户的工作目录）；最终路径以 `track_progress target:"export"` 返回的 `outputPath` 为准（重名会自动加 `-v2`） |

## 轨道分工

| 轨道 | 内容 |
|---|---|
| V1 | 版式 B 的全屏动效（整板运镜时放 `scene_cues.py` 生成的 `cam_*.jsx`） |
| V2 | 人物（`build_cut.py` 生成的 adds 默认放这里；版式 B 段落改成圆圈参数） |
| V3 | 版式 A 的顶部卡片叠层 + 圆圈相框 `ring.jsx` |
| A1 | 音效（`sfx_bed.py` 生成的整条 WAV） |
| A2 | 人声（与 V2 联动的音频），它也是字幕轨 |

## 工具要点

| 工具 | 要点 |
|---|---|
| `create_project` | `compositionWidth/Height`、`openWindow:true` |
| `push_asset` | 一次一个文件。动效用 `type:"motion-graphic"`、`duration`（微秒）、`width/height`；音频直接给 WAV 路径。**动效源文件必须只 export 一个根组件**，否则报 "must export exactly one root component"——共用的子组件放进 `lib.jsx`。动效源文件和素材**实时关联**，改 `.jsx` 即更新，不用重新 push |
| `trigger_transcript` + `track_progress` | 转写走 ChatCut 云端识别，需要登录 ChatCut。`track_progress` 单次最多等 45 s，超时就再调一次继续等 |
| `split_item` | 在版式切换点把人物片段切开：`json` 是**字符串** `{"splits":[{"id":"…","atFrame":420}]}`（也可 `atFrames:[…]`），联动音频默认一起切（`includeLinked` 默认 true） |
| `edit_item` | `adds/updates/deletes`。**`deletes` 要传对象数组 `[{"id":...}]`，传字符串会报错**；`trackId` 可用别名 V1/V2/V3；`sourceIn` 单位微秒；`id` 可用 10 位前缀；改 `startFrame/durationFrames/sourceIn` 时，联动的音频要一起改（各自的 id） |
| `preview_timeline` | `viewerFrames:[...]` 出联络图；一次约 10 帧合适 |
| `inspect_asset` | `sourceTimes` 必须是**微秒整数**，传小数秒会报错 |
| `read_captions` | `trackId` 等参数放进 `json` 里传，不要和 `json` 并列。输出很大，用 python 解析（`result.mcpResult.structuredContent.cards`）；续读用返回的 `page.nextOffset`。**改了样式或分组后 card id 会变，要重新读** |
| `edit_captions` | **新项目要先 `action:"enable"`**，否则 `read_captions` 返回 `captions:null`。批量用 `action:"batch"` + `edits:[...]`，一次最多 100 条，且**一条失败全部不写**；写入要带最近一次读到的 `revision`。常用：`set_card_text`（改字）、`set_card_style`（`{opacity:0}` 隐藏；`mode:"replace"` + `style:{}` 清除覆盖）、`set_track_style`、`update_track`（layout） |
| `export` | `format:"video"`；后台渲染，用 `track_progress target:"export" action:"wait"` 等 |
| `search_fonts` | 查 ChatCut 能自动加载的字体（见下） |

## 字体

动效里的字体**只写字体名，不随包附带字体文件**。ChatCut 会按名字从 Google Fonts 字体库自动下载并缓存，第一次用时联网下载，之后离线也能用。

2026-11-18 在 ChatCut 里实测过三种做法：

| 做法 | 结果 |
|---|---|
| 只写字体名（本 Skill 的做法） | ✅ 一个从没用过的字体，导出第一帧就正确显示，预览也正常。国内网络直连可用（Google Fonts 有国内节点） |
| 字体文件用 `push_asset type:"font"` 装进系统 | ✅ 可用，但只有字体不在字体库里时才需要 |
| 随包附带字体文件，在动效里用 CSS `@font-face` 或 `FontFace` 加载 | ❌ 动效沙箱禁止 `document`/`FontFace`/`URL`；CSS 相对路径在预览里文字消失，导出时回退成宋体 |

开工时用 `search_fonts` 确认风格包（`theme.jsx`）里的标题字、手写字和正文字 `Noto Sans SC` 都在。出第一张样图时对照 theme.md 看一眼字形对不对（默认的手写字龙藏体是潦草的毛笔行书，标题马克笔体是粗黑的）；如果变成了宋体，说明字体没加载上（多半是网络），先解决再继续。

## 人物圆圈（版式 B）

画布 1080×1920，圆心 (770,1480)，直径 320。用户口头有时说「左下角」，其实指的就是这个圆圈，要确认。

版式 B 的起点或终点落在某个人物片段中间时，先用 `split_item` 在那一帧切开，再只改落在版式 B 里的那几段。

每个人物片段要先知道脸的中心和脸宽（人会动，每段各测一次），再用 `circle_layout.py <cx> <cy> --face-w <w> --src <源宽>x<源高>` 算 edit_item 参数：取以脸为中心、边长 S 的源像素正方形（S = 2.4 × 脸宽，不超过源画面宽度；头肩入画约为脸宽的 2.3–2.6 倍），k=320/S，width=源宽·k，height=源高·k，left=610−x0·k，top=1320−y0·k，crop* 由 x0/y0/S 算出，borderRadius=160。

找脸的两种方式：
- **macOS**：`swift scripts/faces.swift <视频> <源宽> <源高> t1 t2 … 2>/dev/null`，直接输出脸中心和脸宽（源像素）。
- **其他系统**：用 `inspect_asset` 的 `sourceTimes` 抽出该片段中间的一帧，看图估出脸框（单帧图最宽 1280 px，换算回源像素：× 源宽 / 图宽）。估完摆上去，用 `preview_timeline` 看那一帧的圆圈，脸不居中就微调 cx/cy 再算一次。

*为什么按脸宽算*：固定 S=820 时，换到脸更大的素材（脸宽 443–535 px），820 只有脸宽的约 1.6 倍，圆圈里只剩一张脸。

圆圈相框 `ring.jsx` 是 400×400 的动效，放在 left 570、top 1280（V3），样式跟风格包的 `frame` 走。`frame` 是 `polaroid`（拍立得）时人物要裁成方形：`circle_layout.py` 加 `--radius 8`。

人物的推镜头、轻震、全屏↔圆圈过渡用 `edit_item` 的 `keyframes`（`transform.x/y/width/height`、`cropTop/…`，帧号是时间线绝对帧），由 `scripts/person_moves.py` 生成，见 motion-graphics.md「人物镜头」。`borderRadius` 不能做关键帧。带 keyframes 的 `edit_item` 返回结果很大（每个点都回显整条曲线）。

改圆圈位置或大小时，三处要一起改：`lib.jsx` 的 `CIRCLE`、`circle_layout.py` 的 `--center/--d`、`ring.jsx` 的摆放位置。
