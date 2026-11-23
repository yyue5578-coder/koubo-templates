import React from "react";
import { Scene } from "./scenes.jsx";
// 版式 A：反常识钩子。strikeSay / bSay / markSay 写口播原话，gk_cues.py 会换算成 strikeAt / bAt / markAt。
const SPEC = /*SPEC*/ {"scene": "hookFlip", "dur": 6.2, "kicker": "借钱不还的注意", "x": "借钱不还就没事了", "y": "最多只能等三年", "strikeSay": "其实", "bSay": "借出去", "markSay": "三年", "strikeAt": 3.29, "bAt": 3.71, "markAt": 5.81} /*END*/;
export default function Seg() { return <Scene spec={SPEC} />; }
