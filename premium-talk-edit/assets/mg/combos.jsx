import React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { DEMOS, Scene } from "./scenes.jsx";
import { ThemeProvider, useT, ramp, Tag, Subtitle, SANS, ZONE, BaseFill, useK, lerp } from "./lib.jsx";

// 风格包推荐组合：同一张卡在 6 套风格下的样子（接在演示合集后面）
const COMBOS = [
  { name: "经典墨金", note: "墨黑底 · 暖金 · 纸白卡 · 黑体", theme: { base: "ink", accent: "gold", card: "paper", title: "sans", num: "barlow", motion: "rise", subtitle: "shadow", tag: "bar" } },
  { name: "深海雾蓝", note: "深海蓝底 · 雾蓝 · 玻璃卡 · 侧滑", theme: { base: "midnight", accent: "azure", card: "glass", title: "sans", num: "oswald", motion: "slide", subtitle: "bar", tag: "chip" } },
  { name: "墨绿青瓷", note: "墨绿底 · 青瓷绿 · 厚卡 · 宋体", theme: { base: "forest", accent: "jade", card: "slab", title: "serif", num: "serif", motion: "mask", subtitle: "shadow", tag: "line" } },
  { name: "象牙酒红", note: "象牙白底 · 酒红 · 浅色玻璃卡 · 宋体", theme: { base: "ivory", accent: "wine", card: "glass", title: "serif", num: "bebas", motion: "wipe", subtitle: "outline", tag: "bar" } },
  { name: "珊瑚暖调", note: "墨黑底 · 珊瑚橙 · 玻璃卡 · 细宋体", theme: { base: "ink", accent: "coral", card: "glass", title: "elegant", num: "barlow", motion: "scale", subtitle: "lowkey", tag: "chip" } },
  { name: "银灰极简", note: "墨黑底 · 银灰 · 细线框 · 窄体", theme: { base: "ink", accent: "silver", card: "line", title: "sans", num: "oswald", motion: "rise", subtitle: "outline", tag: "line" } },
];
const COMBO_DUR = 3.6;
const PICK = ["steps", "number", "compare"];

function Head({ c, i }) {
  const { t } = useT();
  const K = useK();
  const p = ramp(t, 0, 0.3);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", justifyContent: "center", opacity: p }}>
      <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 700, color: "#fff", background: "rgba(10,12,16,0.72)", border: `1.5px solid ${K.accent}`, borderRadius: 999, padding: "8px 26px", whiteSpace: "nowrap" }}>
        <span style={{ color: K.accent }}>风格组合 {i + 1}/6 · {c.name}</span>
        <span style={{ opacity: 0.65, fontSize: 26, marginLeft: 14 }}>{c.note}</span>
      </div>
    </div>
  );
}

function Title6() {
  const { t } = useT();
  const K = useK();
  const out = 1 - ramp(t, 1.6, 1.9);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <BaseFill />
      <div style={{ position: "absolute", left: 90, top: 760, fontFamily: SANS, color: "#fff" }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "0.16em", color: K.accent }}>风格包</div>
        <div style={{ fontSize: 92, fontWeight: 900, marginTop: 8, transform: `translateY(${lerp(20, 0, ramp(t, 0.1, 0.5))}px)` }}>6 套推荐组合</div>
        <div style={{ fontSize: 40, color: "#9aa0a8", marginTop: 18 }}>同一张卡，换底色、强调色、卡片、字体</div>
      </div>
    </div>
  );
}

export default function Combos() {
  const { fps } = useVideoConfig();
  const spec = DEMOS.find((d) => d.scene === PICK[0]) || DEMOS.find((d) => PICK.includes(d.scene)) || DEMOS[0];
  const d = Math.round(COMBO_DUR * fps);
  const t0 = Math.round(1.9 * fps);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1540, bottom: 0, background: "linear-gradient(180deg, rgba(10,12,16,0) 0%, rgba(10,12,16,0.55) 40%, rgba(10,12,16,0.55) 100%)" }} />
      <Sequence from={0} durationInFrames={t0}>
        <Title6 />
      </Sequence>
      {COMBOS.map((c, i) => (
        <Sequence key={i} from={t0 + i * d} durationInFrames={d}>
          <ThemeProvider theme={c.theme}>
            <Scene spec={fit(spec)} />
            <Tag text="栏目名 · 第12期" onBase />
            <SubDemo />
            <Head c={c} i={i} />
          </ThemeProvider>
        </Sequence>
      ))}
    </div>
  );
}

// 示例原长 5.6 秒，压到 3.6 秒时把各步时间按比例前移，不然第 3 步和收尾打勾在出场后才发生
function fit(spec) {
  const k = (COMBO_DUR - 0.7) / Math.max(1, (spec.endAt || spec.dur || COMBO_DUR) - 0.3);
  const sc = (v) => (typeof v === "number" ? Math.round(Math.max(0.5, v * k) * 100) / 100 : v);
  return { ...spec, dur: COMBO_DUR, endAt: sc(spec.endAt), items: (spec.items || []).map((it) => (typeof it === "object" ? { ...it, at: sc(it.at) } : it)) };
}

function SubDemo() {
  const { t } = useT();
  return <Subtitle t={t} y={ZONE.subB} lines={[[0.2, 99, "第一步，先把", { k: "证据", at: 0.9 }, "留好"]]} />;
}
