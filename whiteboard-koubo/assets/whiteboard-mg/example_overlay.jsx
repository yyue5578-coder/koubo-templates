import React from "react";
import { C, MARK, HAND, BODY, useT, ramp, spr, Highlight, Hand, Strike, RectStamp, Note } from "./lib.jsx";

// 示例：文字、时间点都来自作者自己的一条口播视频，只用来演示写法。做你自己的片子时换成你实际说的话和时间。

// A0 overlay · 0 → 11.37s（人物全屏，顶部卡片）
export default function Hook() {
  const { t, dur } = useT();
  const p = spr(t, 0.1, 0.5);
  const out = 1 - ramp(t, dur - 0.25, dur);
  const phaseA = 1 - ramp(t, 5.25, 5.55);
  const phaseB = ramp(t, 5.45, 5.8);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: out }}>
      <div style={{ position: "absolute", left: 70, top: 96, width: 940, height: 300, opacity: Math.min(1, p * 1.8), transform: `scale(${0.82 + 0.18 * p}) rotate(-1.2deg)` }}>
        <div style={{ position: "absolute", inset: 0, background: C.paper, borderRadius: 12, boxShadow: "0 14px 30px rgba(0,0,0,0.28)" }} />
        {/* phase A：用了去AI味skill，还是AI味 */}
        <div style={{ position: "absolute", inset: 0, opacity: phaseA }}>
          <div style={{ position: "absolute", left: 44, top: 40, fontFamily: MARK, fontSize: 64, color: C.ink, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 14 }}>
            用了
            <span style={{ background: C.noteP, border: `3px solid ${C.ink}`, borderRadius: 40, padding: "2px 26px", fontSize: 60 }}>去AI味 skill</span>
            ？
          </div>
          <Hand t={t} a={2.65} b={3.6} x={50} y={168} size={72} rot={-2}>脚本还是一股子 AI 味</Hand>
        </div>
        {/* phase B：关键不是去AI味，而是加人味 */}
        <div style={{ position: "absolute", inset: 0, opacity: phaseB }}>
          <div style={{ position: "absolute", left: 44, top: 30, fontFamily: BODY, fontWeight: 700, fontSize: 40, color: C.muted, whiteSpace: "nowrap" }}>写出爆款脚本的关键</div>
          <div style={{ position: "absolute", left: 44, top: 108, fontFamily: MARK, fontSize: 92, color: ramp(t, 8.4, 8.7) > 0.5 ? C.muted : C.ink, whiteSpace: "nowrap", opacity: ramp(t, 7.8, 8.15) }}>去AI味</div>
          <Strike t={t} a={8.45} b={8.85} x={40} y={166} w={290} width={10} rot={-6} />
          <div style={{ position: "absolute", left: 360, top: 118, fontFamily: MARK, fontSize: 80, color: C.red, opacity: ramp(t, 9.9, 10.15) }}>→</div>
          {t >= 9.95 ? (
            <div style={{ position: "absolute", left: 470, top: 86 }}>
              <Note t={t} at={9.97} x={0} y={0} w={420} h={150} color={C.noteY} seed="hook" fontSize={96}>
                <span style={{ position: "relative" }}>
                  <Highlight t={t} a={10.35} b={10.8} x={-8} y={58} w={250} h={42} color="rgba(226,72,61,0.32)" />
                  <span style={{ position: "relative" }}>+ 人味</span>
                </span>
              </Note>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
