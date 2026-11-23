import React from "react";
import { Easing, Img, staticFile } from "remotion";
import {
  useK, useT, ramp, lerp, clamp, pulse, In, Panel, BaseFill, CardBox, Kicker, Title, Num, Mark, Strike, Tick, Chip, Source,
  hexA, textW, fitSize, charW, SANS, SERIF, WARN, WARN_SOFT, INK, ZONE, CIRCLE,
} from "./lib.jsx";

// 高级感干货风 · 批次 C「原文、流程、互动与结尾」
// doc 文件高亮卡 / shot 截图标注 / chat 聊天记录 / steps 步骤卡 / checklist 自查清单 / flow 流程图(C) / qa 评论问答 / end 片尾收藏卡
// trio 清单·对比表·聊天三合一 / savescore 省时间+质量分 / line 折线图
// 所有时间都是段内秒。颜色一律从 useK() 取。

// ---------- 私有小工具 ----------
const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
const outOf = (spec, dur) => num(spec.out, dur - 0.3);
// B 场景卡片默认 0.2 秒进（底色先展开）；上一段已展开底色时 0 秒进
const cardAtOf = (spec) => num(spec.at, spec.panelIn === false ? 0 : 0.2);

// B 上卡下人：底色 + 卡片
function BStage({ spec, t, dur, children }) {
  const a = spec.panelIn === false ? -1 : 0;
  const b = spec.panelOut === false ? null : dur;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Panel t={t} a={a} b={b} />
      {children}
    </div>
  );
}

// 估算文字在 maxW 宽里折成几行（支持 \n）
function countLines(text, size, maxW, ls = 0) {
  let lines = 1, x = 0;
  for (const ch of [...String(text || "")]) {
    if (ch === "\n") { lines++; x = 0; continue; }
    const w = charW(ch) * size * 1.04 + ls * size;
    if (x + w > maxW && x > 0) { lines++; x = w; } else x += w;
  }
  return lines;
}
// 截到 maxLines 行以内，末尾留出省略号的位置
function clipToLines(text, size, maxW, maxLines) {
  const chars = [...String(text || "")];
  let lines = 1, x = 0, i = 0;
  for (; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\n") { lines++; x = 0; if (lines > maxLines) break; continue; }
    const w = charW(ch) * size * 1.04;
    if (x + w > maxW && x > 0) { lines++; x = w; if (lines > maxLines) break; } else x += w;
  }
  if (i >= chars.length) return { text: chars.join(""), cut: false };
  return { text: chars.slice(0, Math.max(0, i - 2)).join("").replace(/[，。、；：,.\s]+$/, ""), cut: true };
}
// 把一段话按若干「荧光笔」子串切成片段
function splitMarks(text, marks) {
  const out = [];
  let rest = text, cursor = 0;
  const list = marks.filter((m) => m.text).map((m) => ({ ...m, idx: text.indexOf(m.text) })).filter((m) => m.idx >= 0).sort((a, b) => a.idx - b.idx);
  for (const m of list) {
    if (m.idx < cursor) continue;
    if (m.idx > cursor) out.push({ s: text.slice(cursor, m.idx) });
    out.push({ s: m.text, m });
    cursor = m.idx + m.text.length;
  }
  if (cursor < text.length) out.push({ s: text.slice(cursor) });
  return out.length ? out : [{ s: rest }];
}
// 标题里的数字自动换数字字体
function Numify({ text, size, color }) {
  const parts = String(text || "").split(/(\d+(?:\.\d+)?%?)/);
  return (
    <>
      {parts.map((p, i) => (/^\d/.test(p) ? <Num key={i} size={size * 1.22} color={color} style={{ margin: "0 0.06em" }}>{p}</Num> : <span key={i}>{p}</span>))}
    </>
  );
}
// 标题一行字号：elegant（细宋）带 0.06em 字距，估宽时扣掉
const isElegant = (K) => K.T.title === "elegant" || K.T.title === "xiaowei";
const fitTitle = (K, text, w, max, min) => fitSize(text, isElegant(K) ? w / 1.07 : w, max, min);
// 底色上的强调字（浅底用深一档）
const baseAc = (K) => (K.baseDark ? K.accent : K.accentDeep);
// 卡片上的「强调底」：浅卡用墨黑，深卡用强调色
const solidBg = (K) => (K.lightCard ? INK : K.accent);
const solidFg = (K) => (K.lightCard ? K.accent : INK);

// 右上角小标签（原文 / 示意 …）
function Stamp({ children, style }) {
  const K = useK();
  return <div style={{ position: "absolute", right: 40, top: 40, fontFamily: SANS, fontSize: 26, fontWeight: 800, letterSpacing: "0.08em", background: solidBg(K), color: solidFg(K), padding: "5px 18px", borderRadius: 30, whiteSpace: "nowrap", ...style }}>{children}</div>;
}

// ============================================================
// 1. doc 文件高亮卡（B）
// spec: source 来源小字, article 条号/标题, text 原文（可含 \n 分段）, marks [{text, at, bold}], label 右上标签, note 底部来源, zoom 推近量
// ============================================================
function DocScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const at = cardAtOf(spec), out = outOf(spec, dur);
  const marks = (spec.marks || (spec.mark ? [spec.mark] : [])).map((m, i) => (typeof m === "string" ? { text: m, at: at + 1.0 + 0.8 * i } : { ...m, at: num(m.at, at + 1.0 + 0.8 * i) }));
  const h = 600, innerW = 936 - 108;
  const hasSrc = !!spec.source, hasArt = !!spec.article, hasNote = !!spec.note;
  const artSize = hasArt ? fitSize(spec.article, innerW - (hasSrc ? 0 : 150), 58, 34) : 0;
  const head = (hasSrc ? 40 : 0) + (hasArt ? artSize * 1.3 + 6 : 0);
  const bodyMaxH = h - 46 - 40 - head - 18 - (hasNote ? 46 : 0);
  const lh = 1.72;
  const raw = String(spec.text || "");
  // 先在 44→30 号里找能放下（最多 6 行）的字号；放不下就用 30 号截断加省略号
  let size = 30, shown = raw, cut = false;
  const wrapW = innerW * 0.96;
  let found = false;
  for (let s = 44; s >= 30; s--) {
    const n = countLines(raw, s, wrapW);
    if (n <= 6 && n * s * lh <= bodyMaxH) { size = s; found = true; break; }
  }
  if (!found) {
    const maxLines = Math.max(1, Math.min(6, Math.floor(bodyMaxH / (30 * lh))));
    const c = clipToLines(raw, 30, wrapW, maxLines);
    shown = c.text; cut = c.cut;
  }
  const segs = splitMarks(shown, marks);
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={h} zoom={num(spec.zoom, 0.04)} pad="46px 54px 40px">
        <div style={{ fontFamily: SERIF }}>
          {hasSrc ? <div style={{ fontSize: 28, color: K.cardMuted, letterSpacing: "0.1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: innerW - 150, lineHeight: 1.4 }}>{spec.source}</div> : null}
          {hasArt ? <div style={{ fontSize: artSize, fontWeight: 900, marginTop: 6, lineHeight: 1.3, whiteSpace: "nowrap" }}>{spec.article}</div> : null}
          <div style={{ fontSize: size, lineHeight: lh, marginTop: 18, color: K.cardText, opacity: K.lightCard ? 0.9 : 0.94, textAlign: "justify", whiteSpace: "pre-wrap", width: innerW }}>
            {segs.map((g, i) =>
              g.m ? (
                <Mark key={i} t={t} at={g.m.at} dur={0.55}>{g.m.bold ? <b style={{ fontWeight: 900 }}>{g.s}</b> : g.s}</Mark>
              ) : (
                <span key={i}>{g.s}</span>
              )
            )}
            {cut ? "……" : null}
          </div>
        </div>
        {hasNote ? <Source style={{ bottom: 30 }}>{spec.note}</Source> : null}
        <Stamp>{spec.label || "原文"}</Stamp>
      </CardBox>
    </BStage>
  );
}

// ============================================================
// 2. shot 截图标注（B）
// spec: src 截图：项目图片素材的 assetId（推荐：push_asset 导入图片，用返回的 assetId），或与入口同目录的文件名如 "shots/a.png"（staticFile）；不写就画示意占位
//       ratio 宽/高：建议写（inspect_asset 返回的 width/height 相除）。不写也能用：播放/导出时按图片实际比例自动算；
//             但 preview_timeline 跳着抽帧时，每段第一次抽到的那帧可能还没读到比例，先显示「按宽铺满的截图顶部、无框」
//       kicker, title（一行放不下先缩到 34 号，再不行折两行、超出加省略号）, source（kicker/source 都可省）
//       boxes [{x,y,w,h,at}]：0–1 比例，相对整张截图（左上角 0,0）；at = 框线开始画的时刻，默认 卡片at+1.4、之后每个 +1.2
//       note {text, at, box}：气泡，默认指向第 0 个框，at 默认 = 该框 at + 0.5；框右边放得下就放右边，否则放框下方/上方
//       focus：镜头怎么找框。"auto"（默认）| "zoom" 推近到框 | "scroll" 按宽铺满、滚动到框 | "none" 整图不动（旧版式）
//       start：scroll 时开头显示的位置（0–1，截图这个高度对齐窗口上沿；默认 0 = 从顶部开始）
// auto：长截图（宽/高 < 0.35）或缩进窗口后太窄的方图/文件 → scroll；手机单屏（0.35–0.8）框窄 → 左图右文 + zoom，框宽（>0.6）→ scroll；
//       横图 → zoom（推到框宽约占窗口 86%、最多 3.5 倍；框本来够大就基本不推）
// 时刻：卡片进场后最早在 卡片at+0.8 开始动镜头；框 i 的镜头移动在 at 之前完成（zoom 0.6s；scroll 0.6–1.4s 按距离；
//       离上一个框不到 0.6s 就压缩到最短 0.35s）；at 起框线 0.45s 画完、框外 0.3s 压暗；镜头去下一个框时压暗 0.25s 退掉；
//       note.at 起气泡 0.36s 出现，它指的框被镜头带出窗口时淡出
// ============================================================
const SHOT = { h: 610, padX: 48, padY: 40, zoomMax: 3.5 };
const SHOT_RATIO = {}; // src → 实际宽高比（图片加载后记下）
function shotSrc(src) {
  if (!src || typeof src !== "string") return null;
  if (/^(https?:|data:|blob:)/.test(src)) return src;
  if (/\.(png|jpe?g|webp|gif)$/i.test(src)) return staticFile(src.replace(/^\.?\//, "")); // 入口同目录的文件
  return src; // 项目素材 assetId
}
function Placeholder({ w, h }) {
  const K = useK();
  const bg = K.lightCard ? "#E8E3D9" : "rgba(255,255,255,0.06)";
  const blk = K.lightCard ? "rgba(18,22,28,0.10)" : "rgba(255,255,255,0.10)";
  const blk2 = K.lightCard ? "rgba(18,22,28,0.06)" : "rgba(255,255,255,0.06)";
  const r = (x, y, ww, hh, c = blk, rad = 8) => <div style={{ position: "absolute", left: x * w, top: y * h, width: ww * w, height: hh * h, background: c, borderRadius: rad }} />;
  return (
    <div style={{ position: "absolute", inset: 0, background: bg }}>
      {r(0, 0, 1, 0.1, blk2, 0)}
      {r(0.05, 0.025, 0.25, 0.05)}
      {r(0.05, 0.15, 0.1, 0.1 * w > 0 ? (0.1 * w) / h : 0.1, blk, 999)}
      {r(0.2, 0.16, 0.45, 0.035)}
      {r(0.2, 0.22, 0.3, 0.03, blk2)}
      {r(0.05, 0.36, 0.9, 0.2, blk2, 12)}
      {r(0.09, 0.4, 0.5, 0.04)}
      {r(0.09, 0.48, 0.35, 0.03, blk)}
      {r(0.7, 0.42, 0.2, 0.08)}
      {r(0.05, 0.62, 0.9, 0.035, blk2)}
      {r(0.05, 0.69, 0.75, 0.035, blk2)}
      {r(0.05, 0.76, 0.85, 0.035, blk2)}
      {r(0.05, 0.86, 0.9, 0.09, blk, 12)}
      <div style={{ position: "absolute", right: 14, bottom: 10, fontFamily: SANS, fontSize: 22, color: K.cardMuted, opacity: 0.8 }}>示意图</div>
    </div>
  );
}
// 框线：r 是窗口内像素坐标（已含推近/滚动），线宽不随推近变粗
function Frame({ t, at, r, leave = 1e9 }) {
  const K = useK();
  const p = ramp(t, at, at + 0.45, Easing.out(Easing.quad));
  if (p <= 0) return null;
  const per = 2 * (r.w + r.h);
  // 框外压暗：画框时压下去，镜头要去下一个框时退掉
  const dim = 0.38 * ramp(t, at, at + 0.3) * (1 - ramp(t, leave, leave + 0.25));
  return (
    <>
      {dim > 0.001 ? <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: 10, boxShadow: `0 0 0 3000px rgba(0,0,0,${dim})` }} /> : null}
      <svg style={{ position: "absolute", left: r.x - 6, top: r.y - 6, overflow: "visible" }} width={r.w + 12} height={r.h + 12}>
        <rect x={3} y={3} width={r.w + 6} height={r.h + 6} rx={10} fill="none" stroke={K.accent} strokeWidth={5} strokeDasharray={per + 60} strokeDashoffset={(per + 60) * (1 - p)} />
      </svg>
    </>
  );
}
// 标注气泡：dir = "down"（气泡在框下方，尖角朝上）| "up" | "left"（气泡在右侧，尖角朝左）
function Bubble({ t, at, text, x, y, w, size, dir, tip, fade = 1 }) {
  const K = useK();
  const p = ramp(t, at, at + 0.36);
  if (p <= 0 || fade <= 0) return null;
  const bg = solidBg(K), fg = K.lightCard ? "#FFFFFF" : INK;
  const tri = 14;
  let triStyle;
  if (dir === "down") triStyle = { left: tip - tri, top: -tri + 1, borderLeft: `${tri}px solid transparent`, borderRight: `${tri}px solid transparent`, borderBottom: `${tri}px solid ${bg}` };
  else if (dir === "up") triStyle = { left: tip - tri, bottom: -tri + 1, borderLeft: `${tri}px solid transparent`, borderRight: `${tri}px solid transparent`, borderTop: `${tri}px solid ${bg}` };
  else triStyle = { top: tip - tri, left: -tri + 1, borderTop: `${tri}px solid transparent`, borderBottom: `${tri}px solid transparent`, borderRight: `${tri}px solid ${bg}` };
  const off = dir === "down" ? { y: lerp(-10, 0, p), x: 0 } : dir === "up" ? { y: lerp(10, 0, p), x: 0 } : { x: lerp(-12, 0, p), y: 0 };
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, opacity: p * fade, transform: `translate(${off.x}px, ${off.y}px)`, zIndex: 3 }}>
      <div style={{ position: "relative", background: bg, color: fg, fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.4, padding: `${Math.round(size * 0.36)}px ${Math.round(size * 0.62)}px`, borderRadius: 14, boxShadow: "0 8px 22px rgba(0,0,0,0.25)", whiteSpace: dir === "left" ? "normal" : "nowrap" }}>
        <div style={{ position: "absolute", width: 0, height: 0, ...triStyle }} />
        {text}
      </div>
    </div>
  );
}
// 头部（kicker + 标题）排版：标题一行放不下先缩到 34，再不行按 36 号折两行（超出截断加省略号）
function shotHead(K, spec, w, titleMax) {
  const kH = spec.kicker ? 36 : 0;
  let tSize = 0, tLines = 0, tText = spec.title ? String(spec.title) : "";
  const el = isElegant(K) ? 1.07 : 1;
  if (tText) {
    tSize = fitTitle(K, tText, w, titleMax, 34);
    if (textW(tText, tSize) * el <= w) tLines = 1;
    else {
      tSize = Math.min(titleMax - 4, 36);
      const c = clipToLines(tText, tSize * el, w, 2);
      tText = c.cut ? c.text + "…" : c.text;
      tLines = clamp(countLines(tText, tSize * el, w), 1, 2);
    }
  }
  const tH = tLines ? tLines * tSize * 1.3 + 4 : 0;
  return { kH, tSize, tLines, tText, h: kH + tH + (kH || tH ? 18 : 0) };
}
// 镜头：图片左上角相对窗口的位置 (ox, oy) 和放大倍数 s
// 镜头：图片左上角相对「图区」的位置 (ox, oy) 和放大倍数 s。图比图区小的方向居中，比图区大的方向不露边
function camFit(area, iw, ih, s, cx, cy) {
  const sw = iw * s, sh = ih * s;
  const ox = sw <= area.w ? (area.w - sw) / 2 : clamp(area.w / 2 - cx * s, area.w - sw, 0);
  const oy = sh <= area.h ? (area.h - sh) / 2 : clamp(area.h / 2 - cy * s, area.h - sh, 0);
  return { s, ox, oy };
}
function shotCam(mode, b, iw, ih, area, start) {
  if (mode === "scroll") {
    // 框中心放在图区 40% 高处，下方留出气泡位置；框比图区还高时让框顶留在 8% 处
    const cy = !b ? start * ih + area.h / 2 : b.h * ih > area.h * 0.8 ? b.y * ih - area.h * 0.08 + area.h / 2 : (b.y + b.h / 2) * ih + area.h * 0.1;
    return camFit(area, iw, ih, 1, iw / 2, cy);
  }
  if (mode === "zoom" && b) {
    const s = clamp(Math.min((area.w * 0.86) / Math.max(1, b.w * iw), (area.h * 0.5) / Math.max(1, b.h * ih)), 1, SHOT.zoomMax);
    return camFit(area, iw, ih, s, (b.x + b.w / 2) * iw, (b.y + b.h / 2) * ih);
  }
  return camFit(area, iw, ih, 1, iw / 2, ih / 2);
}
const camLerp = (a, b, p) => ({ s: lerp(a.s, b.s, p), ox: lerp(a.ox, b.ox, p), oy: lerp(a.oy, b.oy, p) });
function camAt(t, cam0, moves) {
  let c = cam0;
  for (const m of moves) {
    if (t < m.t0) break;
    c = camLerp(m.from, m.to, ramp(t, m.t0, m.t1, Easing.inOut(Easing.cubic)));
  }
  return c;
}
function ShotScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const src = shotSrc(spec.src);
  // 宽高比：以图片实际比例为准（加载后记进 SHOT_RATIO，同一张图之后的帧/段直接用）；不写 ratio 且还没读到时，图区先不显示
  const known = src ? SHOT_RATIO[src] : null;
  const [natRatio, setNatRatio] = React.useState(known || null);
  const at = cardAtOf(spec), out = outOf(spec, dur);
  const ratio = natRatio || num(spec.ratio, 16 / 10);
  const pending = !!src && !natRatio && !(typeof spec.ratio === "number");
  const { h: cardH, padX, padY } = SHOT;
  const innerW = 936 - padX * 2, innerH = cardH - padY * 2;
  const boxes = (spec.boxes || []).map((b, i) => ({ x: 0.1, y: 0.1, w: 0.3, h: 0.2, ...b, at: num(b.at, at + 1.4 + 1.2 * i) }));
  const note = spec.note ? (typeof spec.note === "string" ? { text: spec.note } : spec.note) : null;
  const noteIdx = clamp(num(note && note.box, 0), 0, Math.max(0, boxes.length - 1));
  const noteBox = note ? boxes[noteIdx] : null;
  const noteAt = note ? num(note.at, (noteBox ? noteBox.at : at + 1) + 0.5) : 0;
  const hasSrc = !!spec.source;
  const srcH = hasSrc ? 40 : 0;
  const focus = ["zoom", "scroll", "none"].includes(spec.focus) ? spec.focus : "auto";

  // 版式：上文下图 / 左图右文（手机单屏）
  const stackHead = shotHead(K, spec, innerW, 44);
  const stackArea = { x: 0, y: stackHead.h, w: innerW, h: innerH - stackHead.h - srcH };
  const containW = Math.min(stackArea.w, stackArea.h * ratio);
  let mode, side;
  if (focus === "none") { mode = "none"; side = ratio < 0.8; }
  else if (focus === "scroll") { mode = "scroll"; side = false; }
  else if (focus === "zoom") { mode = "zoom"; side = ratio < 0.8; }
  else if (ratio < 0.35) { mode = "scroll"; side = false; }
  else if (ratio < 0.8) { const wide = boxes.some((b) => b.w > 0.6); mode = wide ? "scroll" : "zoom"; side = !wide; }
  else { mode = containW < innerW * 0.7 ? "scroll" : "zoom"; side = false; }

  let area, iw, ih, colX = 0, colW = innerW;
  if (side) {
    area = { x: 0, y: 0, w: Math.round(innerW * 0.46), h: innerH };
    ih = area.h; iw = ih * ratio;
    if (iw > area.w) { iw = area.w; ih = iw / ratio; }
    colX = area.w + 40; colW = innerW - colX;
  } else if (mode === "scroll") {
    area = stackArea; iw = area.w; ih = iw / ratio;
  } else {
    area = stackArea; iw = containW; ih = iw / ratio;
  }
  const H = side ? shotHead(K, spec, colW, 40) : stackHead;

  // 镜头时间线：每个框在自己的 at 之前移动到位
  const start = clamp(num(spec.start, 0), 0, 1);
  const cam0 = shotCam(mode, null, iw, ih, area, start);
  const moves = [];
  // 卡片进场后先停一下（最多到 at+0.8）再动镜头，让观众看清整图/页面顶部
  const hold0 = boxes.length ? Math.min(at + 0.8, Math.max(at + 0.36, boxes[0].at - 0.4)) : at;
  let prev = cam0;
  const leaveAt = boxes.map(() => 1e9);
  boxes.forEach((b, i) => {
    const c = shotCam(mode, b, iw, ih, area, start);
    const dist = Math.max(Math.abs(c.oy - prev.oy), Math.abs(c.ox - prev.ox), Math.abs(c.s - prev.s) * 300);
    if (i > 0) leaveAt[i - 1] = b.at;
    if (dist < 2) return;
    const md = mode === "scroll" ? clamp(0.45 + (0.3 * Math.abs(c.oy - prev.oy)) / area.h, 0.6, 1.4) : 0.6;
    // 在上一个框上至少停 0.6s 再走；时间太挤就压缩移动（最短 0.35s），保证 at 时镜头已到位
    const earliest = i > 0 ? boxes[i - 1].at + 0.6 : hold0;
    const t1 = b.at, t0 = Math.max(b.at - md, Math.min(earliest, b.at - 0.35));
    moves.push({ t0, t1, from: prev, to: c });
    if (i > 0) leaveAt[i - 1] = t0;
    prev = c;
  });
  const cam = camAt(t, cam0, moves);
  const sw = iw * cam.s, sh = ih * cam.s;
  // 窗口 = 图片和图区的交集（不推近时就是图片本身，推近后撑满图区）
  const wx0 = Math.max(0, cam.ox), wy0 = Math.max(0, cam.oy);
  const win = { x: area.x + wx0, y: area.y + wy0, w: Math.min(area.w, cam.ox + sw) - wx0, h: Math.min(area.h, cam.oy + sh) - wy0 };
  // 框在窗口内的像素位置
  const rectOf = (b, c = cam) => ({ x: c.ox - Math.max(0, c.ox) + b.x * iw * c.s, y: c.oy - Math.max(0, c.oy) + b.y * ih * c.s, w: b.w * iw * c.s, h: b.h * ih * c.s });

  // 气泡（坐标：卡片内边距内）
  let bubble = null;
  if (note && noteBox) {
    const r = rectOf(noteBox);
    const cx = win.x + r.x + r.w / 2, cy = win.y + r.y + r.h / 2;
    // 框中心离开窗口就淡出（后面的框把镜头带走时）
    const outDist = Math.max(win.x - cx, cx - (win.x + win.w), win.y - cy, cy - (win.y + win.h), 0);
    const fade = 1 - clamp(outDist / 40, 0, 1);
    if (!side) {
      const size = fitSize(note.text, innerW - 40, 34, 24);
      const bw = textW(note.text, size) + size * 1.24 + 4;
      const bh = size * 1.4 + size * 0.72;
      const bx = clamp(cx - bw / 2, -padX + 16, innerW + padX - 16 - bw);
      // 上下方向按气泡出现那一刻的镜头定，之后不翻转
      const camN = camAt(noteAt, cam0, moves);
      const rN = rectOf(noteBox, camN);
      const below = Math.max(0, camN.oy) + rN.y + rN.h / 2 < area.h * 0.55;
      const boxTop = win.y + r.y, boxBot = win.y + r.y + r.h;
      // 框右边放得下就放右边（不挡上下文字），否则放下方/上方
      const rightX = area.x + Math.max(0, camN.ox) + rN.x + rN.w + 6 + 20;
      if (rightX + bw <= innerW + padX - 16) {
        const by = clamp(cy - bh / 2, -padY + 12, innerH + padY - 12 - bh);
        const rx = win.x + r.x + r.w + 6 + 20;
        bubble = <Bubble t={t} at={noteAt} text={note.text} x={rx} y={by} w={bw} size={size} dir="left" tip={clamp(cy - by, 22, bh - 22)} fade={fade} />;
      } else {
        const by = below ? Math.min(boxBot + 22, innerH + padY - 12 - bh) : Math.max(boxTop - 22 - bh, -padY + 12);
        bubble = <Bubble t={t} at={noteAt} text={note.text} x={bx} y={by} w={bw} size={size} dir={below ? "down" : "up"} tip={clamp(cx - bx, 26, bw - 26)} fade={fade} />;
      }
    } else {
      const size = countLines(note.text, 34, colW - 44) <= 3 ? 34 : 28;
      const lines = countLines(note.text, size, colW - size * 1.24);
      const bh = lines * size * 1.4 + size * 0.72;
      const by = clamp(cy - bh / 2, H.h + 10, innerH - srcH - bh);
      bubble = <Bubble t={t} at={noteAt} text={note.text} x={colX} y={by} w={colW} size={size} dir="left" tip={clamp(cy - by, 22, bh - 22)} fade={fade} />;
    }
  }

  const headEl = (
    <div style={{ position: "absolute", left: side ? colX : 0, top: 0, width: side ? colW : innerW }}>
      {spec.kicker ? <Kicker size={26} style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: side ? colW : innerW }}>{spec.kicker}</Kicker> : null}
      {H.tText ? <Title size={H.tSize} style={{ marginTop: 4, whiteSpace: H.tLines > 1 ? "normal" : "nowrap", width: side ? colW : innerW }}>{H.tText}</Title> : null}
    </div>
  );
  // 长截图滚动条（提示这是长图、滚到了哪）
  const track = win.h - 24, thumb = mode === "scroll" && sh > win.h + 1 ? Math.max(28, (win.h / sh) * track) : 0;
  const thumbY = thumb ? 12 + (-cam.oy / (sh - win.h)) * (track - thumb) : 0;
  const onLoad = (e) => {
    const el = e && (e.currentTarget || e.target);
    if (el && el.naturalWidth && el.naturalHeight) {
      const r = el.naturalWidth / el.naturalHeight;
      SHOT_RATIO[src] = r;
      if (!natRatio || Math.abs(r - natRatio) > 0.001) setNatRatio(r);
    }
  };
  // 还没读到比例（单帧跳着预览时的第一帧）：先按宽铺满、显示截图顶部，不画框和气泡
  const pendingEl = pending ? (
    <div style={{ position: "absolute", left: stackArea.x, top: stackArea.y, width: stackArea.w, height: stackArea.h, borderRadius: 12, overflow: "hidden", border: `1.5px solid ${K.cardLine}`, background: K.lightCard ? "#FFFFFF" : "rgba(255,255,255,0.04)" }}>
      <Img src={src} onLoad={onLoad} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", display: "block" }} />
    </div>
  ) : null;
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={cardH} pad={`${padY}px ${padX}px`}>
        <div style={{ position: "absolute", left: padX, top: padY, width: innerW, height: innerH }}>
          {headEl}
          {pendingEl}
          {pending ? null : (
            <div style={{ position: "absolute", left: win.x, top: win.y, width: win.w, height: win.h, borderRadius: 12, overflow: "hidden", border: `1.5px solid ${K.cardLine}`, background: K.lightCard ? "#FFFFFF" : "rgba(255,255,255,0.04)" }}>
              <div style={{ position: "absolute", left: cam.ox - wx0, top: cam.oy - wy0, width: sw, height: sh }}>
                {src ? <Img src={src} onLoad={onLoad} style={{ width: "100%", height: "100%", objectFit: "fill", display: "block" }} /> : <Placeholder w={sw} h={sh} />}
              </div>
              {boxes.map((b, i) => <Frame key={i} t={t} at={b.at} r={rectOf(b)} leave={leaveAt[i]} />)}
              {thumb ? <div style={{ position: "absolute", right: 6, top: thumbY, width: 5, height: thumb, borderRadius: 3, background: "rgba(110,116,126,0.55)" }} /> : null}
            </div>
          )}
          {pending ? null : bubble}
        </div>
        {hasSrc ? <Source style={{ bottom: 26, left: side ? padX + colX : 48, right: 48 }}>{spec.source}</Source> : null}
      </CardBox>
    </BStage>
  );
}

// ============================================================
// 3. chat 聊天记录（B）
// spec: who 对象名, sub 对象名下的小字, msgs [{me, text, at, mark, markAt}]（mark=true 整句，或子串）, source
// ============================================================
function ChatScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const at = cardAtOf(spec), out = outOf(spec, dur);
  const h = 610, padX = 44, innerW = 936 - padX * 2;
  const hasSrc = !!spec.source;
  const headH = 84;
  const areaH = h - 36 - headH - 14 - (hasSrc ? 54 : 28);
  let msgs = (spec.msgs || []).map((m, i) => ({ ...m, at: num(m.at, at + 0.35 + 0.12 * i) }));
  const av = 56, gapAv = 16, bubMax = innerW - (av + gapAv) * 2 + 40;
  // 找能放下的字号；26 号还放不下就从最早的消息开始舍去
  const need = (list, fs) => list.reduce((a, m) => a + countLines(m.text, fs, bubMax - fs * 1.2) * fs * 1.42 + fs * 0.9 + 16, 0) - 16;
  let fs = 26;
  for (let s = 38; s >= 26; s--) { if (need(msgs, s) <= areaH) { fs = s; break; } }
  while (msgs.length > 1 && need(msgs, fs) > areaH) msgs = msgs.slice(1);
  const lastAt = msgs.length ? msgs[msgs.length - 1].at : at;
  const who = spec.who || "对方";
  const avatar = (me) => (
    <div style={{ flex: "none", width: av, height: av, borderRadius: av / 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, background: me ? solidBg(K) : K.cardChip, color: me ? solidFg(K) : K.cardText }}>{me ? (spec.meName || "我").slice(0, 1) : [...who][0]}</div>
  );
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={h} pad={`36px ${padX}px 28px`}>
        <div style={{ height: headH - 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderBottom: `1.5px solid ${K.cardLine}` }}>
          <div style={{ fontSize: fitSize(who, innerW - 200, 34, 24), fontWeight: 800, whiteSpace: "nowrap", lineHeight: 1.2 }}>{who}</div>
          {spec.sub ? <div style={{ fontSize: 22, color: K.cardMuted, whiteSpace: "nowrap", marginTop: 2 }}>{spec.sub}</div> : null}
        </div>
        <div style={{ position: "absolute", left: 40, top: 46, fontSize: 30, color: K.cardMuted, fontWeight: 600 }}>‹</div>
        <div style={{ marginTop: 14 + 14 }}>
          {msgs.map((m, i) => {
            const me = !!m.me;
            const markAt = num(m.markAt, lastAt + 0.6);
            const markText = m.mark === true ? m.text : typeof m.mark === "string" ? m.mark : null;
            const segs = markText ? splitMarks(m.text, [{ text: markText, at: markAt }]) : [{ s: m.text }];
            const bg = me ? (K.lightCard ? INK : hexA(K.accent, 0.2)) : K.lightCard ? K.cardChip : "rgba(255,255,255,0.10)";
            const fg = me ? (K.lightCard ? "#FFFFFF" : K.cardText) : K.cardText;
            const hl = me && K.lightCard ? hexA(K.accent, 0.55) : K.hl;
            return (
              <In key={i} t={t} at={m.at} style={{ display: "flex", flexDirection: me ? "row-reverse" : "row", alignItems: "flex-start", gap: gapAv, marginTop: i ? 16 : 0 }}>
                {avatar(me)}
                <div style={{ maxWidth: bubMax, background: bg, color: fg, border: me && !K.lightCard ? `1.5px solid ${hexA(K.accent, 0.45)}` : "none", fontSize: fs, lineHeight: 1.42, fontWeight: 500, padding: `${Math.round(fs * 0.45)}px ${Math.round(fs * 0.6)}px`, borderRadius: 20, borderTopLeftRadius: me ? 20 : 6, borderTopRightRadius: me ? 6 : 20 }}>
                  {segs.map((g, j) => (g.m ? <Mark key={j} t={t} at={g.m.at} color={hl}><b style={{ fontWeight: 800 }}>{g.s}</b></Mark> : <span key={j}>{g.s}</span>))}
                </div>
              </In>
            );
          })}
        </div>
        {hasSrc ? <Source style={{ bottom: 22 }}>{spec.source}</Source> : null}
      </CardBox>
    </BStage>
  );
}

// ============================================================
// 4. steps 步骤卡（B）
// spec: kicker, title, items [{t, d, at}], endAt 最后一项打勾的时间（不给就不打勾）
// 第 i 项从 at 起点亮，到下一项 at 打勾变灰。at 可为负数：表示上次已讲完（穿插回人物后接着讲）
// ============================================================
function rowsLayout(n, avail, base, hasDesc) {
  // 返回缩放系数和是否显示描述
  const rowH = (s, d) => (42 * 1.3 + (d ? 26 * 1.5 : 0) + 24) * s + 8;
  let d = hasDesc, s = Math.min(1, avail / (n * rowH(1, d)));
  if (d && s < 0.8) { d = false; s = Math.min(1, avail / (n * rowH(1, false))); }
  return { s: Math.max(0.6, s * base), d };
}
function StepsScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const at = cardAtOf(spec), out = outOf(spec, dur);
  const items = (spec.items || []).slice(0, 5).map((it, i) => (typeof it === "string" ? { t: it } : it)).map((it, i) => ({ ...it, at: num(it.at, at + 0.9 + 0.6 * i) }));
  const h = 610, innerW = 828;
  const hasHead = !!(spec.kicker || spec.title);
  const headH = (spec.kicker ? 36 : 0) + (spec.title ? 65 : 0) + (hasHead ? 10 : 0);
  const avail = h - 46 - 40 - headH;
  const L = rowsLayout(items.length, avail, 1, items.some((x) => x.d));
  const s = L.s;
  const nameW = innerW - 40 - 70 * s - 22 - 46 - 22;
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={h} pad="46px 54px 40px">
        {spec.kicker ? <Kicker>{spec.kicker}</Kicker> : null}
        {spec.title ? <Title size={fitTitle(K, spec.title, innerW, 50, 32)} style={{ whiteSpace: "nowrap", marginTop: 4 }}><Numify text={spec.title} size={fitTitle(K, spec.title, innerW, 50, 32)} /></Title> : null}
        <div style={{ marginTop: hasHead ? 10 : 0 }}>
          {items.map((it, i) => {
            const next = i + 1 < items.length ? items[i + 1].at : num(spec.endAt, 1e9);
            const shown = ramp(t, at + 0.3 + 0.12 * i, at + 0.66 + 0.12 * i);
            const active = t >= it.at && t < next;
            const done = t >= next;
            const lit = ramp(t, it.at, it.at + 0.3);
            const op = done ? 0.55 : active ? 1 : lerp(0.42, 1, lit);
            const ns = fitSize(it.t, nameW, 42 * s, 26);
            return (
              <div key={i} style={{ position: "relative", display: "flex", alignItems: "center", gap: 22, padding: `${12 * s}px 20px`, marginTop: 8, borderRadius: 14, background: active ? K.hlSoft : "transparent", opacity: shown, transform: `translateY(${lerp(18, 0, shown)}px)` }}>
                <Num size={46 * s} color={done ? K.cardMuted : K.cardAc} style={{ width: 70 * s, flex: "none", opacity: done ? 0.8 : 1 }}>{String(i + 1).padStart(2, "0")}</Num>
                <div style={{ flex: 1, minWidth: 0, opacity: op }}>
                  <div style={{ fontSize: ns, fontWeight: 800, lineHeight: 1.3, whiteSpace: "nowrap", color: done ? K.cardMuted : K.cardText }}>{it.t}</div>
                  {L.d && it.d ? <div style={{ fontSize: 26 * s, color: K.cardMuted, lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.d}</div> : null}
                </div>
                <div style={{ width: 46, height: 46, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{done ? <Tick t={t} at={next} size={44} /> : null}</div>
              </div>
            );
          })}
        </div>
      </CardBox>
    </BStage>
  );
}

// ============================================================
// 5. checklist 自查清单（B）
// spec: kicker, title, items [{t, ok, at}]（ok=false 打叉）, strike ✕项是否红线划掉（默认 true，false 只变灰）, verdict {text, at, mark}, source
// ============================================================
function ChecklistScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const at = cardAtOf(spec), out = outOf(spec, dur);
  const items = (spec.items || []).slice(0, 6).map((it) => (typeof it === "string" ? { t: it, ok: true } : it)).map((it, i) => ({ ok: true, ...it, at: num(it.at, at + 0.9 + 0.6 * i) }));
  const verdict = spec.verdict ? (typeof spec.verdict === "string" ? { text: spec.verdict } : spec.verdict) : null;
  const vAt = verdict ? num(verdict.at, (items.length ? items[items.length - 1].at : at) + 0.7) : 0;
  const h = 610, innerW = 828;
  const hasHead = !!(spec.kicker || spec.title);
  const headH = (spec.kicker ? 36 : 0) + (spec.title ? 65 : 0) + (hasHead ? 14 : 0);
  const hasSrc = !!spec.source;
  const vH = verdict ? 76 : 0;
  const avail = h - 46 - 40 - headH - vH - (hasSrc ? 40 : 0);
  const n = items.length || 1;
  const rowH = Math.min(84, avail / n);
  const fs = clamp(Math.round(rowH * 0.56), 28, 42);
  const strike = spec.strike !== false;
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={h} pad="46px 54px 40px">
        {spec.kicker ? <Kicker>{spec.kicker}</Kicker> : null}
        {spec.title ? <Title size={fitTitle(K, spec.title, innerW, 50, 32)} style={{ whiteSpace: "nowrap", marginTop: 4 }}><Numify text={spec.title} size={fitTitle(K, spec.title, innerW, 50, 32)} /></Title> : null}
        <div style={{ marginTop: hasHead ? 14 : 0 }}>
          {items.map((it, i) => {
            const shown = ramp(t, at + 0.3 + 0.12 * i, at + 0.66 + 0.12 * i);
            const marked = t >= it.at;
            const tsz = fitSize(it.t, innerW - 46 - 24 - 10, fs, 24);
            const label = <span style={{ fontSize: tsz, fontWeight: 700, whiteSpace: "nowrap", lineHeight: 1.3 }}>{it.t}</span>;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, height: rowH, borderBottom: i < items.length - 1 ? `1.5px solid ${K.cardLine}` : "none", opacity: shown, transform: `translateY(${lerp(16, 0, shown)}px)` }}>
                <div style={{ width: 46, height: 46, flex: "none", position: "relative" }}>
                  {!marked ? <div style={{ position: "absolute", inset: 3, borderRadius: 999, border: `3px solid ${K.cardMuted}`, opacity: 0.55 }} /> : null}
                  <div style={{ position: "absolute", inset: 0, display: "flex" }}><Tick t={t} at={it.at} size={46} ok={it.ok !== false} /></div>
                </div>
                {it.ok === false ? (
                  strike ? <Strike t={t} at={it.at + 0.12}>{label}</Strike> : <span style={{ color: marked ? K.cardMuted : undefined }}>{label}</span>
                ) : (
                  label
                )}
              </div>
            );
          })}
        </div>
        {verdict ? (
          <In t={t} at={vAt} style={{ position: "absolute", left: 54, right: 54, bottom: hasSrc ? 76 : 40, height: 64, display: "flex", alignItems: "center", gap: 18 }}>
            <Chip size={26}>{verdict.label || "结论"}</Chip>
            <span style={{ fontSize: fitSize(verdict.text, innerW - 140, 38, 24), fontWeight: 800, whiteSpace: "nowrap" }}>
              <Mark t={t} at={num(verdict.markAt, vAt + 0.25)}>{verdict.text}</Mark>
            </span>
          </In>
        ) : null}
        {hasSrc ? <Source>{spec.source}</Source> : null}
      </CardBox>
    </BStage>
  );
}

// ============================================================
// 6. flow 流程图（C 全屏讲解）
// spec: kicker, title, nodes [{t, d, at}], branch {from, label, t, d, at}, ring 左下圆窗金环（默认 true）, fillIn 是否淡入底色（默认 true）
// 节点先整体以暗态列出；箭头在下一节点 at 前 0.4s 开始画，画到即点亮
// ============================================================
function FlowNode({ t, x, y, w, h, node, idx, state, lit, showNum = true }) {
  const K = useK();
  const tsz = fitTitle(K, node.t, w - (showNum ? 110 : 56) - 16, Math.min(44, h * 0.36), 24);
  const dsz = node.d ? fitSize(node.d, w - (showNum ? 110 : 56) - 16, Math.min(27, h * 0.22), 20) : 0;
  const active = state === "active";
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: lerp(0.45, 1, lit), transform: `scale(${active ? pulse(t, node.at, 0.03) : 1})` }}>
      <div style={{ position: "absolute", inset: 0, background: K.cardBg, borderRadius: Math.min(K.cardRadius, 20), border: K.cardBorder, boxShadow: K.card === "line" ? "none" : "0 12px 30px rgba(0,0,0,0.28)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: K.hlSoft, opacity: active ? 1 : 0 }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: K.accent, transform: `scaleY(${lit})`, transformOrigin: "top" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 28px 0 32px", color: K.cardText, fontFamily: SANS }}>
        {showNum ? <Num size={Math.min(52, h * 0.4)} color={lit > 0.5 ? K.cardAc : K.cardMuted} style={{ width: 60, flex: "none" }}>{String(idx + 1).padStart(2, "0")}</Num> : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: K.titleFont, fontSize: tsz, fontWeight: isElegant(K) ? 500 : 800, letterSpacing: isElegant(K) ? "0.06em" : undefined, lineHeight: 1.25, whiteSpace: "nowrap" }}>{node.t}</div>
          {node.d ? <div style={{ fontSize: dsz, color: K.cardMuted, lineHeight: 1.4, whiteSpace: "nowrap", marginTop: 2 }}>{node.d}</div> : null}
        </div>
      </div>
    </div>
  );
}
function Arrow({ x1, y1, x2, y2, p, color, dashed }) {
  if (p <= 0) return null;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const ex = x1 + (x2 - x1) * p, ey = y1 + (y2 - y1) * p;
  const hs = 14;
  const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray={dashed ? "10 10" : undefined} />
      {p > 0.15 && len > 20 ? <path d={`M${ex + Math.cos(a1) * hs},${ey + Math.sin(a1) * hs} L${ex},${ey} L${ex + Math.cos(a2) * hs},${ey + Math.sin(a2) * hs}`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}
function RingMark({ t, at = 0.3, out }) {
  const K = useK();
  const p = ramp(t, at, at + 0.6);
  const q = out == null ? 0 : ramp(t, out, out + 0.24, Easing.linear);
  if (p <= 0 || q >= 1) return null;
  const r = CIRCLE.d / 2 + 9;
  const cx = CIRCLE.x + CIRCLE.d / 2, cy = CIRCLE.y + CIRCLE.d / 2;
  const per = 2 * Math.PI * r;
  return (
    <svg style={{ position: "absolute", left: cx - r - 6, top: cy - r - 6, opacity: 1 - q }} width={2 * r + 12} height={2 * r + 12}>
      <circle cx={r + 6} cy={r + 6} r={r} fill="none" stroke={K.accent} strokeWidth={4} strokeDasharray={per} strokeDashoffset={per * (1 - p)} transform={`rotate(-90 ${r + 6} ${r + 6})`} />
    </svg>
  );
}
function FlowScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const out = outOf(spec, dur);
  const at = num(spec.at, 0.2);
  const fill = (spec.fillIn === false ? 1 : ramp(t, 0, 0.3, Easing.linear)) * (spec.fillOut === false ? 1 : 1 - ramp(t, out, out + 0.24, Easing.linear));
  const nodes = (spec.nodes || []).slice(0, 5).map((n) => (typeof n === "string" ? { t: n } : n)).map((n, i) => ({ ...n, at: num(n.at, at + 0.7 + 0.6 * i) }));
  const N = nodes.length || 1;
  const br = spec.branch ? { ...spec.branch, from: clamp(num(spec.branch.from, 1), 0, N - 1) } : null;
  if (br) br.at = num(br.at, nodes[br.from] ? nodes[br.from].at + 0.8 : at + 1);
  // 版面：标题 230 起，节点区到 1230；右侧 x≤960（避开点赞栏）
  const X0 = 72;
  const titleSize = spec.title ? fitTitle(K, spec.title, 888, 64, 40) : 0;
  const HT = 276; // 栏目标签在 y214，标题从 276 起
  const top = HT + (spec.kicker ? 44 : 0) + (spec.title ? titleSize * 1.3 : 0) + 44;
  const bottom = 1226;
  const area = bottom - top;
  const nodeH = clamp(area / (N * 1.55), 96, 150);
  const gap = N > 1 ? Math.min(150, (area - N * nodeH) / (N - 1)) : 0;
  const mainW = br ? 460 : 760;
  const bx = 680, bw = 960 - bx; // 分支节点右缘 960，避开点赞栏
  const acCol = baseAc(K);
  const contentOp = 1 - ramp(t, out, out + 0.24, Easing.linear);
  const kindIO = (d) => ramp(t, d, d + 0.36);
  const state = (i) => {
    const next = i + 1 < N ? nodes[i + 1].at : 1e9;
    if (t < nodes[i].at) return "idle";
    return t < next ? "active" : "done";
  };
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {fill > 0 ? <BaseFill opacity={fill} /> : null}
      {spec.ring !== false ? <RingMark t={t} at={at + 0.1} out={out} /> : null}
      <div style={{ position: "absolute", inset: 0, opacity: contentOp }}>
        <In t={t} at={at} style={{ position: "absolute", left: X0, top: HT, width: 888 }}>
          {spec.kicker ? <Kicker color={acCol}>{spec.kicker}</Kicker> : null}
          {spec.title ? <Title size={titleSize} color={K.baseText} style={{ whiteSpace: "nowrap", marginTop: 6 }}><Numify text={spec.title} size={titleSize} color={acCol} /></Title> : null}
        </In>
        {nodes.map((n, i) => {
          const y = top + i * (nodeH + gap);
          const shown = kindIO(at + 0.2 + 0.12 * i);
          const lit = ramp(t, n.at, n.at + 0.3);
          const ar = i > 0 ? ramp(t, n.at - 0.4, n.at, Easing.inOut(Easing.quad)) : 0;
          const ax = X0 + 62;
          return (
            <React.Fragment key={i}>
              {i > 0 ? <Arrow x1={ax} y1={y - gap + 10} x2={ax} y2={y - 10} p={ar} color={acCol} /> : null}
              {i > 0 && ar <= 0 ? <div style={{ position: "absolute", left: ax - 2, top: y - gap + 10, width: 4, height: Math.max(0, gap - 20), background: K.baseDark ? "rgba(255,255,255,0.12)" : "rgba(18,22,28,0.12)", borderRadius: 2, opacity: shown }} /> : null}
              <div style={{ opacity: shown, transform: `translateY(${lerp(18, 0, shown)}px)` }}>
                <FlowNode t={t} x={X0} y={y} w={mainW} h={nodeH} node={n} idx={i} state={state(i)} lit={lit} />
              </div>
            </React.Fragment>
          );
        })}
        {br ? (() => {
          const fy = top + br.from * (nodeH + gap);
          const shown = kindIO(at + 0.2 + 0.12 * N);
          const lit = ramp(t, br.at, br.at + 0.3);
          const ar = ramp(t, br.at - 0.45, br.at, Easing.inOut(Easing.quad));
          const ay = fy + nodeH / 2;
          const lsz = br.label ? fitSize(br.label, bx - X0 - mainW - 12, 30, 20) : 0;
          return (
            <>
              <div style={{ position: "absolute", left: X0 + mainW + 10, top: ay - 4, width: bx - X0 - mainW - 22, height: 0, borderTop: `4px dashed ${K.baseDark ? "rgba(255,255,255,0.16)" : "rgba(18,22,28,0.16)"}`, opacity: shown * (ar > 0 ? 0 : 1) }} />
              <Arrow x1={X0 + mainW + 10} y1={ay} x2={bx - 12} y2={ay} p={ar} color={acCol} />
              {br.label ? <div style={{ position: "absolute", left: X0 + mainW, width: bx - X0 - mainW, top: ay - 16 - lsz * 1.3, textAlign: "center", fontFamily: SANS, fontSize: lsz, fontWeight: 700, color: ar > 0 ? acCol : K.baseMuted, whiteSpace: "nowrap", opacity: shown }}>{br.label}</div> : null}
              <div style={{ opacity: shown, transform: `translateY(${lerp(18, 0, shown)}px)` }}>
                <FlowNode t={t} x={bx} y={fy} w={bw} h={nodeH} node={br} idx={0} state={t >= br.at ? "active" : "idle"} lit={lit} showNum={false} />
              </div>
            </>
          );
        })() : null}
      </div>
    </div>
  );
}

// ============================================================
// 7. qa 评论问答（B）
// spec: user 用户名（自动打码）, avatar 头像字, kicker 默认「网友提问」, ask 提问, answerLabel 默认「回答」, points [{t, at, mark}]
// ============================================================
function maskName(u) {
  const s = String(u || "用户");
  if (s.includes("*")) return s;
  return [...s][0] + "***";
}
function QAScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const at = cardAtOf(spec), out = outOf(spec, dur);
  const h = 610, innerW = 936 - 96;
  const points = (spec.points || []).slice(0, 3).map((p) => (typeof p === "string" ? { t: p } : p)).map((p, i) => ({ ...p, at: num(p.at, at + 1.0 + 0.7 * i) }));
  const user = maskName(spec.user);
  const avChar = spec.avatar || [...String(spec.user || "用")][0];
  const ask = String(spec.ask || "");
  // 联合缩放：提问 38、要点 40 起，按 0.02 步长缩，直到放得下
  const avail = h - 40 - 36;
  const askW = (q) => (innerW - 72 - Math.round(q * 0.6) * 2) * 0.97; // 气泡左缩进 72，左右内边距
  let qfs = 28, pfs = 30, qLines = 3;
  for (let s = 1; s >= 0.7; s -= 0.02) {
    const q = Math.round(38 * s), p = Math.round(40 * s);
    const ql = countLines(ask, q, askW(q));
    const ph = points.reduce((a, it) => a + countLines(it.t, p, innerW - 70) * p * 1.4 + 12, 0);
    const need = 56 + 14 + ql * q * 1.45 + q * 0.9 + 36 + 26 + 36 + 10 + ph;
    qfs = q; pfs = p; qLines = ql;
    if (need <= avail && ql <= 3) break;
  }
  const askShown = qLines > 3 ? clipToLines(ask, qfs, askW(qfs), 3).text + "……" : ask;
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={h} pad="40px 48px 36px">
        <div style={{ display: "flex", alignItems: "center", gap: 16, height: 56 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, flex: "none", background: K.cardChip, color: K.cardText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800 }}>{avChar}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: K.cardMuted, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{user}</div>
          <div style={{ marginLeft: "auto" }}><Chip size={24}>{spec.kicker || "网友提问"}</Chip></div>
        </div>
        <In t={t} at={at + 0.25} style={{ marginTop: 14, marginLeft: 72, position: "relative" }}>
          <div style={{ background: K.lightCard ? K.cardChip : "rgba(255,255,255,0.09)", borderRadius: 18, borderTopLeftRadius: 6, padding: `${Math.round(qfs * 0.45)}px ${Math.round(qfs * 0.6)}px`, fontSize: qfs, lineHeight: 1.45, fontWeight: 600, color: K.cardText }}>{askShown}</div>
        </In>
        <div style={{ marginTop: 36, borderTop: `1.5px solid ${K.cardLine}`, paddingTop: 26 }}>
          <In t={t} at={num(spec.answerAt, points.length ? points[0].at - 0.3 : at + 0.7)}>
            <Kicker>{spec.answerLabel || "回答"}</Kicker>
          </In>
          <div style={{ marginTop: 10 }}>
            {points.map((p, i) => {
              const segs = p.mark ? splitMarks(p.t, [{ text: p.mark === true ? p.t : p.mark, at: num(p.markAt, p.at + 0.4) }]) : [{ s: p.t }];
              return (
                <In key={i} t={t} at={p.at} style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: i ? 12 : 0 }}>
                  <Num size={pfs * 1.1} style={{ width: 52, flex: "none" }}>{String(i + 1).padStart(2, "0")}</Num>
                  <div style={{ fontSize: pfs, fontWeight: 700, lineHeight: 1.4, width: innerW - 70 }}>
                    {segs.map((g, j) => (g.m ? <Mark key={j} t={t} at={g.m.at}>{g.s}</Mark> : <span key={j}>{g.s}</span>))}
                  </div>
                </In>
              );
            })}
          </div>
        </div>
      </CardBox>
    </BStage>
  );
}

// ============================================================
// 8. end 片尾收藏卡（全屏）
// spec: kicker 默认「本期要点」, title, items [{k 小标签, t, at}]（2–4 条）, save 收藏句, column 栏目名, notice 提示条文字, saveAt, out（默认不出场）
// ============================================================
function EndScene({ spec }) {
  const { t, dur: durAll } = useT();
  const dur = num(spec.dur, durAll); // Sequence 里 useT 的 dur 是整条合成长度，优先用 spec.dur
  const K = useK();
  const at = num(spec.at, 0);
  const out = typeof spec.out === "number" ? spec.out : null;
  const fill = (spec.fillIn === false ? 1 : ramp(t, at, at + 0.3, Easing.linear)) * (out == null ? 1 : 1 - ramp(t, out, out + 0.24, Easing.linear));
  if (fill <= 0) return null;
  const items = (spec.items || []).slice(0, 4).map((it) => (typeof it === "string" ? { t: it } : it)).map((it, i) => ({ ...it, at: num(it.at, at + 0.35 + 0.12 * i) }));
  const acCol = baseAc(K);
  const txt = K.baseText, muted = K.baseMuted;
  const line = K.baseDark ? "rgba(255,255,255,0.12)" : "rgba(18,22,28,0.12)";
  const W0 = 888; // x 72–960
  const titleSize = fitTitle(K, spec.title || "", W0, 68, 40);
  const hasK = items.some((x) => x.k);
  // 条目区：从标题下到 1200
  const listTop = 270 + 40 + 10 + titleSize * 1.3 + 30;
  const listH = 1200 - listTop;
  const n = items.length || 1;
  let fs = 46, pad = 30;
  const est = (f, pd) => items.reduce((a, it) => a + pd * 2 + 1.5 + (it.k ? 38 : 0) + countLines(it.t, f, (W0 - 100) * 0.96) * f * 1.35, 0);
  while (est(fs, pad) > listH && (fs > 30 || pad > 14)) { if (fs > 30) fs -= 2; pad = Math.max(14, pad - 2); }
  const numSz = 64 * fs / 46;
  const saveAt = num(spec.saveAt, (items.length ? items[items.length - 1].at : at) + 0.45);
  const sp = ramp(t, saveAt, saveAt + 0.4);
  // 提示条：一行放得下用 32 号；放不下用 28 号最多两行
  const noticeFs = spec.notice ? (countLines("提示 " + spec.notice, 32, 716) <= 1 ? 32 : 28) : 32;
  const np = spec.notice ? ramp(t, num(spec.noticeAt, saveAt + 0.2), num(spec.noticeAt, saveAt + 0.2) + 0.3) : 0;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fill }}>
      <BaseFill />
      <In t={t} at={at + 0.15} style={{ position: "absolute", left: 72, width: W0, top: 270, color: txt, fontFamily: SANS }}>
        <Kicker size={30} color={acCol}>{spec.kicker || "本期要点"}</Kicker>
        <Title size={titleSize} weight={900} color={txt} style={{ marginTop: 10, whiteSpace: "nowrap" }}><Numify text={spec.title} size={titleSize} color={acCol} /></Title>
      </In>
      <div style={{ position: "absolute", left: 72, width: W0, top: listTop, color: txt, fontFamily: SANS }}>
        {items.map((it, i) => {
          const p = ramp(t, it.at, it.at + 0.36);
          return (
            <div key={i} style={{ display: "flex", gap: 30, alignItems: "flex-start", padding: `${pad}px 0`, borderBottom: `1.5px solid ${line}`, opacity: p, transform: `translateY(${lerp(24, 0, p)}px)` }}>
              <Num size={numSz} color={acCol} style={{ width: 70, flex: "none", display: "block", marginTop: (it.k ? 38 : 0) + (fs * 1.35 - numSz * K.numScale) / 2 }}>{String(i + 1).padStart(2, "0")}</Num>
              <div style={{ width: W0 - 100 }}>
                {it.k ? <div style={{ fontSize: 30, color: muted, fontWeight: 600, lineHeight: 1.15 }}>{it.k}</div> : null}
                <div style={{ fontSize: fs, fontWeight: 800, lineHeight: 1.35, marginTop: it.k ? 4 : 0 }}>{it.t}</div>
              </div>
            </div>
          );
        })}
      </div>
      {sp > 0 ? (
        <div style={{ position: "absolute", left: 72, width: W0, top: 1250, display: "flex", alignItems: "center", gap: 26, color: txt, fontFamily: SANS, opacity: sp }}>
          <svg width="76" height="76" viewBox="0 0 24 24" style={{ flex: "none", transform: `scale(${lerp(0.85, 1, sp)})` }}>
            <path d="M6 3h12v18l-6-4.5L6 21z" fill={hexA(K.accent, 0.18 * sp)} stroke={K.accent} strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: fitSize(spec.save || "收藏这条，用的时候找得到", W0 - 110, 42, 28), fontWeight: 800, whiteSpace: "nowrap" }}>{spec.save || "收藏这条，用的时候找得到"}</div>
            <div style={{ fontSize: 28, color: muted, marginTop: 4, whiteSpace: "nowrap" }}>{spec.column || K.T.column}</div>
          </div>
        </div>
      ) : null}
      {np > 0 ? (
        <div style={{ position: "absolute", left: 72, width: 800, top: 1410, background: K.baseDark ? "rgba(255,255,255,0.08)" : "rgba(18,22,28,0.06)", borderRadius: 18, padding: "22px 30px 22px 54px", fontFamily: SANS, fontSize: noticeFs, lineHeight: 1.45, color: K.baseDark ? "#EBE8E1" : "#2A2E35", opacity: np }}>
          <div style={{ position: "absolute", left: 24, top: 22, bottom: 22, width: 7, borderRadius: 7, background: K.warn }} />
          <b style={{ color: K.baseDark ? K.warnSoft : K.warn, marginRight: 12 }}>提示</b>{spec.notice}
        </div>
      ) : null}
    </div>
  );
}

// ============ trio：清单 / 对比表 / 聊天记录 三合一（B），说到哪个点亮哪个 ============
// spec: kicker, title, items [{label, at}]（3 个，顺序：清单、对比表、聊天记录）, source, at, out, panelIn/panelOut
function TrioScene({ spec }) {
  const K = useK();
  const { t } = useT();
  const dur = num(spec.dur, 4);
  const at = cardAtOf(spec);
  const out = outOf(spec, dur);
  const its = (spec.items || []).slice(0, 3);
  const CH = 600, top = 158, colW = 254, gap = 33, colH = 360;
  const kinds = ["list", "table", "chat"];
  const th = Array.isArray(spec.tableHead) && spec.tableHead.length === 2 ? spec.tableHead : ["方案A", "方案B"];
  const chatAsk = spec.chatAsk || "这个怎么弄？";
  const chatReply = spec.chatReply || "照这样做";
  const chatHl = spec.chatHl || "就行";
  const ats = its.map((it, i) => num(it.at, at + 0.5 + i * 0.8));
  const cur = ats.reduce((a, x, i) => (t >= x ? i : a), -1);
  const mini = (kind, a0) => {
    const r = (k) => ramp(t, a0 + 0.25 + k * 0.22, a0 + 0.45 + k * 0.22);
    if (kind === "list") return [0, 1, 2].map((k) => (
      <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22, opacity: Math.max(0.25, r(k)) }}>
        <Tick t={t} at={a0 + 0.25 + k * 0.22} size={30} />
        {r(k) <= 0 ? <div style={{ width: 30, height: 30, borderRadius: 15, border: `2px solid ${K.cardLine}` }} /> : null}
        <div style={{ height: 14, borderRadius: 7, width: [140, 110, 126][k], background: K.cardChip }} />
      </div>
    ));
    if (kind === "table") return (
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", fontSize: 20, fontWeight: 800, color: K.cardMuted, paddingLeft: 70, gap: 46 }}><span>{th[0]}</span><span>{th[1]}</span></div>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", marginTop: 14, opacity: Math.max(0.25, r(k)) }}>
            <div style={{ width: 54, height: 12, borderRadius: 6, background: K.cardChip, marginRight: 22 }} />
            <div style={{ width: 70, display: "flex", justifyContent: "center" }}><Tick t={t} at={a0 + 0.3 + k * 0.22} size={28} /></div>
            <div style={{ width: 70, display: "flex", justifyContent: "center" }}><Tick t={t} at={a0 + 0.3 + k * 0.22} size={28} ok={false} /></div>
          </div>
        ))}
      </div>
    );
    return (
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ alignSelf: "flex-start", fontSize: 21, padding: "8px 14px", borderRadius: 14, background: K.cardChip, color: K.cardText, opacity: r(0), transform: `translateY(${(1 - r(0)) * 10}px)`, whiteSpace: "nowrap" }}>{chatAsk}</div>
        <div style={{ alignSelf: "flex-end", fontSize: 21, padding: "8px 14px", borderRadius: 14, background: K.lightCard ? INK : K.accent, color: K.lightCard ? "#FFFFFF" : INK, opacity: r(1.3), transform: `translateY(${(1 - r(1.3)) * 10}px)`, whiteSpace: "nowrap" }}>{chatReply}<Mark t={t} at={a0 + 0.95}>{chatHl}</Mark></div>
      </div>
    );
  };
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={CH}>
        {spec.kicker ? <Kicker>{spec.kicker}</Kicker> : null}
        {spec.title ? <Title size={48} style={{ marginTop: 6, whiteSpace: "nowrap" }}>{spec.title}</Title> : null}
        {its.map((it, i) => {
          const p = ramp(t, ats[i], ats[i] + 0.36);
          const on = i === cur;
          return (
            <div key={i} style={{ position: "absolute", left: 54 + i * (colW + gap), top, width: colW, height: colH, borderRadius: 20, padding: "20px 18px", boxSizing: "border-box", background: K.lightCard ? "#FFFFFF" : "rgba(255,255,255,0.06)", border: `3px solid ${on ? K.accent : K.cardLine}`, boxShadow: on ? `0 10px 26px ${hexA(K.accent, 0.28)}` : "none", opacity: p > 0 ? 0.35 + 0.65 * p : 0.25, transform: `translateY(${(1 - p) * 18}px) scale(${on ? 1.03 : 1})` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 900, color: on ? K.cardAc : K.cardText, whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: K.numFont, fontSize: 30, color: K.cardAc }}>{"0" + (i + 1)}</span>{it.label}
              </div>
              {p > 0 ? mini(kinds[i], ats[i]) : null}
            </div>
          );
        })}
        {spec.source ? <Source>{spec.source}</Source> : null}
      </CardBox>
    </BStage>
  );
}

// ============ savescore：省时间精力 + 质量分滚动（B） ============
// spec: kicker, title, rows [{label, at}], scoreAt, from, to, scoreLabel, at, out, panelIn/panelOut
function RollDigits({ value, size, color, K }) {
  // value 可带小数：每一位像老虎机一样滚动
  const v = Math.max(0, value);
  const ones = v % 10;
  const col = (d, key) => {
    const base = Math.floor(d), frac = d - base;
    return (
      <span key={key} style={{ display: "inline-block", height: size, overflow: "hidden", position: "relative", width: size * 0.56 * K.numScale, verticalAlign: "top" }}>
        <span style={{ position: "absolute", left: 0, top: -frac * size, display: "flex", flexDirection: "column" }}>
          {[base % 10, (base + 1) % 10].map((n, i) => <span key={i} style={{ height: size, lineHeight: `${size}px`, fontFamily: K.numFont, fontSize: size * K.numScale, fontWeight: 700, color }}>{n}</span>)}
        </span>
      </span>
    );
  };
  const tensVal = Math.floor(v / 10) + Math.max(0, ones - 9);
  return <span style={{ display: "inline-flex" }}>{col(tensVal, "t")}{col(ones, "o")}</span>;
}
function SaveScoreScene({ spec }) {
  const K = useK();
  const { t } = useT();
  const dur = num(spec.dur, 5);
  const at = cardAtOf(spec);
  const out = outOf(spec, dur);
  const rows = (spec.rows || []).slice(0, 2);
  const scoreAt = num(spec.scoreAt, dur - 1.8);
  const from = num(spec.from, 80), to = num(spec.to, 99);
  const sw = ramp(t, scoreAt - 0.35, scoreAt); // 切到分数
  const sp = ramp(t, scoreAt, scoreAt + 1.0, Easing.out(Easing.cubic));
  const val = from + (to - from) * sp;
  const CH = 600;
  const R = 150, CIRC = 2 * Math.PI * R;
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={CH}>
        {/* 第一幕：省时间和精力 */}
        <div style={{ position: "absolute", inset: "46px 54px", opacity: 1 - sw }}>
          {spec.kicker ? <Kicker>{spec.kicker}</Kicker> : null}
          {spec.title ? <Title size={52} style={{ marginTop: 6, whiteSpace: "nowrap" }}>{spec.title}</Title> : null}
          {rows.map((r, i) => {
            const a0 = num(r.at, at + 0.6 + i * 0.5);
            const p = ramp(t, a0, a0 + 0.9, Easing.inOut(Easing.cubic));
            const w = 560 * (1 - 0.82 * p);
            return (
              <In key={i} t={t} at={at + 0.2 + i * 0.12} style={{ marginTop: i ? 40 : 54 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{ width: 120, fontSize: 36, fontWeight: 900, whiteSpace: "nowrap" }}>{r.label}</div>
                  <div style={{ position: "relative", width: 560, height: 40, borderRadius: 20, background: K.cardChip }}>
                    <div style={{ position: "absolute", left: 0, top: 0, height: 40, width: w, borderRadius: 20, background: p > 0.6 ? K.accent : hexA(K.cardMuted, 0.6) }} />
                    <div style={{ position: "absolute", right: -4, top: -6, opacity: ramp(t, a0 + 0.7, a0 + 0.9), display: "flex", alignItems: "center", gap: 8, fontSize: 30, fontWeight: 900, color: K.cardAc, whiteSpace: "nowrap" }}><Tick t={t} at={a0 + 0.75} size={38} />省下</div>
                  </div>
                </div>
              </In>
            );
          })}
        </div>
        {/* 第二幕：质量分滚动 */}
        {sw > 0 ? (
          <div style={{ position: "absolute", inset: 0, opacity: sw, display: "flex", alignItems: "center", justifyContent: "center", gap: 50 }}>
            <div style={{ position: "relative", width: 2 * R + 40, height: 2 * R + 40 }}>
              <svg width={2 * R + 40} height={2 * R + 40} style={{ position: "absolute", left: 0, top: 0 }}>
                <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={K.cardChip} strokeWidth={22} />
                <circle cx={R + 20} cy={R + 20} r={R} fill="none" stroke={K.accent} strokeWidth={22} strokeLinecap="round" strokeDasharray={`${CIRC * val / 100} ${CIRC}`} transform={`rotate(-90 ${R + 20} ${R + 20})`} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pulse(t, scoreAt + 1.0, 0.08)})` }}>
                <RollDigits value={val} size={130} color={K.cardAc} K={K} />
                <span style={{ fontSize: 40, fontWeight: 900, marginLeft: 6, marginTop: 60, color: K.cardText }}>分</span>
              </div>
            </div>
            <div style={{ width: 360 }}>
              <Kicker>{spec.scoreKicker || "视频质量"}</Kicker>
              <Title size={54} style={{ marginTop: 10, whiteSpace: "nowrap" }}>{spec.scoreLabel || "提升几个档次"}</Title>
              <div style={{ marginTop: 18, fontSize: 30, color: K.cardMuted, whiteSpace: "nowrap", fontFamily: K.numFont }}>{from} → <span style={{ color: K.cardAc, fontWeight: 800 }}>{to}</span></div>
            </div>
          </div>
        ) : null}
      </CardBox>
    </BStage>
  );
}

// ============ line：折线图（B），折线画出后重点值放大 ============
// spec: kicker, title, points [{label, value}], unit, lineAt, lineDur, hot（下标，默认最后一个）, hotAt, source, at, out, panelIn/panelOut
function LineScene({ spec }) {
  const K = useK();
  const { t } = useT();
  const dur = num(spec.dur, 4);
  const at = cardAtOf(spec);
  const out = outOf(spec, dur);
  const pts = (spec.points || []).slice(0, 8);
  const n = Math.max(2, pts.length);
  const vals = pts.map((p) => Number(p.value) || 0);
  const vmax = Math.max(...vals) * 1.15 || 1, vmin = 0;
  const lineAt = num(spec.lineAt, at + 0.5);
  const lineDur = num(spec.lineDur, 1.2);
  const hot = num(spec.hot, pts.length - 1);
  const hotAt = num(spec.hotAt, lineAt + lineDur);
  const CH = 600;
  const hasSrc = !!spec.source;
  const GX = 60, GY = 40, GW = 828 - GX - 20, GH = CH - 46 - 120 - 60 - (hasSrc ? 80 : 0) - GY;
  const xy = (i) => [GX + (GW * i) / (n - 1), GY + GH - (GH * (vals[i] - vmin)) / (vmax - vmin)];
  const P = pts.map((_, i) => xy(i));
  const segL = P.slice(1).map((q, i) => Math.hypot(q[0] - P[i][0], q[1] - P[i][1]));
  const total = segL.reduce((a, b) => a + b, 0) || 1;
  const pr = ramp(t, lineAt, lineAt + lineDur, Easing.inOut(Easing.quad));
  // 第 i 个点在折线画到它时出现
  let acc = 0;
  const reach = P.map((_, i) => { if (i > 0) acc += segL[i - 1]; return acc / total; });
  const d = P.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
  const area = d + ` L ${P[P.length - 1][0]} ${GY + GH} L ${P[0][0]} ${GY + GH} Z`;
  const hp = ramp(t, hotAt, hotAt + 0.3);
  const grid = [0.25, 0.5, 0.75, 1];
  return (
    <BStage spec={spec} t={t} dur={dur}>
      <CardBox t={t} at={at} out={out} y={ZONE.bTop} h={CH}>
        {spec.kicker ? <Kicker>{spec.kicker}</Kicker> : null}
        {spec.title ? <Title size={48} style={{ marginTop: 6, whiteSpace: "nowrap" }}>{spec.title}</Title> : null}
        <svg width={828} height={GY + GH + 60} style={{ position: "absolute", left: 54, top: 46 + 120, overflow: "visible" }}>
          <defs>
            <clipPath id="lineclip"><rect x={0} y={0} width={GX + GW * pr + 2} height={GY + GH + 60} /></clipPath>
          </defs>
          {grid.map((g, k) => <line key={k} x1={GX} x2={GX + GW} y1={GY + GH - GH * g} y2={GY + GH - GH * g} stroke={K.cardLine} strokeWidth={2} />)}
          <line x1={GX} x2={GX + GW} y1={GY + GH} y2={GY + GH} stroke={K.cardMuted} strokeWidth={2.5} />
          <g clipPath="url(#lineclip)">
            <path d={area} fill={hexA(K.accent, 0.16)} />
          </g>
          <path d={d} fill="none" stroke={K.cardAc} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${total} ${total}`} strokeDashoffset={total * (1 - pr)} />
          {P.map((q, i) => {
            const vp = ramp(t, lineAt + lineDur * reach[i] - 0.05, lineAt + lineDur * reach[i] + 0.2);
            const isHot = i === hot;
            return (
              <g key={i} opacity={vp}>
                <circle cx={q[0]} cy={q[1]} r={isHot ? lerp(9, 14, hp) : 9} fill={isHot && hp > 0.5 ? K.cardAc : (K.lightCard ? "#FFFFFF" : INK)} stroke={K.cardAc} strokeWidth={5} />
                <text x={q[0]} y={GY + GH + 42} textAnchor="middle" fontFamily={SANS} fontSize={26} fontWeight={600} fill={K.cardMuted}>{pts[i].label}</text>
              </g>
            );
          })}
        </svg>
        {hp > 0 && P[hot] ? (
          <div style={{ position: "absolute", left: P[hot][0] > 828 - 150 ? 54 + P[hot][0] - 300 : P[hot][0] < 150 ? 54 + P[hot][0] - 20 : 54 + P[hot][0] - 160, width: 320, top: 46 + 120 + P[hot][1] - 92, textAlign: P[hot][0] > 828 - 150 ? "right" : P[hot][0] < 150 ? "left" : "center", opacity: hp, transform: `translateY(${(1 - hp) * 10}px)`, whiteSpace: "nowrap" }}>
            <Num size={58}>{vals[hot]}</Num>{spec.unit ? <span style={{ fontSize: 28, fontWeight: 800, marginLeft: 4, color: K.cardMuted }}>{spec.unit}</span> : null}
          </div>
        ) : null}
        {hasSrc ? <Source>{spec.source}</Source> : null}
      </CardBox>
    </BStage>
  );
}

// ---------- 导出 ----------
// use 一行会显示在演示合集里（34 号字、不换行），控制在 26 字以内；细节见各场景上方注释
export const SCENES_C = {
  doc: { C: DocScene, layout: "B", cn: "文件高亮卡", use: "引用法条、指南、合同原文；关键句荧光笔", sfx: "0 秒轻 whoosh；每处 marks.at 划线 scribble 0.5s" },
  shot: { C: ShotScene, layout: "B", cn: "截图标注", use: "截图、化验单、App 页面：框选 + 标注", sfx: "0 秒轻 whoosh；镜头推近/滚动起点一声轻 swish（框 at 前 0.35–1.4s）；boxes.at 细划线 0.45s；note.at 轻 pop" },
  chat: { C: ChatScene, layout: "B", cn: "聊天记录", use: "复述客户、家属、网友的原话或聊天截图", sfx: "首条气泡一声极轻 tick；markAt 划线 scribble" },
  steps: { C: StepsScene, layout: "B", cn: "步骤卡", use: "「分几步」「怎么办」：逐项点亮、打勾", sfx: "0 秒轻 whoosh；每项 at 一声轻 tick" },
  checklist: { C: ChecklistScene, layout: "B", cn: "自查清单", use: "「你中了几条」：逐项 ✓ / ✕ 加结论", sfx: "✓ 轻 tick；✕ 低沉 tock + 划线；结论划线" },
  flow: { C: FlowScene, layout: "C", cn: "流程图", use: "流程、先后顺序、分支", sfx: "0 秒 whoosh；每段箭头一声细 swish" },
  qa: { C: QAScene, layout: "B", cn: "评论问答", use: "「有网友问…」：提问气泡 + 1–3 条回答", sfx: "0 秒轻 whoosh；每条要点一声轻 tick" },
  end: { C: EndScene, layout: "C", circle: false, cn: "片尾收藏卡", use: "结尾 3 句要点 + 收藏引导", sfx: "0 秒 whoosh；要点逐条 tick；书签轻 pop" },
  trio: { C: TrioScene, layout: "B", cn: "清单/对比表/聊天三合一", use: "一口气说到清单、对比表、聊天记录", sfx: "0 秒 whoosh；每格 items.at 轻 pop" },
  savescore: { C: SaveScoreScene, layout: "B", cn: "省时间+质量分", use: "省下时间精力，质量分往上涨", sfx: "0 秒 whoosh；每行省下 ✓ 轻 tick；scoreAt 切幕 swipe；分数落定 hit" },
  line: { C: LineScene, layout: "B", cn: "折线图", use: "说到趋势、走势、一路涨/跌", sfx: "0 秒 whoosh；lineAt 折线画出 swipe；hotAt 重点值 hit" },
};

export const DEMOS_C = [
  {
    "scene": "doc", "dur": 5.6,
    "source": "中华人民共和国民法典",
    "article": "第一百八十八条",
    "text": "向人民法院请求保护民事权利的诉讼时效期间为三年。法律另有规定的，依照其规定。\n诉讼时效期间自权利人知道或者应当知道权利受到损害以及义务人之日起计算。",
    "marks": [{ "text": "诉讼时效期间为三年", "at": 1.3 }, { "text": "知道或者应当知道权利受到损害以及义务人之日起计算", "at": 3.0 }],
    "note": "节选 · 第一百八十八条第一款、第二款前段",
  },
  {
    "scene": "shot", "dur": 5.2,
    // 示例没有 src，场景会画一张占位截图。用自己的截图时加 "src":"<ChatCut 里导入的图片资产 id>" 和 "ratio":宽÷高，框的位置按 0–1 比例写
    "ratio": 1.45,
    "kicker": "个人所得税 App · 收入纳税明细",
    "title": "先看有没有你不认识的单位",
    "boxes": [{ "x": 0.05, "y": 0.36, "w": 0.9, "h": 0.2, "at": 1.5 }],
    "note": { "text": "不认识的扣缴单位，可以在 App 里申诉", "at": 2.1 },
  },
  {
    "scene": "chat", "dur": 5.4,
    "who": "客户 · 王女士", "sub": "微信咨询 · 已隐去个人信息",
    "msgs": [
      { "text": "我妈前年买的重疾险，今年查出甲状腺癌", "at": 0.5 },
      { "text": "保险公司说只能按轻症赔，这合理吗？", "at": 0.62, "mark": "只能按轻症赔", "markAt": 1.6 },
      { "me": true, "text": "先别急着签字，把合同条款和病理报告发我看看", "at": 2.6, "mark": "先别急着签字", "markAt": 3.4 },
    ],
  },
  {
    "scene": "steps", "dur": 5.6,
    "kicker": "被拖欠工资",
    "title": "按这 3 步走",
    "items": [
      { "t": "保留证据", "d": "工资条、考勤记录、聊天记录", "at": 1.0 },
      { "t": "向劳动监察投诉", "d": "当地劳动保障监察部门", "at": 2.3 },
      { "t": "申请劳动仲裁", "d": "对裁决不服，还可以起诉", "at": 3.6 },
    ],
    "endAt": 4.9,
  },
  {
    "scene": "checklist", "dur": 5.8,
    "kicker": "抽血前自查",
    "title": "这 5 条你做对了几条",
    "items": [
      { "t": "空腹 8 小时以上", "ok": true, "at": 1.0 },
      { "t": "前一晚清淡饮食、不喝酒", "ok": true, "at": 1.6 },
      { "t": "早上喝杯牛奶垫一垫", "ok": false, "at": 2.3 },
      { "t": "长期用药，提前问医生要不要停", "ok": true, "at": 3.0 },
      { "t": "抽完血用力揉针眼", "ok": false, "at": 3.6 },
    ],
    "verdict": { "text": "按压 3–5 分钟，别揉", "at": 4.3 },
    "source": "示例内容，仅演示版式；具体遵医嘱",
  },
  {
    "scene": "flow", "dur": 6.0,
    "kicker": "孩子成绩下滑",
    "title": "按这个顺序排查",
    "nodes": [
      { "t": "看最近的作业", "d": "错在不会，还是错在粗心", "at": 0.9 },
      { "t": "问问任课老师", "d": "课堂状态、听课习惯", "at": 2.0 },
      { "t": "找出薄弱知识点", "d": "一次只补一块", "at": 3.1 },
      { "t": "定两周小计划", "d": "每天 20 分钟，看得到进步", "at": 4.2 },
    ],
    "branch": { "from": 1, "label": "状态不对", "t": "先聊情绪", "d": "再谈成绩", "at": 2.8 },
  },
  {
    "scene": "qa", "dur": 5.6,
    "user": "小林同学", "avatar": "林",
    "ask": "朋友借了我 5 万，没打借条，只有微信转账记录，这钱还能要回来吗？",
    "points": [
      { "t": "转账记录能证明钱确实给了他", "at": 1.6 },
      { "t": "再补一段聊天，让他承认是借款", "at": 2.6, "mark": "承认是借款" },
      { "t": "3 年内持续催要，别过了诉讼时效", "at": 3.6 },
    ],
  },
  {
    "scene": "trio", "dur": 4.4,
    "kicker": "资料整理好以后",
    "title": "一次给你做出三样",
    "items": [{ "label": "清单", "at": 1.0 }, { "label": "对比表", "at": 1.9 }, { "label": "聊天记录", "at": 2.8 }],
  },
  {
    "scene": "savescore", "dur": 5.8,
    "kicker": "换个方法以后",
    "title": "省下时间和精力",
    "rows": [{ "label": "时间", "at": 1.0 }, { "label": "精力", "at": 1.5 }],
    "scoreAt": 3.6, "from": 72, "to": 95,
    "scoreKicker": "完成质量", "scoreLabel": "上了一个台阶",
  },
  {
    "scene": "line", "dur": 4.6,
    "kicker": "示例数据",
    "title": "一周步数变化",
    "unit": "千步",
    "points": [
      { "label": "周一", "value": 6.2 }, { "label": "周二", "value": 7.1 }, { "label": "周三", "value": 5.8 }, { "label": "周四", "value": 8.4 },
      { "label": "周五", "value": 9.0 }, { "label": "周六", "value": 11.5 }, { "label": "周日", "value": 12.8 },
    ],
    "lineAt": 0.9, "lineDur": 1.4,
    "source": "虚构数据，仅演示版式",
  },
  {
    "scene": "end", "dur": 4.2,
    "title": "个税年度汇算，记住 3 点",
    "items": [
      { "t": "每年 3 月 1 日到 6 月 30 日办理", "at": 0.5 },
      { "t": "先查收入明细，有没有陌生单位", "at": 0.9 },
      { "t": "专项附加扣除，别漏填", "at": 1.3 },
    ],
    "save": "收藏这条，汇算时对照着填",
    "notice": "具体以税务机关当年公告为准",
  },
];
