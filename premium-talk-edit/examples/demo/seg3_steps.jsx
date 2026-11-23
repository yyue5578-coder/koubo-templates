import React from "react";
import { Scene } from "./scenes.jsx";
// 版式 B：步骤卡（panelIn:false 接上一张 B 卡，底色已展开）。每一步的 say 是「第一步」「第二步」「第三步」，卡片在说到那几个字时点亮；endSay 是收尾打勾。
const SPEC = /*SPEC*/ {"scene": "steps", "dur": 6.7, "kicker": "时效快到了", "title": "按这 3 步走", "items": [{"t": "留好证据", "d": "借条、转账记录、聊天记录", "say": "第一步", "at": 0.52}, {"t": "及时催收", "d": "书面催告，保留送达证明", "say": "第二步", "at": 2.48}, {"t": "必要时起诉", "d": "中断时效，别拖", "say": "第三步", "at": 4.21}], "endSay": "别拖", "panelIn": false, "endAt": 6.13} /*END*/;
export default function Seg() { return <Scene spec={SPEC} />; }
