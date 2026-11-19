import React from "react";
import { useT, ramp, C, THEME } from "./lib.jsx";

// 人物圆圈的相框（放在人物上层），样式来自 THEME.frame：tape 胶带 | clip 回形针 | polaroid 拍立得 | doodle 手绘圈 | plain 细线
// 400×400，放在画布 left 570、top 1280；圆心对应 (770,1480)、人物圆半径 160。
const tapeBg = (c) => ({ background: c, backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.28) 0 7px, transparent 7px 14px)", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" });

function Frame({ kind }) {
  if (kind === "clip")
    return (
      <>
        <circle cx="200" cy="200" r="165" fill="none" stroke="#FFFFFF" strokeWidth="10" style={{ filter: "drop-shadow(0 6px 10px rgba(60,50,30,0.25))" }} />
        <path d="M 262 18 L 262 92 C 262 112 236 112 236 92 L 236 34 C 236 22 250 22 250 34 L 250 86" fill="none" stroke="#9AA3AD" strokeWidth="7" strokeLinecap="round" />
      </>
    );
  if (kind === "polaroid")
    return (
      <>
        {/* 拍立得：人物要改成方形（circle_layout.py --radius 8），框底边加厚 */}
        <rect x="27" y="27" width="346" height="380" rx="4" fill="none" stroke="#FFFFFF" strokeWidth="24" style={{ filter: "drop-shadow(0 8px 14px rgba(60,50,30,0.3))" }} />
        <rect x="36" y="358" width="328" height="40" fill="#FFFFFF" />
      </>
    );
  if (kind === "doodle")
    return (
      <>
        <circle cx="200" cy="200" r="166" fill="none" stroke={C.ink} strokeWidth="5" strokeLinecap="round" strokeDasharray="980 60" transform="rotate(-40 200 200)" />
        <circle cx="203" cy="197" r="178" fill="none" stroke={C.red} strokeWidth="4" strokeLinecap="round" strokeDasharray="700 400" transform="rotate(110 200 200)" />
        <path d="M 340 70 L 346 88 L 364 90 L 350 102 L 354 120 L 340 110 L 326 120 L 330 102 L 316 90 L 334 88 Z" fill={C.noteY} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
      </>
    );
  if (kind === "plain") return <circle cx="200" cy="200" r="163" fill="none" stroke={C.ink} strokeWidth="4" />;
  return (
    <>
      <circle cx="200" cy="200" r="165" fill="none" stroke="#FFFFFF" strokeWidth="12" style={{ filter: "drop-shadow(0 8px 12px rgba(60,50,30,0.25))" }} />
      <circle cx="200" cy="200" r="172" fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" strokeDasharray="900 200" transform="rotate(-70 200 200)" opacity="0.85" />
    </>
  );
}

export default function Ring() {
  const { t, dur } = useT();
  const a = ramp(t, 0, 0.2) * (1 - ramp(t, dur - 0.0001, dur));
  const kind = THEME.frame || "tape";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 400, height: 400, opacity: a }}>
      <svg width="400" height="400" viewBox="0 0 400 400" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <Frame kind={kind} />
      </svg>
      {kind === "tape" ? <div style={{ position: "absolute", left: 128, top: 18, width: 150, height: 40, transform: "rotate(-8deg)", ...tapeBg("rgba(255,201,194,0.88)") }} /> : null}
      {kind === "polaroid" ? <div style={{ position: "absolute", left: 60, top: -6, width: 120, height: 34, transform: "rotate(-14deg)", ...tapeBg("rgba(196,225,255,0.85)") }} /> : null}
    </div>
  );
}
