# 高级感干货风 · 新增卡片的写法

给想**新增一种卡片**的人（或 AI 助手）。组件库在 Skill 的 `assets/mg/`，剪片时复制到 ChatCut 项目的 `workspace/mg/`。
已有：`theme.jsx`（风格包）、`lib.jsx`（底座；缺什么在自己新建的批次文件里写私有小组件，不要改 lib 的已有导出）。

## 风格定位（必须守住）

专业、可信、克制。人是主角，卡片讲清楚就退场。
- 只有一个强调色（风格包里的 accent），警示红 `WARN` 只用在风险、错误、划掉。
- 不用：弹跳、旋转、抖动、闪白、彩虹渐变、emoji、花字、粗黑描边、卡通贴纸。
- 动效参数：进场 0.36s 缓出（用 lib 的 `io` / `In` / `CardBox`，自动跟风格包的 motion）；出场 0.24s 只淡出；列表逐项间隔 0.12s（`stagger`）；荧光笔/色块扫光 0.45–0.6s；数字计数 0.6s（`countUp`）。
- 数字用 `Num`（窄体）；引用原文用 `SERIF`；其余用 `SANS` / `Title`。
- 所有颜色从 `useK()` 取（`K.accent` `K.cardText` `K.cardMuted` `K.cardAc` `K.base` …），不要写死颜色（`WARN`、`INK`、`PAPER` 常量除外）。四种卡片质感（paper/slab/glass/line）和四种底色（含浅色 ivory）都要能看清。

## 画面区域（1080×1920，见 lib 的 SAFE / ZONE）

- 抖音遮挡：顶部 0–200、底部 1560 以下、右侧 x>960 且 y 820–1560。内容别放进去。
- **A 人物全屏**：叠层卡放在 y 230–640（脸在下面）；身份条、提示条这类小条可以放 y 1100–1250 或字幕下方 1380–1480，左对齐 x=72，宽 ≤ 840。字幕在 y≈1325（ZONE.subA）。
- **B 上卡下人**：场景自己画 `<Panel t a b>`（底色从上展开），卡片放 y 270–880、x 72、宽 936。人物由剪辑时下移，不归场景管。字幕在 y≈1478。
- **C 全屏讲解**：场景画整屏 `<BaseFill/>`，内容放 y 230–1240；左下 `CIRCLE`（x72 y1290 直径240）留给人物圆窗，不要放内容。字幕 y≈1330。
- 栏目标签 `<Tag/>` 在 y 214，A/B 场景顶部内容从 y≥270 开始就不会撞（A 的钩子类可以盖住标签，自己不画 Tag）。

## 场景写法

每个场景是一个组件 `function Xxx({ spec })`，内部用 `const { t, dur } = useT()` 取「段内秒」和段长。
- spec 是纯 JSON（键加双引号）。所有时间字段是段内秒：`at`（出现）、`markAt`、`strikeAt`… 默认值要合理（例如没给就按顺序每 0.6s 一项）。
- 统一字段：`"scene"`（场景名）、`"out"`（出场时间，默认 `dur - 0.3`）。B 场景另有 `"panelIn"`（默认 true：0 秒展开底色；false 表示上一段已展开）和 `"panelOut"`（默认 true：段尾收起；false 表示下一段接着用）。
- 文字太长要自动处理：用 `fitSize` 缩字号，或限制条数/截断，不能出卡片、不能竖排（容器加 `whiteSpace:"nowrap"` 或明确宽度）。
- 每个场景至少有一个「讲到那个字时发生」的动作（点亮、划线、计数、打勾…），时间由 spec 给。

## 新增一种卡片的步骤

1. 新建 `scenes_d.jsx`（或加到现有批次文件），导出两样：
```js
export const SCENES_D = {
  myscene: { C: MyScene, layout: "B", cn: "中文名", use: "一句话：口播说什么时用它", sfx: "音效建议" },
};
export const DEMOS_D = [ { "scene":"myscene", "dur":4.5, …示例内容… } ];  // 每种卡片至少 1 个示例，dur 3.5–6 秒
```
2. 在 `scenes.jsx` 里并入：`import { SCENES_D, DEMOS_D } from "./scenes_d.jsx"`，加进 `SCENES` 和 `DEMOS`。
3. 让脚本认识它：`scripts/gk_cues.py` 里有每个场景的字段表和音效规则（按场景名查），给新场景加一行字段表和一个生成音效点的函数，`gk_cues.py --check-jsx` 能对出 JSX 实际读取的字段。没加时脚本会提示「JSX 里有新场景 xxx，脚本还没有它的规则」，只是不检查、不配音效。
4. 示例里的文字要像真实口播会说的话，专业但口语；示例仅演示版式，可写「示例」来源，不要写成真实数据。

## 测试

建一个 ChatCut 测试项目，把 `theme.jsx`、`lib.jsx`、你的批次文件复制到 `workspace/mg/`，再写一个只 export 一个默认组件的 `test.jsx`：按 DEMOS 依次用 `<Sequence>` 播放每个场景，底下垫一个占位人物背景（深色渐变 + 简单头肩轮廓，B 场景时把轮廓下移 200px），右上角小字标场景名。`push_asset` 成 motion-graphic，放到时间线，用 `preview_timeline` 抽「出场中」和「静止后」的帧逐个看，修到没有重叠、出界、文字挤压。再用 `ThemeProvider` 换至少两套风格（如 `{card:"glass",accent:"jade",base:"midnight"}` 和 `{card:"slab",accent:"wine",base:"ivory",title:"serif",num:"bebas"}`）抽帧看一遍。

已知坑：
- `<Sequence>` 里 `useVideoConfig().durationInFrames` 是整条合成的长度，不是这一段的，场景要用 `spec.dur`。
- 一个 motion-graphic 文件只能 export 一个根组件。
- 站酷小薇字体会把「回」字渲染成实心方块，不要用。
- 银灰强调色接近白色，卡片上的强调字用 `K.cardAc`，不要直接用 `K.accent`；酒红配色下警示色是 `K.warn`，不要写死红色。
