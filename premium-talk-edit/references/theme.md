# 风格包

风格包是项目里 `workspace/mg/theme.jsx` 的一组值，改这里，`lib.jsx` 和所有卡片都跟着变。每个账号第一次用时挑一次，之后每条视频沿用；每条视频只改 `seed` 和 `column`。

```js
export const THEME = {
  accent: "gold",      // 强调色
  base: "ink",         // 底色（上卡下人的底、玻璃卡、片尾）
  card: "paper",       // 信息卡质感
  title: "sans",       // 标题字体
  num: "barlow",       // 数字字体
  motion: "rise",      // 进场方式
  subtitle: "shadow",  // 演示合集里字幕条的样式
  tag: "bar",          // 栏目标签样式
  column: "栏目名 · 第1期", // 栏目标签文字
  seed: "my-channel",  // 每条视频换成视频名
};
```

## 可选值

| 项 | 可选值 |
|---|---|
| `accent` 强调色 | gold 暖金 · jade 青瓷绿 · azure 雾蓝 · wine 酒红 · coral 珊瑚橙 · silver 银灰 |
| `base` 底色 | ink 墨黑 · midnight 深海蓝 · forest 墨绿 · ivory 象牙白（浅色版） |
| `card` 卡片质感 | paper 纸白圆角 · glass 深色玻璃 · line 细线框 · slab 直角厚卡（左侧色条） |
| `title` 标题字体 | sans 思源黑体 · serif 思源宋体（粗） · elegant 思源宋体细（文艺、留白多） |
| `num` 数字字体 | barlow 窄体 · oswald 粗窄体 · bebas 海报体 · serif 衬线数字 |
| `motion` 进场 | rise 上移淡入 · mask 遮罩升起 · slide 侧滑 · scale 轻缩放 · wipe 从左擦开 |
| `subtitle` 字幕样式 | shadow 白字投影 · bar 半透明底条 · outline 细描边 · lowkey 小字低调 |
| `tag` 栏目标签 | bar 竖条 · chip 胶囊 · line 下划线 · none |

组合约 9.2 万种。

## 6 套推荐组合（预览图 `assets/previews/themes.jpg`）

| 名称 | 设置 |
|---|---|
| 经典墨金 | `base:"ink", accent:"gold", card:"paper", title:"sans", num:"barlow", motion:"rise", subtitle:"shadow", tag:"bar"` |
| 深海雾蓝 | `base:"midnight", accent:"azure", card:"glass", title:"sans", num:"oswald", motion:"slide", subtitle:"bar", tag:"chip"` |
| 墨绿青瓷 | `base:"forest", accent:"jade", card:"slab", title:"serif", num:"serif", motion:"mask", subtitle:"shadow", tag:"line"` |
| 象牙酒红 | `base:"ivory", accent:"wine", card:"glass", title:"serif", num:"bebas", motion:"wipe", subtitle:"outline", tag:"bar"` |
| 珊瑚暖调 | `base:"ink", accent:"coral", card:"glass", title:"elegant", num:"barlow", motion:"scale", subtitle:"lowkey", tag:"chip"` |
| 银灰极简 | `base:"ink", accent:"silver", card:"line", title:"sans", num:"oswald", motion:"rise", subtitle:"outline", tag:"line"` |

用户说「我要深海雾蓝」时，把对应那一行的值写进 `theme.jsx`（保留 `column`、`seed`），不要改别的。

## 配色规则（`lib.jsx` 自动处理）

- **酒红（wine）**：警示色（打叉、划掉线、风险提示条、数字 warn）自动从红色换成琥珀橙，免得和强调色混。
- **银灰（silver）**：强调色接近白色，所以字幕关键词改成「反白」（银底深字小块），字幕数字加下划线，浅色卡上的荧光笔改用深灰。
- 象牙白底（ivory）是浅色版：栏目标签、片尾、玻璃卡的文字颜色自动换成深色。

## 字体

靠 ChatCut 联网从 Google Fonts 按名字下载：Noto Sans SC、Noto Serif SC、Barlow Condensed、Oswald、Bebas Neue、DM Serif Display。断网时会回退成系统字体，样子会变。**不要用站酷小薇**（会把「回」字渲染成实心方块）。

## 素材自带字幕

有的素材画面里已经烧录了字幕。包里带一个像素特效 `assets/effects/subband.js`（带内强模糊 + 轻微压暗，上下边缘羽化），把那条横带糊掉，再用 ChatCut 的原生字幕盖上去。用法：

1. `push_asset`，`type:"pixel-effect"`，`filePath` 指向 `subband.js`，`name:"原字幕模糊条"`，`properties`：
   `[{"key":"center","label":"条带中心","type":"number","defaultValue":0.781,"min":0,"max":1,"step":0.001},{"key":"half","label":"半高","type":"number","defaultValue":0.03,"min":0,"max":0.2,"step":0.001},{"key":"feather","label":"羽化","type":"number","defaultValue":0.022,"min":0,"max":0.1,"step":0.001},{"key":"radius","label":"模糊半径（像素）","type":"number","defaultValue":26,"min":0,"max":80,"step":1},{"key":"dim","label":"压暗","type":"number","defaultValue":0.12,"min":0,"max":0.6,"step":0.01},{"key":"flip","label":"上下翻转坐标","type":"boolean","defaultValue":false}]`
2. 抽一帧看原字幕在画面高度的哪个位置，`center` 填那个比例（0 = 顶部，1 = 底部），`half` 约为字幕高度的一半。
3. `edit_item` 的 `adds`：`{"type":"pixel-effect","assetId":<上面返回的 id>,"targetItemId":<人物片段 id>}`，每个人物片段一个。
4. B 版式人物下移后，原字幕会被卡片和字幕条盖住一部分，抽帧确认没有糊条漏出来。
