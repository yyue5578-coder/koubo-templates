import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { SCENES, DEMOS, Scene } from "./scenes.jsx";
import { useT, ramp, lerp, BaseFill, Tag, SANS, ZONE, useK, hexA } from "./lib.jsx";

// 组件库演示合集：开场 2.5 秒标题，之后每个场景按 DEMOS 顺序播放。
const INTRO = 2.5;
const LAYOUT_CN = { A: "人物全屏叠层", B: "上卡下人", C: "全屏讲解" };
// 表格、时间轴可以是 B 也可以是 C：按 spec 实际版式
const layoutOf = (spec) => { const m = SCENES[spec.scene] || {}; return m.layoutOf ? m.layoutOf(spec) : m.layout; };

function Intro() {
  const { t } = useT();
  const K = useK();
  const out = 1 - ramp(t, INTRO - 0.35, INTRO);
  const n = new Set(DEMOS.map((d) => d.scene)).size; // 场景种数（表格、时间轴各有两个示例）
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <BaseFill />
      <div style={{ position: "absolute", left: 90, right: 90, top: 640, fontFamily: SANS, color: K.baseText }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "0.16em", color: K.accent, opacity: ramp(t, 0.1, 0.4) }}>口播剪辑模板</div>
        <div style={{ fontSize: 108, fontWeight: 900, lineHeight: 1.2, marginTop: 10, opacity: ramp(t, 0.2, 0.6), transform: `translateY(${lerp(24, 0, ramp(t, 0.2, 0.6))}px)` }}>高级感干货风</div>
        <div style={{ height: 6, width: 160, background: K.accent, marginTop: 26, transform: `scaleX(${ramp(t, 0.5, 0.9)})`, transformOrigin: "left" }} />
        <div style={{ fontSize: 44, fontWeight: 700, marginTop: 30, opacity: ramp(t, 0.6, 1.0), color: K.baseMuted }}>组件库 · {n} 种卡片</div>
      </div>
    </div>
  );
}

function Label({ i, n, spec }) {
  const meta = SCENES[spec.scene] || {};
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", justifyContent: "center" }}>
      <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 700, color: "#fff", background: "rgba(10,12,16,0.72)", border: "1.5px solid rgba(255,255,255,0.18)", borderRadius: 999, padding: "8px 26px", whiteSpace: "nowrap" }}>
        <span style={{ opacity: 0.6 }}>{String(i + 1).padStart(2, "0")}/{n}</span>
        <span style={{ margin: "0 14px" }}>{meta.cn || spec.scene}</span>
        <span style={{ opacity: 0.6, fontSize: 26 }}>{spec.scene} · {LAYOUT_CN[layoutOf(spec)] || ""}</span>
      </div>
    </div>
  );
}

function UseLine({ spec }) {
  const { t } = useT();
  const meta = SCENES[spec.scene] || {};
  if (!meta.use) return null;
  const L = layoutOf(spec);
  const y = L === "B" ? ZONE.subB + 18 : L === "C" ? 175 : ZONE.subA + 170;
  const p = ramp(t, 0.3, 0.6);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: y, display: "flex", justifyContent: "center", opacity: p }}>
      <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 600, lineHeight: 1.45, color: "rgba(255,255,255,0.92)", textShadow: "0 2px 10px rgba(0,0,0,0.7)", maxWidth: 900, textAlign: "center", transform: "translateY(-50%)" }}>
        <span style={{ fontSize: 24, padding: "2px 12px", borderRadius: 20, border: "1.5px solid rgba(255,255,255,0.4)", marginRight: 12, whiteSpace: "nowrap" }}>适用</span>
        {meta.use}
      </div>
    </div>
  );
}

export default function Gallery() {
  const { fps } = useVideoConfig();
  let at = Math.round(INTRO * fps);
  const seqs = DEMOS.map((spec, i) => {
    const d = Math.round((spec.dur || 4.5) * fps);
    const s = { from: at, d, spec, i };
    at += d;
    return s;
  });
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1540, bottom: 0, background: "linear-gradient(180deg, rgba(10,12,16,0) 0%, rgba(10,12,16,0.55) 40%, rgba(10,12,16,0.55) 100%)" }} />
      <Sequence from={0} durationInFrames={Math.round(INTRO * fps)}>
        <Intro />
      </Sequence>
      {seqs.map((s) => (
        <Sequence key={s.i} from={s.from} durationInFrames={s.d}>
          <Scene spec={s.spec} />
          {layoutOf(s.spec) === "B" || (layoutOf(s.spec) === "C" && (SCENES[s.spec.scene] || {}).layouts) ? <Tag onBase /> : null}
          <UseLine spec={s.spec} />
          <Label i={s.i} n={DEMOS.length} spec={s.spec} />
        </Sequence>
      ))}
    </div>
  );
}
