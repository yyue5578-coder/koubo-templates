# ChatCut 操作备忘

参数以 ChatCut `list_tools(category)` 返回的 inputSchema 为准，这里只记容易踩的坑。

## 调用方式

- 宿主直接提供 ChatCut 的 MCP 工具时，工具名就是下面表里的名字。
- Cindy 里通过 `ghost_call`：`ghost_id:"chatcut-desktop"`，`namespace:"local"`，`tool:"call_tool"`，`args:{name:"<工具>", args:{...}}`。
- 不确定参数时用 `list_tools`（带 `category`）查 schema。

通用：
- **每个工具都要带 `projectId`**（新建项目时记下来）。**用工具返回的完整 id**，不要截短、不要自己补位，否则报「Project … was not found」。
- **报错先看报错文字再重试**，ChatCut 的报错会写明缺什么、该怎么传；同样的参数原样重试只会再错一次。
- **不要一段一段地挪人物片段。** 要整体调整人物片段的位置或时长时，把人物轨（和联动音频）整条删掉，按 `adds.json` 一次重铺；逐条改位置、尤其同时带 transform/keyframes 时，片段可能被切成碎块、顺序打乱。每次批量改完都 `read_project` 数一下人物轨的段数，和 `cut.json` 对不上就立刻重铺。`final_check.py` 的「人物片段没有碎块」也会报。
- **id 会变**：`split_item`、删除、改字幕样式或分组之后，旧的片段 id、字幕 card id 可能失效（报「Item … was not found」），先重新读再改。
- **转写只做一次**：素材已有转写时，`trigger_transcript` / `manage_transcript` 会报已存在，直接用现有的；确实要重转才带 `replace:true`。
- **返回结果常常很大**（`edit_item` 一次加几十条、写关键帧、`read_captions` 一页），可能被存成文件，用 python 解析。`edit_item` 写入人物片段后，把返回里每段视频和联动音频的 id 存成 `items.json`。
- **图片不一定经通道返回**：`preview_timeline` 返回里的图可能被替换成文字说明，从返回文本里的 `saved <路径>.jpg` 取图，再看。

## 项目目录

`~/Library/Application Support/ChatCut/projects/<projectId>/project.chatcutproject/`（Windows 上以 `read_project` 返回的 `projectHome.projectPath` 为准，不要自己拼路径）

- `workspace/transcription/<assetId>/<id>/raw-result.json`：转写原始结果（`utterances[].words`，毫秒）。
- `workspace/mg/`：动效源码放这里（组件库 8 个文件 + 每段一个 `.jsx`）。
- `timelines/*.json`：时间线（`timeline_words.py`、`gk_layout.py`、`final_check.py` 直接读）。`projectPath` 是 `read_project` 返回的 `projectHome.projectPath`。

## 轨道分工

| 轨道 | 内容 |
|---|---|
| V1 | 人物（`build_cut.py --track V1`）；B 版式靠关键帧下移 |
| V2 | 卡片叠层（每段一个 motion-graphic） |
| V3 | C 版式的人物圆窗片段（`gk_layout.py` 生成，必须在叠层之上） |
| A1 | 人声（与 V1 联动的音频），它也是字幕轨 |
| A2 | 音效（`gk_bed.py` 生成的整条 WAV） |
| A3 | 圆窗人物片段的联动音频（必须静音） |

## 工具要点

| 工具 | 要点 |
|---|---|
| `create_project` | `compositionWidth:1080`、`compositionHeight:1920`、`openWindow:true` |
| `push_asset` | 一次一个文件。素材视频 `type:"video"`（返回 `assetId`）；动效用 `type:"motion-graphic"`、`duration`（**微秒**）、`width/height`；音频直接给 WAV 路径；图片用 `type:"image"`；像素特效 `type:"pixel-effect"` + `properties`。**动效源文件必须只 export 一个根组件**（default），否则报 "must export exactly one root component"；共用的组件放组件库文件里。动效源文件和素材**实时关联**，改 `.jsx` 即更新，不用重新 push |
| `trigger_transcript` + `track_progress` | `track_progress` 单次最多等 45 s，超时就再调一次继续等 |
| `split_item` | `json` 是**字符串** `{"splits":[{"id":"…","atFrame":420}]}`；联动音频默认一起切 |
| `edit_item` | `adds/updates/deletes/keyframes`。**`deletes` 要传对象数组 `[{"id":...}]`，传字符串会报错**；`trackId` 可用别名 V1/V2/V3；`sourceIn` 单位微秒；`id` 可用 10 位前缀；改 `startFrame/durationFrames/sourceIn` 时，联动的音频要一起改（各自的 id）；静音用 `updates:[{"id":…,"muted":true}]` |
| `edit_item` 的 `keyframes` | `action` 取 `set`（`frame`+`value`）、`curve`（`frame`+`easing`，给这个点之后那一段设缓动）、`remove`（`frame`）、`delete`、`move`；`path` 如 `transform.y`；**关键帧的帧号必须落在所属片段内**，片段缩短后超出的点要先 remove；返回结果很大（每个点都回显） |
| `preview_timeline` | `viewerFrames:[...]` 出联络图；一次约 10 帧合适 |
| `read_captions` | `trackId` 等参数放进 `json` 里传，不要和 `json` 并列。输出很大。续读用返回的 `page.nextOffset`。**改了样式或分组后 card id 会变，要重新读** |
| `edit_captions` | **新项目要先 `action:"enable"`**，否则 `read_captions` 返回 `captions:null`。批量用 `action:"batch"` + `edits:[...]`，一次最多 100 条，且**一条失败全部不写**；写入要带最近一次读到的 `revision`。常用：`set_card_text`（改字）、`set_card_style`（`{opacity:0}` 隐藏）、`set_track_style`、`update_track`（layout） |
| `export` | `format:"video"` 或 `"audio"`（测人声、核对偏移时导音频）；后台渲染，用 `track_progress target:"export" action:"wait"` 等；产物默认在 `~/Movies/ChatCut/`，文件很大（几分钟的片子 100 MB 以上），发给手机前可压缩：macOS 用 `avconvert -s 成片.mp4 -p Preset1280x720 -o 小.mp4`，Windows 用 `ffmpeg -i 成片.mp4 -vf scale=720:-2 -c:v libx264 -crf 23 -c:a aac 小.mp4` |

## 人物圆窗（C 版式）

画布 1080×1920，圆窗在 x72、y1290、直径 240（左下，避开右侧按钮）。`gk_layout.py` 按脸中心和脸宽算 `left/top/width/height/crop*/borderRadius`（取以脸为中心、边长 2.4×脸宽的方块，头肩入画）。脸中心和脸宽用 `swift faces.swift <视频> 1080 1920 t1 t2 … 2>/dev/null` 量（人会动，取几个时刻的中位数；只在 macOS 能用，Windows 上用 `preview_timeline` 抽帧看图估）。

`gk_layout.py` 靠「时间线上片段数量最多的 (轨道, 素材)」认人物片段；全屏讲解（C）段很多、圆窗片段比人物片段还多时可能认错，这时加 `--asset <人物素材 id 前缀>` 指定。

改圆窗位置或大小时，三处要一起改：`assets/mg/lib.jsx` 的 `CIRCLE`、`scripts/gk_layout.py` 的 `CIRCLE`，以及卡片里避让圆窗的位置（C 场景已按 `CIRCLE` 避让）。

`borderRadius` 不能做关键帧，所以圆窗是单独一个裁好的片段，不是人物片段缩放出来的。
