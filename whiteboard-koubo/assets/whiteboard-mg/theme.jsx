// 风格包：每个创作者第一次用时挑一次，之后每条视频沿用，让大家的片子不撞款。
// 这里是 Skill 自带的默认值：用户挑好的风格包存在 ~/.whiteboard-koubo/theme.jsx（Skill 更新不会丢），这个文件不要改。
// 可选值见 references/theme.md；改完这里，lib.jsx / scenes.jsx / ring.jsx 全部跟着变。
// 字体只写名字（ChatCut 会自动下载），不要在这里放字体文件。
export const THEME = {
  paper: "grid",              // 纸张：grid 方格本 | lines 横线本 | dots 点阵本 | kraft 牛皮纸 | cork 软木板 | plain 素白纸
  palette: "classic",         // 配色：classic 经典便签 | macaron 马卡龙 | retro 复古 | contrast 高对比 | morandi 莫兰迪 | mono 黑白一色
  title: "LXGW Marker Gothic",// 标题字体：LXGW Marker Gothic 马克笔 | ZCOOL KuaiLe 快乐体 | ZCOOL QingKe HuangYou 黄油体
  hand: "Long Cang",          // 手写字体：Long Cang 龙藏体 | Ma Shan Zheng 马善政 | Zhi Mang Xing 智莽行 | ZCOOL KuaiLe 快乐体
  frame: "tape",              // 人物圆圈相框：tape 胶带 | clip 回形针 | polaroid 拍立得 | doodle 手绘圈 | plain 细线
  note: "tape",               // 便签款式：tape 胶带 | sticky 便利贴 | pin 图钉 | masking 美纹纸胶带 | torn 撕下的本子纸 | fold 折角 | clip 回形针 | mix 混搭
  motion: "pop",              // 元素出场：pop 弹出 | slide 侧滑贴上 | drop 从上落下
  sound: "marker",            // 书写音效：marker 马克笔 | pencil 铅笔 | synth 旧的合成音（只影响音效，scene_cues.py 会读这里）
  camera: "page",             // 镜头：page 每段动效单独一页 | board 整片一块白板，切段时镜头在板上移动，写过的内容都留着
  tilt: 1,                    // 便签、卡片歪斜程度：0 端正 … 1 默认 … 2 很随意
  seed: "my-channel",         // 随机种子：每条视频换成视频名，同一风格下每条的角度、位置略有不同
};
