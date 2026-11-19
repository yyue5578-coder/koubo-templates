import React from "react";
import { interpolate, Easing, useCurrentFrame, useVideoConfig, random } from "remotion";
import { THEME } from "./theme.jsx";
export { THEME };

// 白板便签 · 方法论笔记 — shared tokens。纸张、配色、字体、出场方式都来自 theme.jsx 的风格包。
const PALETTES = {
  classic: { paper: "#FAF8F3", ink: "#22252B", blue: "#2F6FDB", red: "#E2483D", green: "#3E9B57", muted: "#8A8F98", hl: "rgba(255,221,64,0.75)", noteY: "#FFE98A", noteP: "#FFC9C2", noteB: "#C4E1FF", noteG: "#CDEDBB" },
  macaron: { paper: "#FFF9F5", ink: "#3A3340", blue: "#6C8EF5", red: "#F0607A", green: "#4FB38A", muted: "#A39AA8", hl: "rgba(255,182,213,0.75)", noteY: "#FFF0B3", noteP: "#FFD6E8", noteB: "#D4E4FF", noteG: "#D2F5E3" },
  retro: { paper: "#F5ECD9", ink: "#2E2A24", blue: "#2F5D7C", red: "#C8553D", green: "#5B7F3A", muted: "#8C8273", hl: "rgba(242,175,41,0.6)", noteY: "#F2D492", noteP: "#E8B4A0", noteB: "#A9C4C9", noteG: "#C5CF9C" },
  contrast: { paper: "#FFFFFF", ink: "#111111", blue: "#0057FF", red: "#FF2D2D", green: "#00A651", muted: "#777777", hl: "rgba(255,230,0,0.85)", noteY: "#FFE600", noteP: "#FF9EC4", noteB: "#7FD3FF", noteG: "#A6F07F" },
  morandi: { paper: "#F3F0EB", ink: "#3D3B38", blue: "#7A8FA6", red: "#B5736B", green: "#86977D", muted: "#9C968E", hl: "rgba(214,190,150,0.6)", noteY: "#E8DCC0", noteP: "#E3C9C3", noteB: "#C9D3DC", noteG: "#CED6C6" },
  mono: { paper: "#FAFAFA", ink: "#1A1A1A", blue: "#1A1A1A", red: "#1A1A1A", green: "#1A1A1A", muted: "#8A8A8A", hl: "rgba(26,26,26,0.12)", noteY: "#FFFFFF", noteP: "#EDEDED", noteB: "#F5F5F5", noteG: "#E4E4E4" },
};
const PAPER_TINT = { kraft: "#CDAA7D", cork: "#B98650" };
const pal = PALETTES[THEME.palette] || PALETTES.classic;
export const C = {
  ...pal,
  paper: PAPER_TINT[THEME.paper] || pal.paper,
  grid: "rgba(90,110,140,0.13)",
  margin: THEME.palette === "mono" ? "rgba(26,26,26,0.16)" : "rgba(226,72,61,0.35)",
  white: "#FFFFFF",
};
// 字体只写名字：ChatCut 会按名字从 Google Fonts 自动下载（第一次需联网）。动效沙箱里 @font-face / FontFace 不可用，不要随包附带字体文件。
export const MARK = `"${THEME.title || "LXGW Marker Gothic"}", "LXGW Marker Gothic", "Noto Sans SC", sans-serif`;
export const HAND = `"${THEME.hand || "Long Cang"}", "Long Cang", "LXGW Marker Gothic", cursive`;
export const BODY = '"Noto Sans SC", sans-serif';
// 牛皮纸、软木板底色深、纹理碎，直接写在纸上的手写字加一圈浅色描边，保证看得清
export const HAND_HALO = ["kraft", "cork"].includes(THEME.paper) ? "0 0 3px rgba(255,248,232,0.95), 0 0 9px rgba(255,248,232,0.75)" : "none";
export const W = 1080;
export const H = 1920;
// person circle slot (right-bottom): center (770,1480), r 160
export const CIRCLE = { x: 770, y: 1480, r: 160 };

// 整板运镜（board.jsx）把每段场景放进大白板的一格：格子里的 useT() 返回这一段自己的时间，Paper 不再各画各的纸
export const BoardCtx = React.createContext(null);
export function useT() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const b = React.useContext(BoardCtx);
  if (b) return { t: b.t, dur: b.dur, fps, frame: Math.round(b.t * fps) };
  return { t: frame / fps, dur: durationInFrames / fps, fps, frame };
}
export const EOUT = Easing.bezier(0.22, 1, 0.36, 1);
export const EINOUT = Easing.bezier(0.65, 0, 0.35, 1);
export function ramp(t, a, b, easing = EOUT) {
  if (b <= a) return t >= a ? 1 : 0;
  return interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const lerp = (a, b, p) => a + (b - a) * p;
export function spr(t, start, dur = 0.5) {
  return ramp(t, start, start + dur, Easing.bezier(0.34, 1.56, 0.64, 1));
}

// 随机微调：同一风格下，每条视频（THEME.seed）每个元素（key）的角度/位移略有不同，结果稳定可复现
export function jit(key, amp = 1) {
  return (random(String(THEME.seed) + "|" + key) - 0.5) * 2 * amp * (THEME.tilt == null ? 1 : THEME.tilt);
}
// 元素出场方式（THEME.motion）：p 是 spr() 的进度，返回 opacity 和 transform 前缀
export function enter(p, key = "", motion = THEME.motion) {
  const op = Math.min(1, Math.max(0, p) * 1.8);
  if (motion === "slide") {
    const dir = random(String(THEME.seed) + "dir" + key) < 0.5 ? -1 : 1;
    return { opacity: op, transform: `translateX(${(1 - p) * 140 * dir}px) rotate(${(1 - p) * 6 * dir}deg)` };
  }
  if (motion === "drop") return { opacity: op, transform: `translateY(${(1 - p) * -170}px)` };
  return { opacity: op, transform: `scale(${0.7 + 0.3 * p})` };
}

// ---------- 纸张纹理（牛皮纸纤维、软木颗粒）：用固定种子生成，所有视频一样，只算一次 ----------
const rnd = (k) => { let i = 0; return () => random("tex|" + k + "|" + i++); };
function fibers(key, size, n, specks) {
  const r = rnd(key), out = [];
  for (let i = 0; i < n; i++) {
    const x = r() * size, y = r() * size, len = 4 + r() * 14, ang = r() * Math.PI, bend = (r() - 0.5) * 8;
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    const light = r() < 0.45;
    out.push(<path key={"f" + i} d={`M ${x.toFixed(1)} ${y.toFixed(1)} q ${(dx / 2 - dy * bend / len).toFixed(1)} ${(dy / 2 + dx * bend / len).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`}
      stroke={light ? "rgba(255,240,212,0.30)" : "rgba(92,58,24,0.17)"} strokeWidth={(0.6 + r() * 0.9).toFixed(2)} fill="none" strokeLinecap="round" />);
  }
  for (let i = 0; i < specks; i++) {
    const dark = r() < 0.7;
    out.push(<circle key={"s" + i} cx={(r() * size).toFixed(1)} cy={(r() * size).toFixed(1)} r={(0.5 + r() * (dark ? 1.4 : 1.1)).toFixed(2)} fill={dark ? "rgba(70,42,16,0.38)" : "rgba(255,245,225,0.45)"} />);
  }
  return out;
}
function granules(key, size, n) {
  const r = rnd(key), out = [];
  const cols = ["rgba(128,82,38,0.55)", "rgba(222,176,112,0.6)", "rgba(160,110,58,0.5)", "rgba(196,146,86,0.55)", "rgba(92,58,26,0.6)"];
  for (let i = 0; i < n; i++) {
    const c = cols[Math.floor(r() * cols.length)], pore = r() < 0.1, rx = (1.2 + r() * 4.2) * (pore ? 0.5 : 1), ry = rx * (0.45 + r() * 0.5);
    const cx = r() * size, cy = r() * size, ang = Math.floor(r() * 180);
    out.push(<ellipse key={i} cx={cx.toFixed(1)} cy={cy.toFixed(1)} rx={rx.toFixed(2)} ry={ry.toFixed(2)} transform={`rotate(${ang} ${cx.toFixed(1)} ${cy.toFixed(1)})`} fill={pore ? "rgba(52,30,10,0.75)" : c} />);
  }
  return out;
}
function blotches(key, n, light, dark) {
  const r = rnd(key);
  return Array.from({ length: n }, () => `radial-gradient(ellipse ${Math.round(260 + r() * 520)}px ${Math.round(200 + r() * 420)}px at ${Math.round(r() * 100)}% ${Math.round(r() * 100)}%, ${r() < 0.5 ? light : dark}, transparent 70%)`).join(", ");
}
const KRAFT_A = fibers("kraftA", 300, 60, 160), KRAFT_B = fibers("kraftB", 211, 30, 90);
const CORK_A = granules("corkA", 240, 420), CORK_B = granules("corkB", 173, 220);
const BLOTCH = { kraft: [9, "rgba(255,236,205,0.22)", "rgba(120,78,34,0.13)"], cork: [10, "rgba(235,190,130,0.22)", "rgba(90,55,20,0.16)"] };
const KRAFT_BLOTCH = blotches("kraft", ...BLOTCH.kraft);
const CORK_BLOTCH = blotches("cork", ...BLOTCH.cork);
// 整块白板用的深浅斑：按白板面积撒，不重复铺（重复铺会在每屏交界处出现接缝）
const BIG_BLOTCH = {};
function blotchFor(kind, w, h) {
  if (w === W && h === H) return kind === "kraft" ? KRAFT_BLOTCH : CORK_BLOTCH;
  const key = kind + w + "x" + h;
  if (!BIG_BLOTCH[key]) {
    const [n0, light, dark] = BLOTCH[kind], r = rnd(key), n = Math.round((n0 * w * h) / (W * H));
    BIG_BLOTCH[key] = Array.from({ length: n }, () => `radial-gradient(ellipse ${Math.round(260 + r() * 520)}px ${Math.round(200 + r() * 420)}px at ${Math.round(r() * w)}px ${Math.round(r() * h)}px, ${r() < 0.5 ? light : dark}, transparent 70%)`).join(", ");
  }
  return BIG_BLOTCH[key];
}
// 每个纹理用不重名的 id：几段动效同时载入时，重名的 url(#id) 会指到别的（可能是隐藏的）那一段，纹理就画不出来
function Pattern({ id, size, children, w = W, h = H }) {
  const uid = id + "-" + String(React.useId ? React.useId() : "").replace(/[^A-Za-z0-9_-]/g, "");
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs><pattern id={uid} width={size} height={size} patternUnits="userSpaceOnUse">{children}</pattern></defs>
      <rect width={w} height={h} fill={`url(#${uid})`} />
    </svg>
  );
}
// 软木板的木框：四条边各自带木纹，斜角拼接，内侧有一道阴影
function WoodFrame({ b = 34, w = W, h = H }) {
  const grain = (deg) => `repeating-linear-gradient(${deg}deg, rgba(60,34,12,0.16) 0 2px, transparent 2px 7px, rgba(255,220,170,0.10) 7px 9px, transparent 9px 15px), linear-gradient(${deg + 90}deg, #8A5A2E, #A26C3A 45%, #7E5128)`;
  const side = (st, clip, deg) => <div style={{ position: "absolute", ...st, background: grain(deg), clipPath: clip }} />;
  return (<>
    {side({ left: 0, top: 0, width: w, height: b }, `polygon(0 0, 100% 0, calc(100% - ${b}px) 100%, ${b}px 100%)`, 0)}
    {side({ left: 0, bottom: 0, width: w, height: b }, `polygon(${b}px 0, calc(100% - ${b}px) 0, 100% 100%, 0 100%)`, 0)}
    {side({ left: 0, top: 0, width: b, height: h }, `polygon(0 0, 100% ${b}px, 100% calc(100% - ${b}px), 0 100%)`, 90)}
    {side({ right: 0, top: 0, width: b, height: h }, `polygon(0 ${b}px, 100% 0, 100% 100%, 0 calc(100% - ${b}px))`, 90)}
    <div style={{ position: "absolute", left: b, top: b, right: b, bottom: b, boxShadow: "inset 0 3px 8px rgba(40,20,5,0.45), inset 0 0 0 1px rgba(40,20,5,0.4)" }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 1px rgba(255,220,170,0.25)" }} />
  </>);
}
// 纸张背景（THEME.paper）。screen:true 的层（暗角）跟着屏幕走，整板运镜时不随镜头移动。
// w/h 是纸的大小，mx 是左边红线的位置（整板运镜时只有最左一列有红线）
function paperLayers(kind = THEME.paper, w = W, h = H, mx = 78) {
  const g = C.grid;
  switch (kind) {
    case "lines":
      return [
        { backgroundImage: `linear-gradient(transparent 62px, rgba(70,110,170,0.22) 62px, rgba(70,110,170,0.22) 64px)`, backgroundSize: "100% 64px", backgroundPosition: "0 40px" },
        { left: mx, width: 3, background: C.margin },
      ];
    case "dots":
      return [{ backgroundImage: `radial-gradient(circle, rgba(90,110,140,0.32) 3px, transparent 3.5px)`, backgroundSize: "54px 54px", backgroundPosition: "-27px -27px" }];
    case "kraft":
      return [
        { backgroundImage: blotchFor("kraft", w, h) },
        { el: <><Pattern id="kraftA" size={300} w={w} h={h}>{KRAFT_A}</Pattern><Pattern id="kraftB" size={211} w={w} h={h}>{KRAFT_B}</Pattern></> },
        { screen: true, background: "radial-gradient(ellipse at 50% 42%, rgba(255,244,222,0.10), rgba(80,50,18,0.20) 100%)" },
      ];
    case "cork":
      return [
        { backgroundImage: blotchFor("cork", w, h) },
        { el: <><Pattern id="corkA" size={240} w={w} h={h}>{CORK_A}</Pattern><Pattern id="corkB" size={173} w={w} h={h}>{CORK_B}</Pattern></> },
        { screen: true, background: "radial-gradient(ellipse at 50% 45%, rgba(255,230,190,0.08), rgba(60,35,10,0.22) 100%)" },
        { el: <WoodFrame w={w} h={h} /> },
      ];
    case "plain":
      return [{ screen: true, background: "radial-gradient(ellipse at 50% 35%, rgba(255,255,255,0), rgba(60,50,30,0.07) 100%)" }];
    default:
      return [
        { backgroundImage: `linear-gradient(${g} 2px, transparent 2px), linear-gradient(90deg, ${g} 2px, transparent 2px)`, backgroundSize: "54px 54px", backgroundPosition: "-2px -2px" },
        { left: mx, width: 3, background: C.margin },
      ];
  }
}
export const paperColor = (kind = THEME.paper) => PAPER_TINT[kind] || pal.paper;
const layer = (st, i, w, h) => st.el ? <div key={i} style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>{st.el}</div>
  : <div key={i} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, ...st, screen: undefined }} />;
// 纸本身（会随镜头移动的部分）
export function PaperBase({ kind = THEME.paper, w = W, h = H, mx = 78 }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, backgroundColor: paperColor(kind), overflow: "hidden" }}>
      {paperLayers(kind, w, h, mx).filter((st) => !st.screen).map((st, i) => layer(st, i, w, h))}
    </div>
  );
}
// 跟着屏幕走的部分：暗角 + 人物圆圈后面的柔和阴影
export function PaperScreen({ kind = THEME.paper }) {
  return (
    <>
      {paperLayers(kind).filter((st) => st.screen).map((st, i) => layer(st, i, W, H))}
      <div style={{ position: "absolute", left: CIRCLE.x - 210, top: CIRCLE.y - 190, width: 420, height: 420, borderRadius: 210, background: "radial-gradient(circle, rgba(60,50,30,0.12) 0%, rgba(60,50,30,0) 65%)" }} />
    </>
  );
}
// fill：只画纸（橡皮擦重画纸面用）。整板运镜的格子里，Paper 不画纸（整块白板已经画了），fill 时画白板上这一格的那块纸
export function Paper({ t = 0, kind, children, fill = false }) {
  const b = React.useContext(BoardCtx);
  const k = kind || THEME.paper;
  if (b && !fill) return <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>{children}</div>;
  if (b) {
    return (
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -b.x, top: -b.y }}><PaperBase kind={k} w={b.bw} h={b.bh} mx={b.mx} /></div>
        <PaperScreen kind={k} />
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>
      <PaperBase kind={k} />
      <PaperScreen kind={k} />
      {children}
    </div>
  );
}

export function Tape({ x, y, w = 130, rot = -4, color = "rgba(196,225,255,0.85)" }) {
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - 18, width: w, height: 36, background: color, transform: `rotate(${rot}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,0.06)", backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0 6px, transparent 6px 12px)" }} />
  );
}

// 便签款式（THEME.note）：tape 胶带 | sticky 便利贴 | pin 图钉 | masking 美纹纸胶带 | torn 撕下的本子纸 | fold 折角 | clip 回形针 | mix 混搭
export const NOTE_KINDS = ["tape", "sticky", "pin", "masking", "torn", "fold", "clip"];
const MIX = { cork: ["pin", "pin", "clip", "sticky"], kraft: ["masking", "torn", "fold", "masking"], other: ["tape", "sticky", "fold", "clip", "torn", "masking"] };
function noteKind(seed, kind) {
  const k = kind || THEME.note || "tape";
  if (k !== "mix") return k;
  const pool = MIX[THEME.paper] || MIX.other;
  return pool[Math.floor(random(String(THEME.seed) + "|nk|" + seed) * pool.length)];
}
const PINS = ["#E2483D", "#2F6FDB", "#3E9B57", "#F2B33D", "#8E5BD0"];
function Pin({ x, y, seed }) {
  const c = PINS[Math.floor(random("pin" + seed) * PINS.length)];
  return (
    <div style={{ position: "absolute", left: x - 17, top: y - 17, width: 34, height: 34, borderRadius: 17, background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.75) 0 4px, ${c} 9px, ${c} 60%, rgba(0,0,0,0.35) 100%)`, boxShadow: "5px 7px 6px rgba(40,25,10,0.35)" }} />
  );
}
function Masking({ x, y, rot, w = 96 }) {
  const j = "polygon(0 8%, 6% 0, 10% 12%, 16% 2%, 84% 0, 90% 10%, 95% 0, 100% 10%, 100% 92%, 95% 100%, 90% 88%, 84% 100%, 16% 100%, 10% 90%, 5% 100%, 0 90%)";
  return <div style={{ position: "absolute", left: x - w / 2, top: y - 15, width: w, height: 30, transform: `rotate(${rot}deg)`, background: "rgba(246,236,210,0.94)", boxShadow: "0 1px 2px rgba(60,40,10,0.15)", clipPath: j, backgroundImage: "repeating-linear-gradient(90deg, rgba(160,130,80,0.08) 0 1px, transparent 1px 4px)" }} />;
}
function Clip({ x, y }) {
  return (
    <svg width="58" height="126" viewBox="0 0 44 96" style={{ position: "absolute", left: x - 29, top: y - 46, overflow: "visible", filter: "drop-shadow(2px 3px 2px rgba(40,25,10,0.3))" }}>
      <path d="M 30 8 L 30 70 C 30 88 8 88 8 70 L 8 20 C 8 8 22 8 22 20 L 22 64" fill="none" stroke="#98A2AE" strokeWidth="5" strokeLinecap="round" />
      <path d="M 30 8 L 30 70 C 30 88 8 88 8 70 L 8 20 C 8 8 22 8 22 20 L 22 64" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" transform="translate(-1 -1)" />
    </svg>
  );
}
function tornClip(seed, w) {
  const n = Math.max(8, Math.round(w / 14)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(`${((i / n) * 100).toFixed(2)}% ${(2 + random("torn" + seed + i) * 9).toFixed(1)}px`);
  return `polygon(${pts.join(", ")}, 100% 100%, 0 100%)`;
}
function shade(hex, k) {
  if (!hex || hex[0] !== "#") return hex;
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// Sticky note that enters at `at`（出场方式见 THEME.motion，款式见 THEME.note，kind 可单独指定）；out 给了就在那一刻被撕走飞出
export function Note({ t, at, x, y, w = 360, h = 124, color = C.noteY, seed = "n", children, fontSize = 50, tape = true, out = null, kind = null }) {
  const p = spr(t, at, 0.5);
  const rot = jit("note" + seed, 2.5);
  const q = out == null ? 0 : ramp(t, out, out + 0.45, EINOUT);
  if (p <= 0 || q >= 1) return null;
  const e = enter(p, seed);
  const fly = q > 0 ? ` translate(${q * 260}px, ${q * -320}px) rotate(${q * 28}deg)` : "";
  const k = noteKind(seed, kind);
  const F = Math.min(46, h * 0.34);
  const shadow = "drop-shadow(0 8px 9px rgba(60,50,30,0.17)) drop-shadow(0 2px 2px rgba(60,50,30,0.10))";
  const body = {
    position: "absolute", inset: 0, background: color, borderRadius: k === "torn" || k === "fold" ? 0 : k === "sticky" ? 2 : 4,
    clipPath: k === "torn" ? tornClip(seed, w) : k === "fold" ? `polygon(0 0, 100% 0, 100% calc(100% - ${F}px), calc(100% - ${F}px) 100%, 0 100%)` : undefined,
  };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `${e.transform} rotate(${rot}deg)${fly}`, opacity: e.opacity * (1 - q), transformOrigin: "50% 0%" }}>
      <div style={{ position: "absolute", inset: 0, filter: k === "sticky" ? "drop-shadow(0 3px 3px rgba(60,50,30,0.14))" : shadow }}>
        {k === "sticky" ? <div style={{ position: "absolute", left: "6%", right: "3%", bottom: 2, height: 22, borderRadius: "50%", boxShadow: "0 14px 12px rgba(60,50,30,0.30)", transform: "rotate(1.5deg)" }} /> : null}
        <div style={body}>
          {k === "sticky" ? <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: Math.min(26, h * 0.2), background: "linear-gradient(rgba(0,0,0,0.07), rgba(0,0,0,0))" }} /> : null}
          {k === "sticky" ? <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(255,255,255,0) 60%, rgba(0,0,0,0.06))" }} /> : null}
          {k === "torn" ? <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(transparent 36px, rgba(70,110,170,0.20) 36px, rgba(70,110,170,0.20) 38px)", backgroundSize: "100% 38px", backgroundPosition: "0 6px" }} /> : null}
          {k !== "sticky" ? <div style={{ position: "absolute", left: 0, bottom: 0, width: w, height: 16, background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.05))" }} /> : null}
        </div>
        {k === "fold" ? <div style={{ position: "absolute", right: 0, bottom: 0, width: F, height: F, background: `linear-gradient(315deg, transparent 50%, ${shade(color, 0.86)} 50%)`, filter: "drop-shadow(-2px -2px 2px rgba(60,50,30,0.15))" }} /> : null}
      </div>
      {tape && k === "tape" ? <Tape x={w / 2} y={0} w={110} rot={rot * -1.2} /> : null}
      {tape && k === "pin" ? <Pin x={w / 2 + jit("pinx" + seed, w * 0.08)} y={18} seed={seed} /> : null}
      {tape && k === "masking" ? <><Masking x={10} y={8} rot={-38} /><Masking x={w - 10} y={8} rot={38} /></> : null}
      {tape && k === "clip" ? <Clip x={Math.min(70, w * 0.18)} y={0} /> : null}
      {tape && k === "torn" ? <Tape x={w / 2} y={4} w={90} rot={rot * -1.5} color="rgba(255,201,194,0.85)" /> : null}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MARK, fontSize, color: C.ink, letterSpacing: 1, paddingTop: k === "torn" ? 6 : 0 }}>{children}</div>
    </div>
  );
}

// Hand-drawn marker arrow along cubic path; draws between a..b seconds
export function Arrow({ t, a, b, d, len = 600, color = C.ink, width = 6, head }) {
  const p = ramp(t, a, b, EINOUT);
  if (p <= 0) return null;
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      {head && p > 0.97 ? <path d={head} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </g>
  );
}

// Highlighter sweep behind text (absolute box)
export function Highlight({ t, a, b, x, y, w, h = 40, color = C.hl, rot = -1.5 }) {
  const p = ramp(t, a, b, EOUT);
  return <div style={{ position: "absolute", left: x, top: y, width: w * p, height: h, background: color, borderRadius: 6, transform: `rotate(${rot}deg)`, transformOrigin: "0% 50%" }} />;
}

// Handwritten annotation that writes on (clip reveal left→right)
export function Hand({ t, a, b, x, y, size = 56, color = C.red, children, rot = -3 }) {
  const p = ramp(t, a, b, (v) => v);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `rotate(${rot}deg)`, clipPath: `inset(-20px ${100 - p * 100}% -20px -20px)`, textShadow: HAND_HALO, fontFamily: HAND, fontSize: size, color, whiteSpace: "nowrap", lineHeight: 1.1 }}>
      {children}
    </div>
  );
}

// Round stamp sticker
export function Stamp({ t, at, x, y, r = 34, color = C.red, children, size = 34 }) {
  const p = spr(t, at, 0.35);
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, background: color, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MARK, fontSize: size, transform: `scale(${lerp(1.6, 1, p)}) rotate(${lerp(-25, -8, p)}deg)`, opacity: Math.min(1, p * 2), boxShadow: "0 4px 8px rgba(60,50,30,0.2)" }}>
      {children}
    </div>
  );
}

// fade helper: in at a..a+d, optional out
export function fadeIO(t, a, d = 0.35, outAt = null) {
  const i = ramp(t, a, a + d);
  const o = outAt == null ? 1 : 1 - ramp(t, outAt, outAt + d);
  return i * o;
}

// Generic pop-in wrapper (absolute box)
export function Pop({ t, at, x, y, w, h, rot = 0, children, style = {}, out = null }) {
  const p = spr(t, at, 0.45);
  const o = out == null ? 1 : 1 - ramp(t, out, out + 0.3);
  if (p <= 0 || o <= 0) return null;
  const e = enter(p, "pop" + x + "," + y);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: e.opacity * o, transform: `${e.transform} rotate(${rot}deg)`, transformOrigin: "50% 50%", ...style }}>
      {children}
    </div>
  );
}

// Strike-through line drawn left→right (absolute svg)
export function Strike({ t, a, b = null, x, y, w, color = C.red, width = 8, rot = -4 }) {
  const p = ramp(t, a, b == null ? a + 0.35 : b, EINOUT);
  if (p <= 0) return null;
  return (
    <svg width={w + 20} height={60} style={{ position: "absolute", left: x - 10, top: y - 30, overflow: "visible", transform: `rotate(${rot}deg)` }}>
      <path d={`M 10 30 L ${10 + w * p} ${30 - 4 * p}`} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Hand-drawn tick
export function Tick({ t, a, x, y, size = 56, color = C.green, width = 9 }) {
  const p = ramp(t, a, a + 0.3, EINOUT);
  if (p <= 0) return null;
  const L = 2.2 * size;
  return (
    <svg width={size * 1.4} height={size * 1.2} style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
      <path d={`M ${size * 0.1} ${size * 0.6} L ${size * 0.5} ${size * 1.0} L ${size * 1.3} ${size * 0.1}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
    </svg>
  );
}

// Chat window card (white, top bar with dots)
export function ChatWin({ x, y, w, h, title = "新对话", children, rot = 0, opacity = 1, tint = C.white }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `rotate(${rot}deg)`, opacity, background: tint, borderRadius: 18, border: `3px solid ${C.ink}`, boxShadow: "0 8px 16px rgba(60,50,30,0.14)", overflow: "hidden" }}>
      <div style={{ height: 46, borderBottom: `3px solid ${C.ink}`, display: "flex", alignItems: "center", paddingLeft: 16, gap: 8, background: "rgba(34,37,43,0.04)" }}>
        <div style={{ width: 12, height: 12, borderRadius: 6, background: C.red }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: "#F2B53A" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, background: C.green }} />
        <div style={{ marginLeft: 10, fontFamily: BODY, fontSize: 24, fontWeight: 700, color: C.ink }}>{title}</div>
      </div>
      <div style={{ position: "relative", width: "100%", height: h - 46 }}>{children}</div>
    </div>
  );
}

// Big marker title with highlighter under part of it
export function Title({ t, at = 0, x = 120, y = 110, size = 72, children, hl = null }) {
  const p = ramp(t, at, at + 0.45);
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
      {hl ? <Highlight t={t} a={at + 0.3} b={at + 0.8} x={hl[0]} y={size * 0.62} w={hl[1]} h={size * 0.5} /> : null}
      <div style={{ position: "relative", fontFamily: MARK, fontSize: size, color: C.ink, whiteSpace: "nowrap" }}>{children}</div>
    </div>
  );
}


// ---------- cards, chips, bubbles, marks ----------
export function Card({ x, y, w, h, rot = 0, children, bg = C.white, style = {} }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `rotate(${rot}deg)`, background: bg, borderRadius: 14, border: `3px solid ${C.ink}`, boxShadow: "0 10px 20px rgba(60,50,30,0.14)", ...style }}>
      {children}
    </div>
  );
}

// word chip (rounded tag)
export function Chip({ t, at, x, y, children, color = C.white, size = 40, rot = 0, out = null }) {
  const p = spr(t, at, 0.4);
  const o = out == null ? 1 : 1 - ramp(t, out, out + 0.3);
  if (p <= 0 || o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: enter(p, "chip" + x + "," + y).opacity * o, transform: `${enter(p, "chip" + x + "," + y).transform} rotate(${rot}deg)`, transformOrigin: "0% 50%", background: color, border: `3px solid ${C.ink}`, borderRadius: 40, padding: "10px 28px", fontFamily: BODY, fontWeight: 700, fontSize: size, color: C.ink, whiteSpace: "nowrap", boxShadow: "0 4px 0 rgba(34,37,43,0.85)" }}>
      {children}
    </div>
  );
}

// speech bubble with tail (tail: "left" | "right")
export function Bubble({ t, at, x, y, children, color = C.white, size = 54, tail = "left", rot = 0, font = MARK, out = null, pad = "18px 34px" }) {
  const p = spr(t, at, 0.45);
  const o = out == null ? 1 : 1 - ramp(t, out, out + 0.3);
  if (p <= 0 || o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: enter(p, "bub" + x + "," + y).opacity * o, transform: `${enter(p, "bub" + x + "," + y).transform} rotate(${rot}deg)`, transformOrigin: tail === "left" ? "0% 100%" : "100% 100%" }}>
      <div style={{ position: "relative", background: color, border: `4px solid ${C.ink}`, borderRadius: 34, padding: pad, fontFamily: font, fontSize: size, color: C.ink, whiteSpace: "nowrap", boxShadow: "0 8px 16px rgba(60,50,30,0.18)" }}>
        {children}
        <svg width="46" height="40" style={{ position: "absolute", bottom: -36, [tail === "left" ? "left" : "right"]: 36, overflow: "visible" }}>
          <path d={tail === "left" ? "M 4 0 L 10 34 L 34 0" : "M 42 0 L 36 34 L 12 0"} fill={color} stroke={C.ink} strokeWidth="4" strokeLinejoin="round" />
          <path d={tail === "left" ? "M 6 -3 L 32 -3" : "M 14 -3 L 40 -3"} stroke={color} strokeWidth="6" />
        </svg>
      </div>
    </div>
  );
}

// hand-drawn X mark
export function XMark({ t, a, x, y, size = 60, color = C.red, width = 10 }) {
  const p1 = ramp(t, a, a + 0.18, EINOUT), p2 = ramp(t, a + 0.15, a + 0.33, EINOUT);
  if (p1 <= 0) return null;
  const L = size * 1.5;
  return (
    <svg width={size} height={size} style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
      <path d={`M 0 0 L ${size} ${size}`} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - p1)} />
      {p2 > 0 ? <path d={`M ${size} 0 L 0 ${size}`} stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - p2)} /> : null}
    </svg>
  );
}

// rectangular rubber stamp
export function RectStamp({ t, at, x, y, children, color = C.red, size = 56, rot = -10 }) {
  const p = spr(t, at, 0.3);
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${lerp(1.8, 1, p)}) rotate(${rot}deg)`, opacity: Math.min(1, p * 2) * 0.92, border: `6px solid ${color}`, borderRadius: 12, padding: "6px 22px", fontFamily: MARK, fontSize: size, color, whiteSpace: "nowrap", background: "rgba(250,248,243,0.7)" }}>
      {children}
    </div>
  );
}

// ECG line: mode "flat" draws a flat line, "beat" draws heartbeat; draws between a..b
export function ECG({ t, a, b, x, y, w = 600, h = 120, mode = "flat", color = C.red, width = 7 }) {
  const p = ramp(t, a, b, (v) => v);
  if (p <= 0) return null;
  let d = `M 0 ${h / 2}`;
  if (mode === "flat") {
    // one weak beat, then the line goes flat
    const s0 = 0, seg = w * 0.32;
    d += ` L ${s0 + seg * 0.35} ${h / 2} L ${s0 + seg * 0.45} ${h * 0.2} L ${s0 + seg * 0.55} ${h * 0.85} L ${s0 + seg * 0.63} ${h * 0.4} L ${s0 + seg * 0.7} ${h / 2} L ${w} ${h / 2}`;
  }
  else {
    const seg = w / 3;
    for (let k = 0; k < 3; k++) {
      const s0 = k * seg;
      d += ` L ${s0 + seg * 0.35} ${h / 2} L ${s0 + seg * 0.45} ${h * 0.15} L ${s0 + seg * 0.55} ${h * 0.95} L ${s0 + seg * 0.63} ${h * 0.35} L ${s0 + seg * 0.7} ${h / 2} L ${s0 + seg} ${h / 2}`;
    }
  }
  const L = mode === "flat" ? w * 1.5 : w * 2.2;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
    </svg>
  );
}

// text lines placeholder (manuscript)
export function Lines({ x, y, w, n = 6, gap = 44, color = "rgba(34,37,43,0.22)", widths = null, t = 99, at = 0, step = 0.06, h = 14 }) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const p = ramp(t, at + i * step, at + i * step + 0.25);
    const ww = (widths ? widths[i % widths.length] : (i === n - 1 ? 0.6 : 1)) * w;
    arr.push(<div key={i} style={{ position: "absolute", left: x, top: y + i * gap, width: ww * p, height: h, borderRadius: 7, background: color }} />);
  }
  return <>{arr}</>;
}

// numbered step header
export function StepHead({ t, n, label, sub, at = 0.05 }) {
  const p = spr(t, at, 0.45);
  return (
    <div style={{ position: "absolute", left: 120, top: 100, opacity: Math.min(1, p * 1.8), display: "flex", alignItems: "center", gap: 26, transform: `translateY(${(1 - p) * 20}px)` }}>
      <div style={{ width: 120, height: 120, borderRadius: 60, background: C.ink, color: C.white, fontFamily: MARK, fontSize: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
      <div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 36, color: C.muted }}>{sub}</div>
        <div style={{ fontFamily: MARK, fontSize: 72, color: C.ink, whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </div>
  );
}

// ---------- 小动作：圈重点、波浪线、弯箭头、橡皮擦、手绘小图标 ----------

// 手绘圈：在 (x,y,w,h) 外圈一个不太圆的椭圆，a..b 秒画完
export function DrawCircle({ t, a, b = null, x, y, w, h, color = C.red, width = 7, seed = "c" }) {
  const p = ramp(t, a, b == null ? a + 0.45 : b, EINOUT);
  if (p <= 0) return null;
  const cx = w / 2 + 20, cy = h / 2 + 20, rx = w / 2 + 14, ry = h / 2 + 12;
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const ang = -Math.PI * 0.6 + (i / 48) * Math.PI * 2.15;
    const wob = 1 + 0.035 * Math.sin(i * 0.33 + jit(seed, 3)) + 0.012 * Math.sin(i * 0.9);
    pts.push(`${(cx + Math.cos(ang) * rx * wob).toFixed(1)} ${(cy + Math.sin(ang) * ry * wob * (1 + i / 400)).toFixed(1)}`);
  }
  const L = Math.PI * (rx + ry) * 1.15;
  return (
    <svg width={w + 40} height={h + 40} style={{ position: "absolute", left: x - 20, top: y - 20, overflow: "visible", transform: `rotate(${jit(seed + "r", 3)}deg)` }}>
      <path d={"M " + pts.join(" L ")} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
    </svg>
  );
}

// 波浪下划线
export function Wavy({ t, a, b = null, x, y, w, color = C.red, width = 6, amp = 9, period = 46 }) {
  const p = ramp(t, a, b == null ? a + 0.4 : b, EINOUT);
  if (p <= 0) return null;
  let d = `M 0 ${amp}`;
  for (let s = 0; s < w; s += period / 2) d += ` Q ${s + period / 4} ${s / (period / 2) % 2 ? amp * 2 : 0} ${s + period / 2} ${amp}`;
  const L = w * 1.35;
  return (
    <svg width={w} height={amp * 2 + 4} style={{ position: "absolute", left: x, top: y, overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - p)} />
    </svg>
  );
}

// 弯箭头：从 (x1,y1) 指向 (x2,y2)，bend 控制弯曲方向和程度
export function CurveArrow({ t, a, b = null, x1, y1, x2, y2, bend = 0.25, color = C.ink, width = 6 }) {
  const p = ramp(t, a, b == null ? a + 0.45 : b, EINOUT);
  if (p <= 0) return null;
  const mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
  const len = Math.hypot(x2 - x1, y2 - y1) * (1 + Math.abs(bend));
  const ang = Math.atan2(y2 - my, x2 - mx), hl = 26;
  const h1 = `${x2 - hl * Math.cos(ang - 0.45)} ${y2 - hl * Math.sin(ang - 0.45)}`, h2 = `${x2 - hl * Math.cos(ang + 0.45)} ${y2 - hl * Math.sin(ang + 0.45)}`;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      {p > 0.95 ? <path d={`M ${h1} L ${x2} ${y2} L ${h2}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

// 橡皮擦：a..b 秒从左到右把 (x,y,w,h) 擦成纸色，擦过的地方留一点擦痕
// 橡皮擦：把 (x,y,w,h) 这块从左到右擦掉。擦过的地方重画同一张纸（牛皮纸、软木板的纹理也能无缝接上）
export function Erase({ t, a, b, x, y, w, h }) {
  const p = ramp(t, a, b, (v) => v);
  if (p <= 0) return null;
  const ex = x + w * p;
  return (
    <>
      <div style={{ position: "absolute", left: x - 10, top: y - 10, width: (w + 20) * p, height: h + 20, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg, black calc(100% - 12px), transparent)", maskImage: "linear-gradient(90deg, black calc(100% - 12px), transparent)" }}>
        <div style={{ position: "absolute", left: -(x - 10), top: -(y - 10), width: W, height: H }}><Paper fill /></div>
      </div>
      <div style={{ position: "absolute", left: x - 6, top: y + h * 0.3, width: (w + 12) * p, height: 4, background: "rgba(120,110,100,0.12)", transform: "rotate(-1deg)" }} />
      {p < 1 ? (
        <div style={{ position: "absolute", left: ex - 40, top: y + h / 2 - 50 + Math.sin(p * 40) * 14, width: 80, height: 100, transform: "rotate(-18deg)", borderRadius: 10, overflow: "hidden", boxShadow: "0 6px 10px rgba(0,0,0,0.2)" }}>
          <div style={{ height: "55%", background: "#F7A8B8" }} />
          <div style={{ height: "45%", background: "#4A78C2" }} />
        </div>
      ) : null}
    </>
  );
}

// 手绘小图标：bulb 灯泡 | question 问号 | exclaim 感叹号 | star 星星 | fire 火 | heart 爱心 | bolt 闪电 | check 打勾圈 | eyes 眼睛
const DOODLES = {
  bulb: ["M 30 62 C 10 48 12 14 40 10 C 68 14 70 48 50 62 L 50 74 L 30 74 Z", "M 31 82 L 49 82", "M 34 90 L 46 90", "M 40 22 L 40 30", "M 6 30 L 14 33", "M 74 30 L 66 33"],
  question: ["M 22 30 C 22 8 60 6 60 28 C 60 44 40 44 40 60 L 40 66", "M 40 84 L 40 86"],
  exclaim: ["M 40 10 L 40 62", "M 40 82 L 40 84"],
  star: ["M 40 6 L 50 32 L 78 33 L 56 50 L 64 77 L 40 61 L 16 77 L 24 50 L 2 33 L 30 32 Z"],
  fire: ["M 40 88 C 12 86 8 56 26 38 C 26 52 34 54 36 46 C 32 28 42 14 52 6 C 50 24 72 34 70 60 C 68 78 56 88 40 88 Z"],
  heart: ["M 40 80 C 10 58 2 38 14 22 C 24 10 38 16 40 28 C 42 16 56 10 66 22 C 78 38 70 58 40 80 Z"],
  bolt: ["M 48 4 L 18 50 L 40 50 L 30 88 L 64 36 L 42 36 Z"],
  check: ["M 40 4 C 64 4 78 20 78 42 C 78 66 62 80 40 80 C 16 80 2 64 2 42 C 2 18 18 4 40 4", "M 20 42 L 34 58 L 62 26"],
  eyes: ["M 6 44 C 18 22 36 22 40 44 C 36 64 18 64 6 44 Z", "M 42 44 C 54 22 72 22 76 44 C 72 64 54 64 42 44 Z", "M 24 44 L 25 44", "M 60 44 L 61 44"],
};
export function Doodle({ t, at, kind = "star", x, y, size = 90, color = C.red, width = 6, fill = null, dur = 0.5 }) {
  const p = ramp(t, at, at + dur, EINOUT);
  if (p <= 0) return null;
  const paths = DOODLES[kind] || DOODLES.star;
  const k = size / 90;
  return (
    <svg width={size} height={size} viewBox="0 0 80 92" style={{ position: "absolute", left: x, top: y, overflow: "visible", transform: `rotate(${jit("dd" + kind + x, 8)}deg) scale(${0.85 + 0.15 * spr(t, at, 0.4)})` }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill={fill && i === 0 && p > 0.9 ? fill : "none"} stroke={color} strokeWidth={width / k} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0, Math.min(1, p * paths.length - i))} />
      ))}
    </svg>
  );
}
