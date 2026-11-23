import React from "react";
import { Scene } from "./scenes.jsx";
// 版式 B：大数字卡。countSay：说到「三年」时数字开始跳；这句话说了两次「三年」，写 #2 取第 2 次。panelOut:false 表示底色和人物位置不收起，接着下一张 B 卡。
const SPEC = /*SPEC*/ {"scene": "number", "dur": 3.1, "kicker": "普通诉讼时效", "title": "借出去的钱，最多能等多久", "value": 3, "unit": "年", "countSay": "三年#2", "labels": ["第 1 年", "第 2 年", "第 3 年到期"], "segAt": [1.2, 1.6, 2.0], "warnLast": true, "source": "来源：示例内容，仅演示版式", "panelOut": false, "countAt": 0.35} /*END*/;
export default function Seg() { return <Scene spec={SPEC} />; }
