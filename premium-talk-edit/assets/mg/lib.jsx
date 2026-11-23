import React, { createContext, useContext } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME } from "./theme.jsx";

// 高级感干货风 · 公共底座（1080×1920）。所有场景只从这里取颜色、字体、进场方式和小组件。
// 时间一律是「这段动效内的秒数」。

// ---------- 画面区域 ----------
export const W = 1080, H = 1920;
// 抖音界面遮挡：顶部 0–200；底部 1560 以下；右侧按钮 x>960、y 820–1560
export const SAFE = { top: 200, bottom: 1560, rightX: 960, rightY0: 820, rightY1: 1560, left: 72, right: 1008 };
// A 人物全屏：卡片放在脸上方 230–640；B 上卡下人：底色 0–930，卡片 270–880；C 全屏讲解：卡片 230–1240，圆窗左下
export const ZONE = { aTop: 230, aBottom: 640, panelH: 930, bTop: 270, bBottom: 880, cTop: 230, cBottom: 1240, subA: 1325, subB: 1478, subC: 1330 };
export const CIRCLE = { x: 72, y: 1290, d: 240 }; // C 状态人物圆窗（左下，避开右侧按钮）

// ---------- 风格包 ----------
const ACCENTS = {
  gold: { a: "#E3AE4F", deep: "#A9781F" },
  jade: { a: "#5BBFA4", deep: "#2E7D69" },
  azure: { a: "#7FB2E5", deep: "#2F5F94" },
  wine: { a: "#D7687D", deep: "#8E2F42" },
  coral: { a: "#EE8F66", deep: "#B0532F" },
  silver: { a: "#D3D8DF", deep: "#5E6672", mono: true }, // 银灰接近白色：强调改用「反白」小底块，不靠变色
};
const BASES = {
  ink: { bg: "#12161C", rgb: "18,22,28", text: "#FFFFFF", muted: "#9AA0A8", dark: true },
  midnight: { bg: "#0E1A2B", rgb: "14,26,43", text: "#FFFFFF", muted: "#93A3B8", dark: true },
  forest: { bg: "#0F1F1A", rgb: "15,31,26", text: "#FFFFFF", muted: "#93A89F", dark: true },
  ivory: { bg: "#F3EFE6", rgb: "243,239,230", text: "#1D2128", muted: "#6B7079", dark: false },
};
const TITLE_FONTS = { sans: "'Noto Sans SC', 'PingFang SC', sans-serif", serif: "'Noto Serif SC', 'Songti SC', serif", elegant: "'Noto Serif SC', 'Songti SC', serif", xiaowei: "'Noto Serif SC', 'Songti SC', serif" }; // xiaowei 已弃用（站酷小薇把「回」渲染成实心方块），保留键名只为兼容，等同 elegant
const NUM_FONTS = { barlow: "'Barlow Condensed', 'Noto Sans SC', sans-serif", oswald: "'Oswald', 'Noto Sans SC', sans-serif", bebas: "'Bebas Neue', 'Noto Sans SC', sans-serif", serif: "'DM Serif Display', 'Noto Serif SC', serif" };
export const SANS = "'Noto Sans SC', 'PingFang SC', sans-serif";
export const SERIF = "'Noto Serif SC', 'Songti SC', serif";
// 警示色：风险、错误、划掉。酒红强调色和红色太近，酒红配色下警示改用琥珀橙（theme.jsx 选 wine 时自动换）
const WARNS = { red: ["#D8574B", "#F2958A"], amber: ["#C9761A", "#F0AE5A"] };
const warnOf = (accent) => WARNS[accent === "wine" ? "amber" : "red"];
export const WARN = warnOf(THEME.accent)[0];
export const WARN_SOFT = warnOf(THEME.accent)[1];
export const PAPER = "#F6F3EC";
export const INK = "#12161C";

function resolve(th) {
  const T = { ...THEME, ...(th || {}) };
  const ac = ACCENTS[T.accent] || ACCENTS.gold;
  const b = BASES[T.base] || BASES.ink;
  const card = T.card || "paper";
  const lightCard = card === "paper" || card === "slab" || ((card === "glass" || card === "line") && !b.dark);
  const K = {
    T,
    accent: ac.a, accentDeep: ac.deep,
    hl: hexA(ac.a, 0.6), hlSoft: hexA(ac.a, 0.22), mono: !!ac.mono,
    warn: warnOf(T.accent)[0], warnSoft: warnOf(T.accent)[1],
    base: b.bg, baseRgb: b.rgb, baseText: b.text, baseMuted: b.muted, baseDark: b.dark,
    titleFont: TITLE_FONTS[T.title] || TITLE_FONTS.sans,
    numFont: NUM_FONTS[T.num] || NUM_FONTS.barlow,
    numScale: T.num === "bebas" ? 1.12 : T.num === "serif" ? 0.92 : 1,
    motion: T.motion || "rise",
    card, lightCard,
  };
  // 卡片上的颜色
  K.cardText = lightCard ? "#12161C" : "#FFFFFF";
  K.cardMuted = lightCard ? "#8A8F98" : "#B7BCC4";
  K.cardAc = lightCard ? ac.deep : ac.a; // 卡片上的强调字
  K.cardLine = lightCard ? "rgba(18,22,28,0.10)" : "rgba(255,255,255,0.14)";
  K.cardChip = lightCard ? "#E4DED2" : "rgba(255,255,255,0.10)";
  if (ac.mono && lightCard) { K.hl = hexA(ac.deep, 0.32); K.hlSoft = hexA(ac.deep, 0.14); } // 银灰在浅色卡上荧光笔用深灰，不然看不见
  if (card === "paper") Object.assign(K, { cardBg: PAPER, cardRadius: 28, cardBorder: "none", cardShadow: "0 22px 54px rgba(0,0,0,0.45)", cardBar: false });
  else if (card === "slab") Object.assign(K, { cardBg: "#FBFAF7", cardRadius: 6, cardBorder: "none", cardShadow: "0 16px 40px rgba(0,0,0,0.40)", cardBar: true });
  else if (card === "glass") Object.assign(K, { cardBg: `rgba(${b.rgb},0.86)`, cardRadius: 24, cardBorder: `1.5px solid ${b.dark ? "rgba(255,255,255,0.12)" : "rgba(18,22,28,0.10)"}`, cardShadow: "0 18px 44px rgba(0,0,0,0.35)", cardBar: false });
  else Object.assign(K, { cardBg: `rgba(${b.rgb},0.55)`, cardRadius: 18, cardBorder: `2.5px solid ${ac.a}`, cardShadow: "none", cardBar: false });
  return K;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export { hexA };

const ThemeCtx = createContext(null);
// 预览多套风格时用：<ThemeProvider theme={{accent:"jade"}}>…</ThemeProvider>
export function ThemeProvider({ theme, children }) {
  return <ThemeCtx.Provider value={resolve(theme)}>{children}</ThemeCtx.Provider>;
}
const DEFAULT_K = resolve(null);
export function useK() {
  return useContext(ThemeCtx) || DEFAULT_K;
}

// ---------- 时间 ----------
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export function useT() {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return { t: f / fps, dur: durationInFrames / fps, fps };
}
export function ramp(t, a, b, ease = EASE) {
  if (b <= a) return t >= a ? 1 : 0;
  return interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
}
export const lerp = (a, b, p) => a + (b - a) * p;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 一次轻微放大（关键词出现时），0.32 秒
export function pulse(t, at, amt = 0.08, d = 0.32) {
  const q = ramp(t, at, at + d, Easing.linear);
  return q <= 0 || q >= 1 ? 1 : 1 + amt * Math.sin(Math.PI * q);
}
// 数字计数，先快后慢
export function countUp(t, at, to, { from = 0, dur = 0.6, decimals = 0 } = {}) {
  const p = ramp(t, at, at + dur, Easing.out(Easing.cubic));
  const v = lerp(from, to, p);
  return decimals ? v.toFixed(decimals) : String(Math.round(v));
}

// ---------- 进场 / 出场（跟风格包的 motion 走） ----------
// p：进场进度 0→1；返回 style
export function enterStyle(kind, p) {
  switch (kind) {
    case "mask":
      return { clipPath: `inset(${(1 - p) * 100}% -40px -40px -40px)`, transform: `translateY(${(1 - p) * 30}px)`, opacity: Math.min(1, p * 4) };
    case "slide":
      return { opacity: p, transform: `translateX(${(1 - p) * -48}px)` };
    case "scale":
      return { opacity: p, transform: `scale(${0.94 + 0.06 * p})` };
    case "wipe":
      return { clipPath: `inset(-40px ${(1 - p) * 100}% -40px -40px)`, opacity: Math.min(1, p * 3) };
    default:
      return { opacity: p, transform: `translateY(${(1 - p) * 24}px)` };
  }
}
// 卡片进场 0.36 秒，出场 0.24 秒只淡出。out=null 表示不出场。
export function io(t, at, out, kind) {
  const p = ramp(t, at, at + 0.36);
  const q = out == null ? 0 : ramp(t, out, out + 0.24, Easing.linear);
  const s = enterStyle(kind, p);
  return { ...s, opacity: (s.opacity == null ? 1 : s.opacity) * (1 - q), _vis: p > 0 && q < 1 };
}
// 包一层进场动画。kind 不传就用风格包的 motion。
export function In({ t, at = 0, out = null, kind, style, children }) {
  const K = useK();
  const s = io(t, at, out, kind || K.motion);
  if (!s._vis) return null;
  const { _vis, ...st } = s;
  return <div style={{ ...style, ...st, transform: [style && style.transform, st.transform].filter(Boolean).join(" ") || undefined }}>{children}</div>;
}
// 列表逐项：第 i 项的出场时间
export const stagger = (at, i, gap = 0.12) => at + gap * i;

// ---------- 底色、遮罩 ----------
// B 上卡下人：底色从上往下展开 0.42s（人物同时用 ChatCut 关键帧下移），b 秒收起；b=null 不收
export function Panel({ t, a = 0, b = null, h = ZONE.panelH }) {
  const K = useK();
  const open = ramp(t, a, a + 0.42, Easing.inOut(Easing.cubic));
  const close = b == null ? 0 : ramp(t, b - 0.42, b, Easing.inOut(Easing.cubic));
  const hh = h * open * (1 - close);
  if (hh <= 0.5) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: hh, overflow: "hidden" }}>
      <BaseFill h={h} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, background: hexA(K.accent, 0.35) }} />
    </div>
  );
}
// 整屏底色（C 全屏讲解、片尾）
export function BaseFill({ h = H, opacity = 1 }) {
  const K = useK();
  const dot = K.baseDark ? "rgba(255,255,255,0.06)" : "rgba(18,22,28,0.06)";
  return <div style={{ position: "absolute", left: 0, top: 0, width: W, height: h, opacity, background: K.base, backgroundImage: `radial-gradient(${dot} 1.6px, transparent 1.6px)`, backgroundSize: "32px 32px" }} />;
}
// A 人物全屏时顶部压暗，保证大字清楚
export function Scrim({ t, a = 0, b = null, h = 1000, strength = 0.82 }) {
  const o = ramp(t, a, a + 0.3, Easing.linear) * (b == null ? 1 : 1 - ramp(t, b, b + 0.24, Easing.linear));
  if (o <= 0) return null;
  return <div style={{ position: "absolute", left: 0, top: 0, width: W, height: h, opacity: o, background: `linear-gradient(180deg, rgba(10,12,16,${strength}) 0%, rgba(10,12,16,${strength * 0.66}) 34%, rgba(10,12,16,0) 62%)` }} />;
}

// ---------- 卡片外框 ----------
// x/y/w/h 是画布像素。children 里的文字颜色默认 K.cardText。
export function CardBox({ t, at = 0, out = null, x = SAFE.left, y = ZONE.bTop, w = 936, h = 600, pad = "46px 54px", zoom = 0, kind, children, style }) {
  const K = useK();
  const s = io(t, at, out, kind || K.motion);
  if (!s._vis) return null;
  const { _vis, ...st } = s;
  const z = zoom ? 1 + zoom * ramp(t, at, (out == null ? at + 6 : out), Easing.linear) : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, ...st }}>
      <div style={{ position: "absolute", inset: 0, background: K.cardBg, borderRadius: K.cardRadius, border: K.cardBorder, boxShadow: K.cardShadow, overflow: "hidden", ...style }}>
        {K.cardBar ? <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: K.accent }} /> : null}
        <div style={{ position: "absolute", inset: 0, padding: pad, transform: `scale(${z})`, transformOrigin: "40% 70%", color: K.cardText, fontFamily: SANS }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- 文字小件 ----------
export function Kicker({ children, color, size = 28, style }) {
  const K = useK();
  return <div style={{ fontFamily: SANS, fontSize: size, fontWeight: 800, letterSpacing: "0.14em", color: color || K.cardAc, whiteSpace: "nowrap", ...style }}>{children}</div>;
}
export function Title({ children, size = 50, color, weight = 800, style }) {
  const K = useK();
  const el = K.T.title === "elegant" || K.T.title === "xiaowei";
  const w = el ? 500 : weight;
  return <div style={{ fontFamily: K.titleFont, fontSize: size, fontWeight: w, lineHeight: 1.3, letterSpacing: el ? "0.06em" : undefined, color, ...style }}>{children}</div>;
}
// 数字（窄体）。inline 使用。
export function Num({ children, size = 64, color, style }) {
  const K = useK();
  return <span style={{ fontFamily: K.numFont, fontSize: size * K.numScale, fontWeight: 700, lineHeight: 1, color: color || K.cardAc, ...style }}>{children}</span>;
}
export function Muted({ children, size = 26, style }) {
  const K = useK();
  return <div style={{ fontSize: size, color: K.cardMuted, lineHeight: 1.45, ...style }}>{children}</div>;
}
// 荧光笔扫过（从左到右）。full=true 是整块色块
export function Mark({ t, at, dur = 0.55, children, full = false, color }) {
  const K = useK();
  const p = ramp(t, at, at + dur, Easing.out(Easing.quad));
  const c = color || K.hl;
  return (
    <span style={{ backgroundImage: `linear-gradient(${c}, ${c})`, backgroundRepeat: "no-repeat", backgroundPosition: full ? "0 50%" : "0 88%", backgroundSize: `${p * 100}% ${full ? 100 : 46}%`, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{children}</span>
  );
}
// 红线划掉：包住要划的文字
export function Strike({ t, at, dur = 0.35, children, color, dim = true }) {
  const K = useK();
  color = color || K.warn;
  const p = ramp(t, at, at + dur, Easing.out(Easing.quad));
  return (
    <span style={{ position: "relative", display: "inline-block", color: dim && p > 0.5 ? K.cardMuted : undefined }}>
      {children}
      <span style={{ position: "absolute", left: -4, right: -4, top: "54%", height: 6, borderRadius: 4, background: color, transform: `scaleX(${p})`, transformOrigin: "left" }} />
    </span>
  );
}
// 圆形打勾 / 打叉
export function Tick({ t, at, size = 46, ok = true }) {
  const K = useK();
  const p = ramp(t, at, at + 0.25);
  if (p <= 0) return null;
  const bg = ok ? (K.lightCard ? INK : K.accent) : K.warn;
  const fg = ok ? (K.lightCard ? K.accent : INK) : "#FFFFFF";
  return (
    <span style={{ flex: "none", width: size, height: size, borderRadius: size / 2, background: bg, color: fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.6, fontWeight: 900, fontFamily: SANS, transform: `scale(${lerp(0.5, 1, p)})`, opacity: p }}>{ok ? "✓" : "✕"}</span>
  );
}
// 胶囊标签
export function Chip({ children, active = true, size = 30, style }) {
  const K = useK();
  return (
    <span style={{ display: "inline-block", fontFamily: SANS, fontSize: size, fontWeight: 800, padding: `${size * 0.18}px ${size * 0.6}px`, borderRadius: 999, background: active ? (K.lightCard ? INK : K.accent) : K.cardChip, color: active ? (K.lightCard ? K.accent : INK) : K.cardMuted, whiteSpace: "nowrap", ...style }}>{children}</span>
  );
}
// 一行来源小字（卡片底部）
export function Source({ children, style }) {
  const K = useK();
  return <div style={{ position: "absolute", left: 54, right: 54, bottom: 34, fontSize: 25, color: K.cardMuted, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...style }}>{children}</div>;
}

// ---------- 栏目标签（左上） ----------
// onBase=true：标签画在底色上（B 上卡下人、C 全屏），文字跟底色走；否则画在人物画面上用白字
export function Tag({ text, opacity = 1, onBase = false }) {
  const K = useK();
  const st = K.T.tag || "bar";
  if (st === "none") return null;
  const label = text || K.T.column;
  const light = onBase && !K.baseDark;
  const base = { position: "absolute", left: SAFE.left, top: 214, opacity, fontFamily: SANS, fontSize: 32, fontWeight: 700, letterSpacing: "0.08em", whiteSpace: "nowrap", color: light ? K.baseText : "rgba(255,255,255,0.94)", textShadow: light ? "none" : "0 2px 10px rgba(0,0,0,0.45)" };
  if (st === "chip") return <div style={{ ...base, textShadow: "none", color: INK, background: K.accent, padding: "6px 22px", borderRadius: 999, fontSize: 28 }}>{label}</div>;
  if (st === "line") return <div style={{ ...base, paddingBottom: 8, borderBottom: `4px solid ${K.accent}` }}>{label}</div>;
  return (
    <div style={{ ...base, display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 8, height: 36, borderRadius: 4, background: K.accent }} />
      {label}
    </div>
  );
}

// ---------- 字幕 ----------
// lines: [[起, 止, 片段...], …]；片段：字符串 | {k,at} 关键词 | {b,at} 色块 | {n} 数字 | {who:"连麦"} 说话人标签
export function Subtitle({ t, lines, y = ZONE.subA }) {
  const K = useK();
  const line = lines.find((s) => t >= s[0] && t < s[1]);
  if (!line) return null;
  const [a, , ...parts] = line;
  const st = K.T.subtitle || "shadow";
  const p = ramp(t, a, a + 0.2);
  const size = st === "lowkey" ? 54 : 64;
  const SH = "0 3px 13px rgba(0,0,0,0.55), 0 0 3px rgba(0,0,0,0.75)";
  const text = { fontFamily: SANS, fontSize: size, fontWeight: st === "lowkey" ? 600 : 700, color: "#FFFFFF", letterSpacing: "0.02em", lineHeight: 1.25, whiteSpace: "nowrap" };
  if (st === "shadow" || st === "lowkey") text.textShadow = st === "lowkey" ? "0 2px 8px rgba(0,0,0,0.6)" : SH;
  if (st === "outline") Object.assign(text, { WebkitTextStroke: "7px rgba(12,14,18,0.92)", paintOrder: "stroke fill" });
  const wrap = st === "bar" ? { background: `rgba(${K.baseRgb},0.62)`, padding: "10px 28px", borderRadius: 14 } : {};
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: y, transform: `translateY(calc(-50% + ${lerp(8, 0, p)}px))`, opacity: p, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", ...wrap }}>
        {parts.map((x, i) => {
          if (typeof x === "string") return <span key={i} style={text}>{x}</span>;
          if (x.who) return <span key={i} style={{ fontFamily: SANS, fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.88)", background: "rgba(18,22,28,0.55)", border: "1.5px solid rgba(255,255,255,0.28)", borderRadius: 30, padding: "3px 14px", marginRight: 14 }}>{x.who}</span>;
          if (x.n) return <span key={i} style={{ ...text, fontFamily: K.numFont, fontSize: size * 1.18 * K.numScale, color: K.accent, margin: "0 4px", ...(K.mono ? { textDecorationLine: "underline", textDecorationThickness: 5, textUnderlineOffset: 8 } : null) }}>{x.n}</span>;
          if (x.k && K.mono) { // 银灰：关键词反白（银底深字），说到时出现
            const q = x.at == null ? 1 : ramp(t, x.at, x.at + 0.2);
            return <span key={i} style={{ ...text, display: "inline-block", fontWeight: 900, padding: "0 10px", margin: "0 4px", borderRadius: 7, background: hexA(K.accent, q), color: q > 0.4 ? INK : "#FFFFFF", textShadow: q > 0.4 ? "none" : text.textShadow, WebkitTextStroke: q > 0.4 ? "0" : text.WebkitTextStroke, transform: `scale(${pulse(t, x.at)})` }}>{x.k}</span>;
          }
          if (x.k) return <span key={i} style={{ ...text, display: "inline-block", color: K.accent, fontWeight: 900, transform: `scale(${pulse(t, x.at)})` }}>{x.k}</span>;
          if (x.b) {
            const q = ramp(t, x.at, x.at + 0.45, Easing.out(Easing.quad));
            return <span key={i} style={{ ...text, fontWeight: 900, padding: "0 10px", margin: "0 4px", borderRadius: 7, color: q > 0.35 ? INK : "#FFFFFF", textShadow: q > 0.35 ? "none" : text.textShadow, WebkitTextStroke: q > 0.35 ? "0" : text.WebkitTextStroke, backgroundImage: `linear-gradient(${K.accent}, ${K.accent})`, backgroundRepeat: "no-repeat", backgroundPosition: "left center", backgroundSize: `${q * 100}% 100%` }}>{x.b}</span>;
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ---------- 文字宽度估算 / 自动字号 ----------
const WIDE = /[⺀-鿿豈-﫿＀-￯　-〿‘-‟…←-⇿①-⓿]/;
export function charW(ch) {
  if (WIDE.test(ch)) return 1.0;
  if (ch === " ") return 0.3;
  if (/[A-Z0-9]/.test(ch)) return 0.62;
  if (/[a-z]/.test(ch)) return 0.55;
  return 0.4;
}
export const textW = (s, size) => [...String(s)].reduce((a, ch) => a + charW(ch), 0) * size * 1.04;
// 一行放下 text 的最大字号（不超过 maxSize，不小于 minSize）
export function fitSize(text, maxW, maxSize, minSize = 24) {
  return Math.floor(clamp(maxW / textW(text, 1), minSize, maxSize));
}
