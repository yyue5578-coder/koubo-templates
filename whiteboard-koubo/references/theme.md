# 风格包：让每个人的片子不撞款

所有场景、便签、相框的样子都由 `theme.jsx` 里的 `THEME` 决定。同一套场景模板，换一组风格包就是另一种观感。

## 存在哪

| 文件 | 是什么 |
|---|---|
| Skill 里的 `assets/whiteboard-mg/theme.jsx` | 出厂默认值和全部选项的说明。**不要改它**：用户更新 Skill 时整个文件夹会被替换，写在这里的风格会丢 |
| `~/.whiteboard-koubo/theme.jsx`（Windows 上是 `%USERPROFILE%\.whiteboard-koubo\theme.jsx`） | 用户挑好的风格包，在 Skill 文件夹外面，更新不会丢 |
| 项目工作目录里的 `mg/theme.jsx` | 这条视频实际用的那一份 |

**每条视频开工时**：有 `~/.whiteboard-koubo/theme.jsx` 就复制它到项目 `mg/theme.jsx`；没有就是第一次用，按下面「第一次用」先挑风格包。然后对照 Skill 里的默认 `theme.jsx`，看保存的那份有没有缺项（Skill 更新后可能加了新选项）：缺的项照默认值补进保存的那份，并告诉用户「新版本多了某某选项，现在用默认的某某，想换可以说」。缺项不补也能渲染（用默认值），补上是为了下次不再提醒。

## 什么时候挑

- **第一次用本 Skill 时**：出版式样图之前，先让用户挑风格包。先给用户看 `assets/previews/combos.jpg`（6 套推荐组合的实拍样图；宿主能显示图片就直接展示，不能就告诉用户文件位置），想细调某一项时再给对应的 `options-paper.jpg`、`options-palette.jpg`、`options-fonts.jpg`、`options-frame.jpg`、`options-note.jpg`、`options-motion.jpg`、`options-camera.jpg`（整板运镜）。挑好后在 Skill 里的默认 `theme.jsx` 基础上改好，**保存到 `~/.whiteboard-koubo/theme.jsx`**（文件夹不存在就新建），以后每条视频直接沿用，这就是这个账号的「招牌」。告诉用户存在哪，以后想换风格说一声就行。
- **用户说「换个风格」「这条想不一样点」时**：只改这条视频项目里的 `mg/theme.jsx`，不动保存的那份，除非用户说以后都这样（那就同时改 `~/.whiteboard-koubo/theme.jsx`）。
- **每条视频**：把风格包复制到项目 `mg/` 后，只在项目里那份把 `seed` 改成这条视频的名字（保存的那份不改）。同一风格下，每条视频便签的角度、胶带位置、侧滑方向都会略有不同。

## 可选项

| 项 | 可选值 |
|---|---|
| `paper` 纸张 | `grid` 方格本（默认）· `lines` 横线本 · `dots` 点阵本 · `kraft` 牛皮纸 · `cork` 软木板 · `plain` 素白纸 |
| `palette` 配色 | `classic` 经典便签（默认）· `macaron` 马卡龙 · `retro` 复古 · `contrast` 高对比 · `morandi` 莫兰迪 · `mono` 黑白一色 |
| `title` 标题字体 | `LXGW Marker Gothic` 马克笔（默认）· `ZCOOL KuaiLe` 快乐体（圆润俏皮）· `ZCOOL QingKe HuangYou` 黄油体（粗壮醒目；笔画粘得紧，「白板」这类字小字号下容易看成别的字，出样图时逐字看一眼） |
| `hand` 手写字体 | `Long Cang` 龙藏体（默认，潦草）· `Ma Shan Zheng` 马善政（毛笔楷）· `Zhi Mang Xing` 智莽行（行草）· `ZCOOL KuaiLe` 快乐体（工整可爱） |
| `frame` 人物相框 | `tape` 胶带（默认）· `clip` 回形针 · `polaroid` 拍立得（人物改方形，见下）· `doodle` 手绘圈 · `plain` 细线 |
| `note` 便签款式 | `tape` 胶带（默认）· `sticky` 便利贴（无胶带、底边微翘）· `pin` 图钉 · `masking` 美纹纸胶带（两角斜贴）· `torn` 撕下的本子纸（毛边 + 横线）· `fold` 折角 · `clip` 回形针 · `mix` 混搭（每张便签按 seed 随机挑，软木板上多用图钉、牛皮纸上多用美纹纸和毛边） |
| `motion` 出场方式 | `pop` 弹出（默认）· `slide` 侧滑贴上 · `drop` 从上落下 |
| `camera` 镜头 | `page` 每段动效单独一页（默认）· `board` 整片一块白板：切段时镜头在板上平移到下一格，写过的内容都留着，还可以加一段拉远看整块白板的总览。做法见 motion-graphics.md「整板运镜」 |
| `sound` 书写音效 | `marker` 马克笔（默认）· `pencil` 铅笔 · `synth` 旧的合成音。只影响手写、划线、盖章的声音，见 sfx-and-captions.md |
| `tilt` 歪斜程度 | `0` 端正 … `1` 默认 … `2` 很随意 |
| `seed` 随机种子 | 任意文字，每条视频换成视频名 |

六种纸张 × 六套配色 × 三种标题字 × 四种手写字 × 五种相框 × 八种便签款式 × 三种出场，一共五万多种组合，再乘两种书写音效。`seed` 同时决定每条视频挑到哪几条音效录音。

字体都在 ChatCut 的字体库里，按名字自动下载，不用装。拍立得相框要把人物裁成方形：`circle_layout.py` 加 `--radius 8`。

## 推荐组合（给用户挑的时候用）

| 名字 | 一句话 | paper | palette | title | hand | frame | note | motion | sound |
|---|---|---|---|---|---|---|---|---|---|
| 经典笔记 | 方格本 + 黄色便签，干净的方法论笔记 | grid | classic | LXGW Marker Gothic | Long Cang | tape | tape | pop | marker |
| 复古手帐 | 牛皮纸 + 暖棕配色，像旧笔记本 | kraft | retro | ZCOOL KuaiLe | Ma Shan Zheng | doodle | mix | slide | pencil |
| 清新点阵 | 点阵本 + 马卡龙色，轻松可爱 | dots | macaron | ZCOOL QingKe HuangYou | ZCOOL KuaiLe | polaroid | sticky | drop | pencil |
| 软木看板 | 软木板 + 高对比色，像贴满便签的工作墙 | cork | contrast | ZCOOL QingKe HuangYou | Long Cang | clip | mix | drop | marker |
| 莫兰迪横线 | 横线本 + 低饱和色，安静克制 | lines | morandi | LXGW Marker Gothic | Ma Shan Zheng | tape | fold | slide | pencil |
| 极简黑白 | 素白纸 + 黑白，只靠排版和手写 | plain | mono | LXGW Marker Gothic | Zhi Mang Xing | plain | torn | pop | marker |

## 改风格包时注意

- 风格包只改「长什么样」，不改版面和安全区，换了以后不用重新检查放不放得下。
- 换了标题或手写字体后，各字体字宽略有差别，长标题可能比默认多折一行。出样图时看一眼。
- 单张便签也可以单独指定款式：`Note` 组件传 `kind="pin"` 等（手写段落用）。
- 牛皮纸、软木板的纹理是固定的矢量纹理（纤维、颗粒、木框），所有视频一样，不随 seed 变。直接写在这两种纸上的手写字会自动加一圈浅色描边，保证看得清。
- `camera` 和其他各项互不影响，任何一套组合都能开整板运镜。整板运镜时牛皮纸、软木板是一整张大纸，木框只在白板四周，拉远时才看得到。
- `mono` 配色把红色强调也变成黑色，划线、打叉靠形状区分，适合不想要彩色的人。
