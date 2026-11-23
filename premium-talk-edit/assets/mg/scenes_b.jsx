import React from "react";
import { Easing } from "remotion";
import {
  useT, useK, ramp, lerp, clamp, pulse, countUp, stagger, Panel, CardBox, Kicker, Title, Num, Mark, Strike, Tick, Chip, Source, In,
  textW, charW, fitSize, hexA, SANS, WARN, ZONE, SAFE, BaseFill, CIRCLE,
} from "./lib.jsx";

// 高级感干货风 · B 批次「数据类」场景（layout B：场景自己画 Panel，卡片在 y 270–880，人物由剪辑下移）
// 共用约定：spec 里所有时间都是段内秒；"at" 卡片进场（默认 0.15）；"out" 出场（默认 dur−0.3）；
// "panelIn"/"panelOut" 控制底色展开/收起；"source" 来源小字；"hl" + "hlAt" 给某段文字扫荧光笔。

// ---------- 私有小工具 ----------
const IW = 828; // 卡片内容宽（936 − 左右内边距 54×2）
const CARD_MAX = ZONE.bBottom - ZONE.bTop - 10; // 卡片最高 600

const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

// 场景公共时间
function useB(s) {
  const T = useT();
  const dur = num(s.dur, T.dur);
  return {
    t: T.t,
    dur,
    at: num(s.at, s.panelIn === false ? 0 : 0.15), // 底色沿用上一段时卡片立即出现（与 scenes_c 一致）
    out: num(s.out, dur - 0.3),
    pa: s.panelIn === false ? -10 : 0,
    pb: s.panelOut === false ? null : dur,
  };
}
// 卡片在 270–880 区域里垂直居中
const cardY = (h) => Math.round(ZONE.bTop + Math.max(0, (CARD_MAX - h) / 2));

// 数字字体每个数字大约多宽（相对字号）。用于把大数字塞进一行。
const NUM_W = { barlow: 0.5, oswald: 0.58, bebas: 0.44, serif: 0.62 };
function numW(str, size, K) {
  const f = NUM_W[K.T.num] || 0.58;
  return [...String(str)].reduce((a, ch) => a + (/[0-9]/.test(ch) ? f : /[.,:]/.test(ch) ? 0.26 : charW(ch)), 0) * size * K.numScale;
}
// 千分位（默认 ≥ 10000 才加）
function fmt(v, dec = 0, sep = null) {
  const n = Number(v) || 0;
  let s = Math.abs(n).toFixed(dec);
  const use = sep == null ? Math.abs(n) >= 10000 : sep;
  if (use) {
    const [i, d] = s.split(".");
    s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? "." + d : "");
  }
  return (n < 0 ? "−" : "") + s;
}
// 计数（countUp）+ 格式化。千分位按目标值决定，计数过程中不跳格式。
function cnt(t, at, to, o = {}) {
  const v = parseFloat(countUp(t, at, Number(to) || 0, { from: o.from || 0, dur: o.dur || 0.6, decimals: 6 }));
  const sep = o.sep == null ? Math.abs(Number(to) || 0) >= 10000 : o.sep;
  return fmt(v, o.decimals || 0, sep);
}
// 多行文字的字号：按「总宽 ≤ 行宽 × 行数」估算
function fitLines(text, w, max, min, lines) {
  return Math.floor(clamp((w * lines * 0.88) / Math.max(1, textW(text, 1)), min, max));
}
const clampLines = (n) => ({ display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical", overflow: "hidden" });
const oneLine = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// 强调色填充：浅色卡片上如果强调色本身太浅（如 silver），改用深色版，保证条、环、色块看得清
function lum(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
function useAc() {
  const K = useK();
  const weak = K.lightCard && lum(K.accent) > 0.78;
  const fill = weak ? K.accentDeep : K.accent;
  return { K, fill, hl: weak ? hexA(K.accentDeep, 0.32) : K.hl, soft: weak ? hexA(K.accentDeep, 0.16) : K.hlSoft };
}

// 文字里的数字换成数字字体（颜色跟随）
function Digits({ text, size, color = "inherit" }) {
  const s = String(text == null ? "" : text);
  if (!size) return s;
  const parts = s.split(/(\d+(?:[.,]\d+)*%?)/);
  return parts.map((p, i) => (i % 2 ? <Num key={i} size={size} color={color} style={{ lineHeight: "inherit" }}>{p}</Num> : p));
}
// 一段文字：hl（字符串或数组）里的片段在 hlAt 扫荧光笔，数字用数字字体
function Rich({ text, t, hl, hlAt, numSize, numColor }) {
  const A = useAc();
  const s = String(text == null ? "" : text);
  const keys = (Array.isArray(hl) ? hl : hl ? [hl] : []).filter((k) => k && s.includes(k));
  if (!keys.length) return <Digits text={s} size={numSize} color={numColor} />;
  const re = new RegExp("(" + keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")");
  return s.split(re).map((p, i) =>
    i % 2 ? (
      <Mark key={i} t={t} at={hlAt} color={A.hl}><Digits text={p} size={numSize} /></Mark>
    ) : (
      <React.Fragment key={i}><Digits text={p} size={numSize} color={numColor} /></React.Fragment>
    ),
  );
}

// 标题字体：elegant（细宋体，旧名 xiaowei 等同）字重 500、字距 0.06em，估宽时要多留 7%
const isEl = (K) => K.T.title === "elegant" || K.T.title === "xiaowei";
const tw7 = (K, w) => (isEl(K) ? w / 1.07 : w);
const titleFace = (K) => ({ fontFamily: K.titleFont, fontWeight: isEl(K) ? 500 : 800, letterSpacing: isEl(K) ? "0.06em" : undefined });

// 卡片顶部：小字引子 + 一行标题（自动缩字号，不换行）
const headH = (s, K, titleMax = 52) => (s.kicker ? 42 : 0) + (s.title ? Math.round(fitSize(s.title, tw7(K, IW), titleMax, 30) * 1.3) + 4 : 0);
function Head({ s, t, titleMax = 52, w = IW }) {
  const K = useK();
  const ts = s.title ? fitSize(s.title, tw7(K, w), titleMax, 30) : 0;
  return (
    <div style={{ width: w }}>
      {s.kicker ? <Kicker size={fitSize(s.kicker, w, 28, 22)} style={{ lineHeight: 1.45, ...oneLine }}>{s.kicker}</Kicker> : null}
      {s.title ? (
        <Title size={ts} style={{ marginTop: 4, ...oneLine }}>
          <Rich text={s.title} t={t} hl={s.titleHl} hlAt={num(s.titleHlAt, 1)} numSize={ts * 1.2} numColor={K.cardAc} />
        </Title>
      ) : null}
    </div>
  );
}
const srcH = (s) => (s.source ? 96 : 44); // 来源小字占底部 34+36，再留 26 空隙

// ============ 1. number 大数字卡 ============
function NumberScene({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const countAt = num(s.countAt, at + 0.5);
  const dec = s.decimals || 0;
  const final = fmt(s.value, dec, s.sep);
  const labels = Array.isArray(s.labels) ? s.labels.slice(0, 6) : [];
  const n = labels.length || Math.min(6, s.segs || 0);
  const hasBar = n > 0;
  const unit = s.unit || "";
  const unitSize = unit ? fitSize(unit, 240, 80, 40) : 0;
  const pre = s.prefix || "";
  const chipSize = 44;
  const chipW = s.chip ? textW(s.chip, chipSize) + chipSize * 1.2 + 28 : 0;
  const hh = headH(s, K);
  const barH = hasBar ? 24 + 18 + 12 + 38 : 0;
  // 宽、高两头限制大数字字号
  const room = IW - (unit ? textW(unit, unitSize) + 16 : 0) - (pre ? textW(pre, 72) + 8 : 0) - chipW;
  const byW = room / Math.max(1, numW(final, 1, K));
  const byH = (CARD_MAX - 46 - hh - 10 - barH - srcH(s)) / (0.96 * K.numScale);
  const big = Math.floor(clamp(Math.min(byW, byH, 220), 80, 220));
  const h = Math.round(46 + hh + 10 + big * K.numScale * 0.96 + barH + srcH(s));
  const segs = Array.from({ length: n }, (_, i) => num(s.segAt && s.segAt[i], countAt + 0.3 + 0.35 * i));
  const labSize = Math.min(26, ...labels.map((l) => fitSize(l, IW / n - 10, 26, 18)));
  const chipP = ramp(t, num(s.chipAt, countAt + 0.9), num(s.chipAt, countAt + 0.9) + 0.36);
  const numColor = s.warn ? K.warn : s.accentNum ? K.cardAc : K.cardText;
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 10, whiteSpace: "nowrap" }}>
          {pre ? <span style={{ fontSize: 72, fontWeight: 900 }}>{pre}</span> : null}
          <Num size={big} color={numColor} style={{ lineHeight: 0.96 }}>{cnt(t, countAt, s.value, { decimals: dec, sep: s.sep })}</Num>
          {unit ? <span style={{ fontSize: unitSize, fontWeight: 900 }}>{unit}</span> : null}
          {s.chip ? (
            <span style={{ marginLeft: 14, alignSelf: "center", opacity: chipP, transform: `translateY(${lerp(18, 0, chipP)}px)` }}>
              <Chip size={chipSize}>{s.chip}</Chip>
            </span>
          ) : null}
        </div>
        {hasBar ? (
          <>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              {segs.map((a, i) => {
                const p = ramp(t, a, a + 0.5);
                const warn = s.warnLast && i === n - 1;
                return (
                  <div key={i} style={{ flex: 1, height: 18, borderRadius: 9, background: K.cardChip, overflow: "hidden", position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, background: warn ? K.warn : AC, transform: `scaleX(${p})`, transformOrigin: "left" }} />
                  </div>
                );
              })}
            </div>
            {labels.length ? (
              <div style={{ display: "flex", marginTop: 12, fontSize: labSize, lineHeight: 1.4, color: K.cardMuted }}>
                {labels.map((l, i) => {
                  const last = i === n - 1;
                  const lit = t >= segs[i];
                  return (
                    <div key={i} style={{ flex: 1, textAlign: n === 1 ? "left" : i === 0 ? "left" : last ? "right" : "center", whiteSpace: "nowrap", fontWeight: last && s.warnLast ? 800 : 500, color: last && s.warnLast && lit ? K.warn : lit ? K.cardText : K.cardMuted }}>
                      <Digits text={l} size={labSize * 1.15} />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ============ 2. numCompare 两数对比 ============
function NumCompare({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const A = s.a || {}, B = s.b || {};
  const aAt = num(s.aAt, at + 0.3);
  const bAt = num(s.bAt, aAt + 1.0);
  const mid = 104;
  const colW = (IW - mid) / 2;
  const fa = fmt(A.value, A.decimals || 0, A.sep), fb = fmt(B.value, B.decimals || 0, B.sep);
  const uS = 48;
  const uw = (x) => (x.unit ? textW(x.unit, uS) + 10 : 0) + (x.prefix ? textW(x.prefix, uS) + 6 : 0);
  const sz = Math.floor(clamp(Math.min((colW - uw(A)) / numW(fa, 1, K), (colW - uw(B)) / numW(fb, 1, K), 170), 56, 170));
  const labS = Math.min(30, fitSize(A.label || "", colW - 40, 30, 20), fitSize(B.label || "", colW - 40, 30, 20));
  const labH = labS * 1.36 + 14;
  const numH = sz * K.numScale;
  const d = s.delta;
  const dObj = d && typeof d === "object" ? d : null;
  const dAt = num(dObj && dObj.at, num(s.deltaAt, bAt + 0.9));
  const dText = dObj ? `${dObj.pre || ""}${fmt(dObj.value, dObj.decimals || 0)}${dObj.unit || ""}${dObj.post || ""}` : d || "";
  const dS = d ? fitSize(dText, IW, 44, 28) : 0;
  const hh = headH(s, K);
  const h = Math.round(46 + hh + 34 + labH + numH + (d ? 36 + dS * 1.5 : 0) + srcH(s));
  const arrowP = ramp(t, bAt - 0.35, bAt + 0.05, Easing.out(Easing.cubic));
  const colorB = B.warn ? K.warn : K.cardAc;
  const colorA = A.warn ? K.warn : K.cardMuted;
  const Col = ({ x, when, color, active }) => (
    <In t={t} at={when} style={{ width: colW }}>
      <div style={{ height: labH }}>
        <Chip size={labS} active={active}>{x.label || ""}</Chip>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap", height: numH }}>
        {x.prefix ? <span style={{ fontSize: uS, fontWeight: 900, color }}>{x.prefix}</span> : null}
        <Num size={sz} color={color} style={{ lineHeight: 1 }}>{cnt(t, when + 0.1, x.value, { decimals: x.decimals || 0, sep: x.sep })}</Num>
        {x.unit ? <span style={{ fontSize: uS, fontWeight: 900, color: active ? K.cardText : K.cardMuted }}>{x.unit}</span> : null}
      </div>
    </In>
  );
  const ay = labH + numH * 0.55;
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} />
        <div style={{ display: "flex", marginTop: 34, position: "relative" }}>
          <Col x={A} when={aAt} color={colorA} active={false} />
          <div style={{ width: mid, position: "relative" }}>
            {s.mode === "vs" ? (
              <div style={{ position: "absolute", left: 0, width: mid, top: ay - 30, textAlign: "center", opacity: ramp(t, bAt - 0.3, bAt), fontFamily: K.numFont, fontWeight: 700, fontSize: 52 * K.numScale, lineHeight: "60px", color: K.cardMuted }}>VS</div>
            ) : (
              <svg width={mid} height={40} style={{ position: "absolute", left: 0, top: ay - 20 }} viewBox={`0 0 ${mid} 40`}>
                {arrowP > 0.02 ? <line x1={14} y1={20} x2={14 + (mid - 34) * arrowP} y2={20} stroke={K.cardAc} strokeWidth={5} strokeLinecap="round" /> : null}
                <path d={`M${mid - 34} 8 L${mid - 16} 20 L${mid - 34} 32`} fill="none" stroke={K.cardAc} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={ramp(t, bAt - 0.05, bAt + 0.1)} />
              </svg>
            )}
          </div>
          <Col x={B} when={bAt} color={colorB} active={true} />
        </div>
        {d ? (
          <In t={t} at={dAt - 0.15} style={{ marginTop: 36, fontSize: dS, fontWeight: 800, lineHeight: 1.4, ...oneLine }}>
            <Mark t={t} at={dAt} color={HL}>
              {dObj ? (
                <>
                  {dObj.pre || ""}
                  <Num size={dS * 1.3} color={dObj.warn ? K.warn : K.cardText} style={{ margin: "0 6px", lineHeight: "inherit" }}>{cnt(t, dAt, dObj.value, { decimals: dObj.decimals || 0 })}</Num>
                  {dObj.unit || ""}
                  {dObj.post || ""}
                </>
              ) : (
                <Digits text={dText} size={dS * 1.3} />
              )}
            </Mark>
          </In>
        ) : null}
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ============ 3. percent 百分比环 ============
function Percent({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const ringAt = num(s.ringAt, at + 0.45);
  const cd = num(s.countDur, 0.6);
  const dec = s.decimals || 0;
  const v = clamp(Number(s.value) || 0, 0, 100);
  const D = 300, SW = 26, r = (D - SW) / 2, C = 2 * Math.PI * r;
  const p = ramp(t, ringAt, ringAt + cd, Easing.out(Easing.cubic)) * v / 100;
  const final = fmt(v, dec);
  const cS = Math.floor(clamp((D - 90) / (numW(final, 1, K) + 0.45 * 0.6), 60, 118));
  const lines = (s.lines || []).slice(0, 2);
  const tw = IW - D - 50;
  const l0one = lines[0] ? fitSize(lines[0], tw7(K, tw) * 0.97, 46, 20) : 0;
  const l0 = l0one >= 36 ? l0one : lines[0] ? fitLines(lines[0], tw7(K, tw), 44, 30, 2) : 0;
  const l1 = lines[1] ? fitLines(lines[1], tw, 34, 24, 3) : 0;
  const lineAt = [num(s.lineAt && s.lineAt[0], at + 0.3), num(s.lineAt && s.lineAt[1], ringAt + cd + 0.3)];
  const hh = headH(s, K);
  const h = Math.round(46 + hh + 30 + D + srcH(s));
  const color = s.warn ? K.warn : AC;
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} />
        <div style={{ display: "flex", alignItems: "center", gap: 50, marginTop: 30 }}>
          <div style={{ position: "relative", width: D, height: D, flex: "none" }}>
            <svg width={D} height={D} viewBox={`0 0 ${D} ${D}`} style={{ position: "absolute", inset: 0 }}>
              <circle cx={D / 2} cy={D / 2} r={r} fill="none" stroke={K.cardChip} strokeWidth={SW} />
              {p > 0.002 ? (
                <circle cx={D / 2} cy={D / 2} r={r} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeDasharray={`${C * p} ${C}`} transform={`rotate(-90 ${D / 2} ${D / 2})`} />
              ) : null}
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "baseline", whiteSpace: "nowrap" }}>
                <Num size={cS} color={s.warn ? K.warn : K.cardText}>{cnt(t, ringAt, v, { decimals: dec, dur: cd })}</Num>
                <Num size={cS * 0.45} color={s.warn ? K.warn : K.cardText} style={{ marginLeft: 4 }}>%</Num>
              </div>
            </div>
          </div>
          <div style={{ width: tw }}>
            {lines[0] ? (
              <In t={t} at={lineAt[0]} style={{ ...titleFace(K), fontSize: l0, lineHeight: 1.36, ...clampLines(2) }}>
                <Rich text={lines[0]} t={t} hl={s.hl} hlAt={num(s.hlAt, ringAt + cd + 0.2)} numSize={l0 * 1.2} numColor={K.cardAc} />
              </In>
            ) : null}
            {lines[1] ? (
              <In t={t} at={lineAt[1]} style={{ marginTop: 16, fontSize: l1, lineHeight: 1.5, color: K.cardMuted, ...clampLines(3) }}>
                <Digits text={lines[1]} size={l1 * 1.15} />
              </In>
            ) : null}
          </div>
        </div>
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ============ 4. bars 横向条形图 ============
const dz = (it, s) => (it.decimals != null ? it.decimals : s.decimals || 0);
const uz = (it, s) => (it.unit != null ? it.unit : s.unit || "");
function Bars({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const items = (s.items || []).slice(0, 6);
  const n = Math.max(1, items.length);
  const vals = items.map((it) => Number(it.value) || 0);
  const vmax = num(s.max, Math.max(1e-9, ...vals));
  let hot = items.findIndex((it) => it.hot);
  if (hot < 0) hot = num(s.hot, vals.indexOf(Math.max(...vals)));
  const barsAt = num(s.barsAt, at + 0.6);
  const gap = num(s.gap, 0.35);
  const ats = items.map((it, i) => num(it.at, barsAt + gap * i));
  const hotAt = num(s.hotAt, ats[hot] != null ? ats[hot] : barsAt);
  const hh = headH(s, K);
  const avail = CARD_MAX - 46 - hh - 22 - srcH(s);
  const rowH = Math.floor(clamp(avail / n, 62, 104));
  const h = Math.round(46 + hh + 22 + rowH * n + srcH(s));
  const labS = Math.min(36, Math.floor(rowH * 0.42), ...items.map((it) => fitSize(it.label || "", 250, 36, 20)));
  const labW = clamp(Math.max(...items.map((it) => textW(it.label || "", labS))) + 18, 110, 270);
  const valS = Math.min(52, Math.floor(rowH * 0.6));
  const uS = Math.round(valS * 0.5);
  const valW = Math.max(...items.map((it, i) => numW(fmt(vals[i], dz(it, s)), valS, K) + textW(uz(it, s), uS) + 8)) + 16;
  const trackW = IW - labW - valW;
  const barT = Math.round(clamp(rowH * 0.36, 20, 36));
  const grey = hexA(K.cardMuted, K.lightCard ? 0.42 : 0.5);
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} />
        <div style={{ marginTop: 22 }}>
          {items.map((it, i) => {
            const p = ramp(t, ats[i], ats[i] + 0.6, Easing.out(Easing.cubic));
            const isHot = i === hot;
            const hp = isHot ? ramp(t, hotAt, hotAt + 0.3) : 0;
            const len = Math.max(barT, trackW * clamp(vals[i] / vmax, 0, 1)) * p;
            const dec = dz(it, s);
            const unit = uz(it, s);
            return (
              <In key={i} t={t} at={stagger(at + 0.2, i)} style={{ height: rowH, display: "flex", alignItems: "center", position: "relative" }}>
                <div style={{ width: labW, fontSize: labS, fontWeight: isHot && hp > 0.5 ? 900 : 600, color: K.cardText, opacity: isHot && hp > 0.5 ? 1 : 0.78, whiteSpace: "nowrap", overflow: "hidden" }}>
                  <Digits text={it.label} size={labS * 1.15} />
                </div>
                <div style={{ position: "relative", width: trackW + valW, height: rowH }}>
                  <div style={{ position: "absolute", left: 0, top: (rowH - barT) / 2, width: trackW, height: barT, borderRadius: barT / 2, background: K.cardLine }} />
                  {p > 0 ? (
                    <div style={{ position: "absolute", left: 0, top: (rowH - barT) / 2, width: len, height: barT, borderRadius: barT / 2, background: grey, overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, background: AC, opacity: hp }} />
                    </div>
                  ) : null}
                  {p > 0 ? (
                    <div style={{ position: "absolute", left: len + 14, top: 0, height: rowH, display: "flex", alignItems: "center", whiteSpace: "nowrap", opacity: Math.min(1, p * 3) }}>
                      <Num size={valS} color={isHot && hp > 0.5 ? K.cardAc : K.cardText} style={{ transform: `scale(${isHot ? pulse(t, hotAt, 0.06) : 1})`, display: "inline-block", transformOrigin: "left center" }}>{cnt(t, ats[i], vals[i], { decimals: dec })}</Num>
                      {unit ? <span style={{ fontSize: uS, fontWeight: 800, marginLeft: 4, color: K.cardMuted }}>{unit}</span> : null}
                    </div>
                  ) : null}
                </div>
              </In>
            );
          })}
        </div>
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ============ 5/6 共用：内容多时的排法与 C 全屏版式 ============
// timeline / table 支持 "layout"："B"（默认，上卡下人）| "C"（全屏讲解，人物缩进左下圆窗）| "auto"（按下面的规则自己选）。
// 版式会影响剪辑（C 要把人物缩进圆窗），所以渲染从不悄悄换版式：没写 layout 就一直是 B，
// B 放不下时在 B 里翻页（table）或改竖排（timeline），字号仍 ≥ 28。写 "auto" 时用的规则与 Python 版一致（见 SCENES_B 登记的 rule）。
// C 版式：整屏底色 BaseFill（0–0.3s 淡入，out 起 0.24s 淡出；fillIn/fillOut:false 不淡，默认跟 panelIn/panelOut），
// 卡片在 x 72–960（右缘避开点赞栏）、y 276–1240 内垂直居中，左下圆窗外加一圈强调色细环（ring:false 不画）。
const CW = 888, CIW = 792, C_TOP = 276, C_MAX = 1240 - 276; // C 卡片宽 888、内边距 48 → 内容宽 792；最高 964
const layoutArg = (s) => String(s.layout || "B").toUpperCase();
const pickLayout = (s, autoC) => (layoutArg(s) === "C" ? "C" : layoutArg(s) === "AUTO" && autoC ? "C" : "B");
const headH2 = (s, K, titleMax, w) => (s.kicker ? 42 : 0) + (s.title ? Math.round(fitSize(s.title, tw7(K, w), titleMax, 30) * 1.3) + 4 : 0);
const headMax = (s, titleMax) => (s.kicker ? 42 : 0) + (s.title ? Math.round(titleMax * 1.3) + 4 : 0); // 按标题最大字号估高，判断规则与风格包无关
const srcB2 = (s) => (s.source ? 84 : 40);
// 卡片位置：B 在 270–880 居中；C 在 276–1240 居中
const frameOf = (L, h) =>
  L === "C"
    ? { x: SAFE.left, w: CW, pad: "46px 48px", padX: 48, y: Math.round(C_TOP + Math.max(0, (C_MAX - h) / 2)) }
    : { x: SAFE.left, w: 936, pad: "46px 54px", padX: 54, y: cardY(h) };
function CRing({ t, at, out }) {
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
// 底：B 画 Panel；C 画整屏底色 + 圆窗细环
function Stage({ L, s, t, at, out, pa, pb }) {
  if (L !== "C") return <Panel t={t} a={pa} b={pb} />;
  const fin = s.fillIn != null ? s.fillIn : s.panelIn;
  const fout = s.fillOut != null ? s.fillOut : s.panelOut;
  const fill = (fin === false ? 1 : ramp(t, 0, 0.3, Easing.linear)) * (fout === false ? 1 : 1 - ramp(t, out, out + 0.24, Easing.linear));
  return (
    <>
      {fill > 0 ? <BaseFill opacity={fill} /> : null}
      {s.ring !== false ? <CRing t={t} at={at + 0.1} out={fout === false ? null : out} /> : null}
    </>
  );
}

// ============ 5. timeline 时间轴 / 期限 ============
// 排法 dir："h" 横排（原样）| "v" 竖排。默认：B 版式且 ≤4 个节点、每个 label 在格宽里 ≥30px、每条 sub 两行内 28px 放得下 → 横排；否则竖排。C 版式一律竖排。
// 自动 C 规则（layout:"auto"）：节点 ≥ 6，或任一 sub 字数 > (节点 ≥ 5 ? 14 : 30) → C。
// 节点上限：B 6 个，C 8 个。时间：节点在 at+0.2+0.12i 灰色出现；第 i 个在 nodes[i].at（默认 firstAt+gap×i，firstAt 默认 at+0.5，gap 默认 0.7）点亮，连线在点亮前 0.4s 开始长。
const TL_MAX = { B: 6, C: 8 };
const tlAutoC = (s) => {
  const ns = (s.nodes || []).filter(Boolean);
  const n = ns.length;
  return n >= 6 || ns.some((nd) => [...String(nd.sub || "")].length > (n >= 5 ? 14 : 30));
};
function tlDir(s, L) {
  if (L === "C") return "v";
  if (s.dir === "h" || s.dir === "v") return s.dir;
  const nodes = (s.nodes || []).slice(0, 5);
  if (nodes.length > 4) return "v";
  const cellW = IW / Math.max(1, nodes.length);
  const ok = nodes.every((nd) => fitSize(nd.label || "", cellW - 14, 40, 20) >= 30 && (!nd.sub || textW(nd.sub, 28) <= (cellW - 18) * 2 * 0.88));
  return ok ? "h" : "v";
}
function Timeline({ spec: s }) {
  const L = pickLayout(s, tlAutoC(s));
  return tlDir(s, L) === "h" ? <TimelineH spec={s} /> : <TimelineV spec={s} L={L} />;
}
// 竖排字号与行高（纯计算）。hh = 卡片顶部引子 + 标题的实际高度
function tlFit(nodes, s, L, hh) {
  const isC = L === "C";
  const n = Math.max(1, nodes.length);
  const W = isC ? CIW : IW;
  const avail = (isC ? C_MAX : CARD_MAX) - 46 - hh - 24 - srcB2(s);
  const rowH = Math.floor(Math.min(isC ? 150 : 110, avail / n));
  const labWMax = Math.round(W * 0.3);
  let labS = 28;
  for (let z = isC ? 40 : 36; z >= 28; z--) if (z * 1.3 <= rowH - 8 && nodes.every((nd) => textW(nd.label || "", z) <= labWMax)) { labS = z; break; }
  const labW = Math.min(labWMax, Math.max(80, Math.ceil(Math.max(0, ...nodes.map((nd) => textW(nd.label || "", labS))))));
  const LX = 62;
  const subX = LX + labW + 30;
  const subW = W - subX;
  const linesAt = (z) => (rowH >= Math.round(2 * z * 1.3 + 8) ? 2 : 1);
  let subS = 28, subL = linesAt(28);
  for (let z = isC ? 34 : 32; z >= 28; z--) {
    const ln = linesAt(z);
    if (z * 1.3 <= rowH - 8 && nodes.every((nd) => !nd.sub || textW(nd.sub, z) <= subW * ln * 0.92)) { subS = z; subL = ln; break; }
  }
  const h = Math.round(46 + hh + 24 + n * rowH + srcB2(s));
  return { rowH, labS, labW, LX, subX, subW, subS, subL, h };
}
// 竖排：左边竖线 + 圆点，右边「label | sub」一行一个节点
function TimelineV({ spec: s, L }) {
  const { K, fill: AC } = useAc();
  const WN = K.warn || K.warn;
  const { t, at, out, pa, pb } = useB(s);
  const isC = L === "C";
  const nodes = (s.nodes || []).filter(Boolean).slice(0, TL_MAX[L]);
  const n = Math.max(1, nodes.length);
  const first = num(s.firstAt, at + 0.5);
  const gapT = num(s.gap, 0.7);
  const ats = nodes.map((nd, i) => num(nd.at, first + gapT * i));
  const W = isC ? CIW : IW;
  const hh = headH2(s, K, 52, W);
  const { rowH, labS, labW, LX, subX, subW, subS, subL, h } = tlFit(nodes, s, L, hh);
  const fr = frameOf(L, h);
  const cur = ats.reduce((c, a, i) => (t >= a ? i : c), -1);
  const RX = 22; // 竖线中心
  const cy = (i) => i * rowH + rowH / 2;
  return (
    <>
      <Stage L={L} s={s} t={t} at={at} out={out} pa={pa} pb={pb} />
      <CardBox t={t} at={at} out={out} x={fr.x} y={fr.y} w={fr.w} h={h} pad={fr.pad}>
        <Head s={s} t={t} titleMax={52} w={W} />
        <div style={{ position: "relative", width: W, height: n * rowH, marginTop: 24 }}>
          {n > 1 ? <div style={{ position: "absolute", left: RX - 3, width: 6, top: cy(0), height: cy(n - 1) - cy(0), borderRadius: 3, background: K.cardChip, opacity: ramp(t, at + 0.2, at + 0.56) }} /> : null}
          {nodes.slice(1).map((nd, j) => {
            const i = j + 1;
            const p = ramp(t, Math.max(ats[i - 1], ats[i] - 0.4), ats[i], Easing.inOut(Easing.quad));
            return <div key={j} style={{ position: "absolute", left: RX - 3, width: 6, top: cy(i - 1), height: rowH * p, borderRadius: 3, background: nd.warn ? WN : AC }} />;
          })}
          {nodes.map((nd, i) => {
            const p = ramp(t, ats[i], ats[i] + 0.3);
            const c = nd.warn ? WN : AC;
            const lit = p > 0.5;
            return (
              <In key={i} t={t} at={stagger(at + 0.2, i)} style={{ position: "absolute", left: 0, top: i * rowH, width: W, height: rowH }}>
                {i === cur ? <div style={{ position: "absolute", left: RX - 28, top: rowH / 2 - 28, width: 56, height: 56, borderRadius: 28, background: hexA(c, 0.22), transform: `scale(${lerp(0.4, 1, p)})` }} /> : null}
                <div style={{ position: "absolute", left: RX - 14, top: rowH / 2 - 14, width: 28, height: 28, borderRadius: 14, boxSizing: "border-box", background: p > 0 ? c : K.cardBg, border: `4px solid ${p > 0 ? c : K.cardMuted}` }} />
                <div style={{ position: "absolute", left: LX, width: labW, top: 0, height: rowH, display: "flex", alignItems: "center", fontSize: labS, fontWeight: 800, lineHeight: 1.3, color: lit ? (nd.warn ? WN : K.cardText) : K.cardMuted, opacity: lerp(0.5, 1, p), ...oneLine }}>
                  <span style={oneLine}><Digits text={nd.label} size={labS * 1.15} /></span>
                </div>
                {nd.sub ? (
                  <div style={{ position: "absolute", left: subX, width: subW, top: 0, height: rowH, display: "flex", alignItems: "center" }}>
                    <div style={{ fontSize: subS, lineHeight: 1.3, color: lit ? K.cardText : K.cardMuted, opacity: lerp(0.65, 1, p), overflowWrap: "anywhere", ...(subL > 1 ? clampLines(subL) : oneLine) }}>
                      <Digits text={nd.sub} size={subS * 1.15} />
                    </div>
                  </div>
                ) : null}
              </In>
            );
          })}
        </div>
        {s.source ? <Source style={{ left: fr.padX, right: fr.padX }}>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// 横排（原样）
function TimelineH({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const WN = K.warn || K.warn;
  const nodes = (s.nodes || []).slice(0, 5);
  const n = Math.max(1, nodes.length);
  const first = num(s.firstAt, at + 0.5);
  const gapT = num(s.gap, 0.7);
  const ats = nodes.map((nd, i) => num(nd.at, first + gapT * i));
  const cellW = IW / n;
  const xs = nodes.map((_, i) => cellW * (i + 0.5));
  const labS = Math.min(40, ...nodes.map((nd) => fitSize(nd.label || "", cellW - 14, 40, 20)));
  const subS = Math.min(28, ...nodes.map((nd) => (nd.sub ? fitLines(nd.sub, cellW - 18, 28, 19, 2) : 28)));
  const labH = Math.round(labS * 1.5);
  const lineY = labH + 34;
  const subTop = lineY + 40;
  const boxH = subTop + (nodes.some((nd) => nd.sub) ? Math.round(subS * 1.45 * 2) + 4 : 0);
  const hh = headH(s, K);
  const h = Math.round(46 + hh + 40 + boxH + srcH(s));
  const cur = ats.reduce((c, a, i) => (t >= a ? i : c), -1);
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} />
        <div style={{ position: "relative", width: IW, height: boxH, marginTop: 40 }}>
          {/* 底线 */}
          <div style={{ position: "absolute", left: xs[0], width: xs[n - 1] - xs[0], top: lineY - 3, height: 6, borderRadius: 3, background: K.cardChip }} />
          {/* 逐段画出 */}
          {nodes.slice(1).map((nd, j) => {
            const i = j + 1;
            const a1 = Math.max(ats[i - 1], ats[i] - 0.4);
            const p = ramp(t, a1, ats[i], Easing.inOut(Easing.quad));
            return <div key={j} style={{ position: "absolute", left: xs[i - 1], width: (xs[i] - xs[i - 1]) * p, top: lineY - 3, height: 6, borderRadius: 3, background: nd.warn ? WN : AC }} />;
          })}
          {nodes.map((nd, i) => {
            const p = ramp(t, ats[i], ats[i] + 0.3);
            const c = nd.warn ? WN : AC;
            const isCur = i === cur;
            const shown = ramp(t, stagger(at + 0.2, i), stagger(at + 0.2, i) + 0.36);
            return (
              <React.Fragment key={i}>
                <div style={{ position: "absolute", left: i * cellW, width: cellW, top: 0, height: labH, display: "flex", alignItems: "flex-end", justifyContent: "center", fontSize: labS, fontWeight: 800, whiteSpace: "nowrap", opacity: shown * lerp(0.45, 1, p), color: p > 0.5 ? (nd.warn ? WN : K.cardText) : K.cardMuted }}>
                  <Digits text={nd.label} size={labS * 1.2} />
                </div>
                {isCur ? <div style={{ position: "absolute", left: xs[i] - 30, top: lineY - 30, width: 60, height: 60, borderRadius: 30, background: hexA(c, 0.22), transform: `scale(${lerp(0.4, 1, p)})` }} /> : null}
                <div style={{ position: "absolute", left: xs[i] - 15, top: lineY - 15, width: 30, height: 30, borderRadius: 15, boxSizing: "border-box", background: p > 0 ? c : K.cardBg === "none" ? "transparent" : K.cardBg, border: `4px solid ${p > 0 ? c : K.cardMuted}`, opacity: shown }} />
                {nd.sub ? (
                  <div style={{ position: "absolute", left: i * cellW + 9, width: cellW - 18, top: subTop, textAlign: "center", fontSize: subS, lineHeight: 1.45, color: p > 0.5 ? K.cardText : K.cardMuted, opacity: shown * lerp(0.6, 1, p), ...clampLines(2) }}>
                    <Digits text={nd.sub} size={subS * 1.15} />
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ============ 6. table 对比表 ============
// 原样（classic）：B 版式、≤4 行、所有单元格和表头在 28px 都能一行放下、没写 perPage → 和原来完全一样。
// 否则「密排」：首列按内容收窄，单元格放不下自动折行（最多 3 行）；字号 B 34→28、C 36→28 取能放下的最大值，不低于 28。
// 一页几行 cap：写了 perPage 用它（B 最多 4、C 最多 8）；否则看最挤的单元格在 B 30px / C 32px 下要折几行 ml：B = ml≥3 ? 2 : ml=2 ? 3 : 4；C = ml≥3 ? 4 : ml=2 ? 6 : 8。
// 页数 P = ceil(行数 / cap)，各页行数尽量平均（前面的页多 1 行）。行数上限 12。
// 自动 C 规则（layout:"auto"）：按 B 算要翻页（P > 1）→ C。
// 时间：表头 headAt（默认 at+0.25）；第 i 行 rowAt[i]，不写时：
//   单页：headAt + 0.4 + rowGap×i（rowGap 默认 0.45）；
//   多页：headAt + 0.4 + pageGap×页号 + rowGap×(页内序号)，pageGap 默认 max(1.6, (out − 1.0 − (headAt + 0.4)) / P)。
// 翻页：第 p 页（p≥1）在 rowAt[该页第一行] − 0.3 开始，上一页 0.24s 淡出，新行在各自 rowAt 进场（0.36s）；✓/✕ 在 rowAt+0.2 出现。
const isMk = (c) => c === "✓" || c === "✕" || c === "√" || c === "×";
const cellTxt = (c) => (c == null ? "" : String(c));
function tablePlan(s, L) {
  const cols = (s.cols || []).slice(0, 4);
  const C = Math.max(2, cols.length);
  const rows = (s.rows || []).filter(Array.isArray).slice(0, 12);
  const n = Math.max(1, rows.length);
  const W = L === "C" ? CIW : IW;
  const ratioW = C >= 3 ? Math.round(W * (C === 4 ? 0.3 : 0.34)) : Math.round(W * 0.42);
  const wsOf = (fw) => cols.map((_, i) => (i === 0 ? fw : (W - fw) / (C - 1)));
  // 原样判断：首列按比例宽，所有单元格 28px 一行放得下（textW ≤ 列宽 − 28），表头 28px 放得下（≤ 列宽 − 24）
  const ws0 = wsOf(ratioW);
  const fit1 = (c, j) => j >= ws0.length || isMk(cellTxt(c)) || textW(cellTxt(c), 28) <= ws0[j] - 28;
  const hdrOk = cols.every((c, j) => textW(cellTxt(c), 28) <= ws0[j] - 24);
  const pp = Math.floor(num(s.perPage, 0));
  if (L === "B" && pp <= 0 && rows.length <= 4 && rows.every((r) => r.every(fit1)) && hdrOk) return { classic: true, pages: [[0, rows.length]] };
  // 密排：首列按内容收窄（按最大字号 B 34 / C 36 估宽 + 32，夹在 20% 和原比例之间），多出的宽度给数据列
  const zMax = L === "C" ? 36 : 34;
  const firstW = Math.round(clamp(Math.ceil(Math.max(textW(cellTxt(cols[0]), zMax), ...rows.map((r) => textW(cellTxt(r[0]), zMax)))) + 32, Math.round(W * 0.2), ratioW));
  const ws = wsOf(firstW);
  const cellLines = (c, j, z) => (j >= ws.length || isMk(cellTxt(c)) || !cellTxt(c) ? 1 : Math.ceil(textW(cellTxt(c), z) / ((ws[j] - 28) * 0.88)));
  const rowLines = (r, z) => Math.max(1, ...r.map((c, j) => cellLines(c, j, z)));
  const ml = Math.max(1, ...rows.map((r) => rowLines(r, L === "C" ? 32 : 30)));
  const cap = pp > 0 ? clamp(pp, 1, L === "C" ? 8 : 4) : L === "C" ? (ml >= 3 ? 4 : ml === 2 ? 6 : 8) : ml >= 3 ? 2 : ml === 2 ? 3 : 4;
  const P = Math.ceil(n / cap);
  const pages = [];
  for (let p = 0, st = 0; p < P; p++) {
    const k = Math.floor(n / P) + (p < n % P ? 1 : 0);
    pages.push([st, st + k]);
    st += k;
  }
  return { classic: false, cols, C, rows, n, W, ws, pages, rowLines };
}
// 各时间点（段内秒）。flipAt[0] 记 null（第 1 页不用翻）。
function tableTimes(s, plan, at, out) {
  const pages = plan.pages;
  const P = pages.length;
  const headAt = num(s.headAt, at + 0.25);
  const rowGap = num(s.rowGap, 0.45);
  const t0 = headAt + 0.4;
  const pageGap = num(s.pageGap, Math.max(1.6, (out - 1.0 - t0) / P));
  const pageOf = [];
  pages.forEach(([a, b], p) => { for (let i = a; i < b; i++) pageOf[i] = p; });
  const rowAt = pageOf.map((p, i) => num(s.rowAt && s.rowAt[i], t0 + (P > 1 ? pageGap * p : 0) + rowGap * (i - pages[p][0])));
  const flipAt = pages.map(([a], p) => (p === 0 ? null : rowAt[a] - 0.3));
  return { headAt, rowAt, flipAt, pageOf, pageGap: P > 1 ? pageGap : null };
}
function Table({ spec: s }) {
  const L = pickLayout(s, tablePlan(s, "B").pages.length > 1);
  const plan = tablePlan(s, L);
  return plan.classic ? <TableClassic spec={s} /> : <TableDense spec={s} L={L} plan={plan} />;
}
// 密排字号与行高（纯计算，和风格包无关）
function tableFit(s, plan, L) {
  const isC = L === "C";
  const { rows, ws, pages } = plan;
  const titleMax = isC ? 52 : 46;
  const headRow = isC ? 62 : 56;
  const avail = (isC ? C_MAX : CARD_MAX) - 46 - headMax(s, titleMax) - 14 - headRow - srcB2(s);
  // 字号：从 B 34 / C 36 往下找能让每页都放下的最大值（单元格最多折 3 行）；到 28 还放不下就减少行数上限（多出的字省略号），字号不低于 28
  const lnOf = (r, z, mL) => Math.min(mL, plan.rowLines(r, z));
  const rh = (ln, z) => (ln <= 1 ? Math.round(z * 1.3 + 24) : Math.round(z * 1.3 * ln + 20));
  const pageH = (z, mL) => Math.max(0, ...pages.map(([a, b]) => rows.slice(a, b).reduce((h, r) => h + rh(lnOf(r, z, mL), z), 0)));
  // 依次放宽：①放得下、没有单元格超过 3 行、首列（行名）一行 ②放得下、不超 3 行 ③放得下（超出 3 行的省略号）；都不行就 28px 并减少行数上限
  const firstOne = (z) => rows.every((r) => textW(cellTxt(r[0]), z) <= ws[0] - 28);
  const noCut = (z) => rows.every((r) => plan.rowLines(r, z) <= 3);
  const tests = [(z) => noCut(z) && firstOne(z), noCut, () => true];
  let bs = 0, mL = 3;
  for (const ok of tests) for (let z = isC ? 36 : 34; z >= 28 && !bs; z--) if (pageH(z, 3) <= avail && ok(z)) bs = z;
  if (!bs) { bs = 28; while (mL > 1 && pageH(28, mL) > avail) mL--; }
  const lns = rows.map((r) => lnOf(r, bs, mL));
  const hts = lns.map((ln) => rh(ln, bs));
  const bodyH = pageH(bs, mL);
  return { titleMax, headRow, bs, mL, lns, hts, bodyH, avail };
}
function TableDense({ spec: s, L, plan }) {
  const { K, fill: AC, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const { cols, rows, W, ws, pages } = plan;
  const isC = L === "C";
  const P = pages.length;
  const { titleMax, headRow, bs, lns, hts, bodyH } = tableFit(s, plan, L);
  const dotsW = P > 1 ? P * 22 + 18 : 0;
  const hw = W - (P > 1 ? dotsW + 20 : 0);
  const hh = headH2(s, K, titleMax, hw);
  const h = Math.round(46 + hh + 14 + headRow + bodyH + srcB2(s));
  const fr = frameOf(L, h);
  const headS = Math.min(isC ? 32 : 30, ...cols.map((c, j) => fitSize(String(c == null ? "" : c), ws[j] - 24, isC ? 32 : 30, 24)));
  const { headAt, rowAt, flipAt: fl, pageOf } = tableTimes(s, plan, at, out);
  const flipAt = fl.map((f, p) => (p === 0 ? -1e9 : f));
  let curP = 0;
  flipAt.forEach((f, p) => { if (t >= f) curP = p; });
  const focus = (s.focus || []).filter((f) => f && typeof f.row === "number");
  let fRow = -1, fAt = -1;
  focus.forEach((f) => { const a = num(f.at, 99); if (t >= a && a >= fAt) { fRow = f.row; fAt = a; } });
  if (t >= num(s.focusOff, 999)) fRow = -1;
  if (fRow >= 0 && pageOf[fRow] !== curP) fRow = -1; // 高亮的行不在当前页就不高亮
  const fP = fRow >= 0 ? ramp(t, fAt, fAt + 0.3) : 0;
  const ac = num(s.accentCol, -1);
  const hp = ramp(t, headAt, headAt + 0.36);
  return (
    <>
      <Stage L={L} s={s} t={t} at={at} out={out} pa={pa} pb={pb} />
      <CardBox t={t} at={at} out={out} x={fr.x} y={fr.y} w={fr.w} h={h} pad={fr.pad}>
        <Head s={s} t={t} titleMax={titleMax} w={hw} />
        {P > 1 ? (
          <div style={{ position: "absolute", right: fr.padX, top: 58, display: "flex", gap: 10, alignItems: "center", opacity: hp }}>
            {pages.map((_, p) => {
              const on = (p === 0 ? 1 : ramp(t, flipAt[p], flipAt[p] + 0.3)) * (p + 1 < P ? 1 - ramp(t, flipAt[p + 1], flipAt[p + 1] + 0.3) : 1);
              return <div key={p} style={{ width: lerp(12, 30, on), height: 12, borderRadius: 6, background: on > 0.5 ? AC : K.cardChip }} />;
            })}
          </div>
        ) : null}
        <div style={{ marginTop: 14, position: "relative", width: W }}>
          <div style={{ display: "flex", height: headRow, alignItems: "center", borderBottom: `2px solid ${K.cardLine}`, opacity: hp }}>
            {cols.map((c, j) => (
              <div key={j} style={{ width: ws[j], padding: "0 14px", boxSizing: "border-box", textAlign: j === 0 ? "left" : "center", whiteSpace: "nowrap", overflow: "hidden" }}>
                <span style={{ fontSize: headS, fontWeight: 800, color: j === ac ? K.cardAc : K.cardMuted, letterSpacing: "0.04em", borderBottom: j === ac ? `4px solid ${AC}` : "none", paddingBottom: 4 }}>
                  <Digits text={c} size={headS * 1.15} />
                </span>
              </div>
            ))}
          </div>
          <div style={{ position: "relative", height: bodyH }}>
            {rows.map((r, i) => {
              const p = pageOf[i];
              const [a, b] = pages[p];
              const top = hts.slice(a, i).reduce((x, y) => x + y, 0);
              const isF = i === fRow;
              const dim = fRow >= 0 && !isF;
              return (
                <In key={i} t={t} at={rowAt[i]} out={p + 1 < P ? flipAt[p + 1] : null} style={{ position: "absolute", left: 0, top, width: W, height: hts[i] }}>
                  <div style={{ position: "relative", width: W, height: hts[i], display: "flex", alignItems: "center", borderBottom: i < b - 1 ? `1.5px solid ${K.cardLine}` : "none", opacity: dim ? 0.5 : 1 }}>
                  {isF ? <div style={{ position: "absolute", left: -12, right: -12, top: 4, bottom: 4, borderRadius: 12, background: SOFT, opacity: fP }} /> : null}
                  {isF ? <div style={{ position: "absolute", left: -12, top: 10, bottom: 10, width: 6, borderRadius: 3, background: AC, opacity: fP }} /> : null}
                  {cols.map((_, j) => {
                    const c = r[j] == null ? "" : String(r[j]);
                    return (
                      <div key={j} style={{ position: "relative", width: ws[j], height: "100%", padding: "0 14px", boxSizing: "border-box", display: "flex", justifyContent: j === 0 ? "flex-start" : "center", alignItems: "center", fontSize: bs, fontWeight: j === 0 ? 800 : 600, color: K.cardText }}>
                        {isMk(c) ? (
                          <Tick t={t} at={rowAt[i] + 0.2} size={Math.min(46, Math.round(bs * 1.4))} ok={c === "✓" || c === "√"} />
                        ) : (
                          <div style={{ lineHeight: 1.3, textAlign: j === 0 ? "left" : "center", overflowWrap: "anywhere", ...(lns[i] > 1 ? clampLines(lns[i]) : oneLine) }}>
                            <Digits text={c} size={bs * 1.15} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </In>
              );
            })}
          </div>
        </div>
        {s.source ? <Source style={{ left: fr.padX, right: fr.padX }}>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// 原样（classic）
function TableClassic({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const cols = (s.cols || []).slice(0, 4);
  const C = Math.max(2, cols.length);
  const rows = (s.rows || []).slice(0, 5);
  const n = Math.max(1, rows.length);
  const headAt = num(s.headAt, at + 0.25);
  const rowGap = num(s.rowGap, 0.45);
  const rowAt = rows.map((_, i) => num(s.rowAt && s.rowAt[i], headAt + 0.4 + rowGap * i));
  const focus = (s.focus || []).filter((f) => f && typeof f.row === "number");
  // 当前高亮行：已到时间的 focus 里最晚的一个；focusOff 之后全部取消高亮
  let fRow = -1, fAt = -1;
  focus.forEach((f) => { const a = num(f.at, 99); if (t >= a && a >= fAt) { fRow = f.row; fAt = a; } });
  if (t >= num(s.focusOff, 999)) fRow = -1;
  const fP = fRow >= 0 ? ramp(t, fAt, fAt + 0.3) : 0;
  const firstW = C >= 3 ? Math.round(IW * (C === 4 ? 0.3 : 0.34)) : Math.round(IW * 0.42);
  const ws = cols.map((_, i) => (i === 0 ? firstW : (IW - firstW) / (C - 1)));
  const hh = headH(s, K, 46);
  const headRow = 62;
  const avail = CARD_MAX - 46 - hh - 18 - headRow - srcH(s);
  const rowH = Math.floor(clamp(avail / n, 56, 96));
  const h = Math.round(46 + hh + 18 + headRow + rowH * n + srcH(s));
  const isMark = (c) => c === "✓" || c === "✕" || c === "√" || c === "×";
  const bodyS = Math.min(36, Math.floor(rowH * 0.5), ...rows.flatMap((r) => r.map((c, j) => (isMark(c) ? 99 : fitSize(String(c), ws[j] - 28, 36, 20)))));
  const headS = Math.min(30, ...cols.map((c, j) => fitSize(String(c || ""), ws[j] - 24, 30, 20)));
  const ac = num(s.accentCol, -1);
  const hp = ramp(t, headAt, headAt + 0.36);
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} titleMax={46} />
        <div style={{ marginTop: 18, position: "relative" }}>
          <div style={{ display: "flex", height: headRow, alignItems: "center", borderBottom: `2px solid ${K.cardLine}`, opacity: hp }}>
            {cols.map((c, j) => (
              <div key={j} style={{ width: ws[j], padding: "0 14px", boxSizing: "border-box", textAlign: j === 0 ? "left" : "center", whiteSpace: "nowrap", overflow: "hidden" }}>
                <span style={{ fontSize: headS, fontWeight: 800, color: j === ac ? K.cardAc : K.cardMuted, letterSpacing: "0.04em", borderBottom: j === ac ? `4px solid ${AC}` : "none", paddingBottom: 4 }}>
                  <Digits text={c} size={headS * 1.15} />
                </span>
              </div>
            ))}
          </div>
          {rows.map((r, i) => {
            const isF = i === fRow;
            const dim = fRow >= 0 && !isF;
            return (
              <In key={i} t={t} at={rowAt[i]} style={{ position: "relative", display: "flex", height: rowH, alignItems: "center", borderBottom: i < n - 1 ? `1.5px solid ${K.cardLine}` : "none", opacity: dim ? 0.5 : 1 }}>
                {isF ? <div style={{ position: "absolute", left: -12, right: -12, top: 4, bottom: 4, borderRadius: 12, background: SOFT, opacity: fP }} /> : null}
                {isF ? <div style={{ position: "absolute", left: -12, top: 10, bottom: 10, width: 6, borderRadius: 3, background: AC, opacity: fP }} /> : null}
                {cols.map((_, j) => {
                  const c = r[j] == null ? "" : String(r[j]);
                  return (
                    <div key={j} style={{ position: "relative", width: ws[j], padding: "0 14px", boxSizing: "border-box", display: "flex", justifyContent: j === 0 ? "flex-start" : "center", alignItems: "center", whiteSpace: "nowrap", overflow: "hidden", fontSize: bodyS, fontWeight: j === 0 ? 800 : 600, color: K.cardText }}>
                      {isMark(c) ? <Tick t={t} at={rowAt[i] + 0.2} size={Math.min(46, rowH * 0.6)} ok={c === "✓" || c === "√"} /> : <Digits text={c} size={bodyS * 1.15} />}
                    </div>
                  );
                })}
              </In>
            );
          })}
        </div>
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ============ 7. compare 以为 / 其实 ============
function Compare({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const wl = s.wrongLabel || "以为", rl = s.rightLabel || "其实";
  const chipS = 30;
  const chipW = Math.max(textW(wl, chipS), textW(rl, chipS)) + chipS * 1.2;
  const tw = IW - chipW - 28;
  const wrongAt = num(s.wrongAt, at + 0.2);
  const strikeAt = num(s.strikeAt, wrongAt + 0.8);
  const rightAt = num(s.rightAt, strikeAt + 0.45);
  const hlAt = num(s.hlAt, rightAt + 0.4);
  const ws = fitSize(s.wrong || "", tw - 12, 50, 28);
  // 一行放得下（字号 ≥ 40）就压成一行，避免第二行只剩一两个字
  const rs1 = fitSize(s.right || "", tw7(K, tw) * 0.97, 52, 24);
  const rLines = rs1 >= 40 ? 1 : 2;
  const rs = rLines === 1 ? rs1 : fitLines(s.right || "", tw7(K, tw), 46, 30, 2);
  const hh = headH(s, K);
  const h = Math.round(46 + hh + 40 + ws * 1.4 + 44 + rs * 1.42 * rLines + srcH(s));
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} />
        <In t={t} at={wrongAt} style={{ display: "flex", alignItems: "flex-start", gap: 28, marginTop: 40 }}>
          <span style={{ width: chipW, flex: "none", marginTop: (ws * 1.4 - chipS * 1.36) / 2 + 2 }}><Chip size={chipS} active={false}>{wl}</Chip></span>
          <span style={{ fontSize: ws, fontWeight: 800, lineHeight: 1.4, whiteSpace: "nowrap", color: K.cardMuted }}>
            <Strike t={t} at={strikeAt} dur={0.4}><Digits text={s.wrong} size={ws * 1.15} /></Strike>
          </span>
        </In>
        <In t={t} at={rightAt} style={{ display: "flex", alignItems: "flex-start", gap: 28, marginTop: 44 }}>
          <span style={{ width: chipW, flex: "none", marginTop: (rs * 1.42 - chipS * 1.36) / 2 + 2 }}><Chip size={chipS}>{rl}</Chip></span>
          <span style={{ width: tw, ...titleFace(K), fontSize: rs, lineHeight: 1.42, ...clampLines(2) }}>
            <Mark t={t} at={hlAt} dur={0.5} color={HL}><Digits text={s.right} size={rs * 1.15} /></Mark>
          </span>
        </In>
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ============ 8. formula 公式 / 拆解卡 ============
// mode "row"：横排等式（≤3 项，适合相乘）；"list"：竖排拆解单（适合加减、项多）。默认按项数自动选。
function Formula({ spec: s }) {
  const { K, fill: AC, hl: HL, soft: SOFT } = useAc();
  const { t, at, out, pa, pb } = useB(s);
  const items = (s.items || []).slice(0, 5);
  const n = Math.max(1, items.length);
  const R = s.result || {};
  const mode = s.mode || (n <= 3 ? "row" : "list");
  const itemsAt = num(s.itemsAt, at + 0.4);
  const gap = num(s.gap, 0.5);
  const ats = items.map((it, i) => num(it.at, itemsAt + gap * i));
  const resultAt = num(s.resultAt, ats[n - 1] + 0.7);
  const rDec = R.decimals || 0;
  const rFinal = fmt(R.value, rDec, R.sep);
  const hh = headH(s, K);
  const opC = K.cardMuted;
  const itemStr = (it) => (it.value != null ? fmt(it.value, it.decimals || 0, it.sep) : it.text || "");
  if (mode === "row") {
    const opW = 54;
    const boxW = (IW - opW * (n - 1)) / n;
    const vS = Math.floor(Math.min(78, ...items.map((it) => {
      const u = it.unit ? textW(it.unit, 30) + 6 : 0;
      return it.value != null ? (boxW - 16 - u) / numW(itemStr(it), 1, K) : fitSize(itemStr(it), boxW - 16, 60, 26) * 1.2;
    })));
    const lS = Math.min(28, ...items.map((it) => fitSize(it.label || "", boxW - 10, 28, 18)));
    const boxH = Math.round(vS * 1.1 + 10 + lS * 1.4);
    const rlS = fitSize(R.label || "", 300, 40, 26);
    const ruS = R.unit ? 40 : 0;
    const rS = Math.floor(clamp((IW - 60 - 40 - textW(R.label || "", rlS) - 30 - (R.unit ? textW(R.unit, ruS) + 8 : 0)) / numW(rFinal, 1, K), 60, 120));
    const resH = Math.round(rS * K.numScale + 36);
    const h = Math.round(46 + hh + 34 + boxH + 30 + resH + srcH(s));
    const rp = ramp(t, resultAt, resultAt + 0.36);
    return (
      <>
        <Panel t={t} a={pa} b={pb} />
        <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
          <Head s={s} t={t} />
          <div style={{ display: "flex", alignItems: "flex-start", marginTop: 34, height: boxH }}>
            {items.map((it, i) => (
              <React.Fragment key={i}>
                {i > 0 ? (
                  <In t={t} at={ats[i] - 0.1} style={{ width: opW, textAlign: "center", fontSize: 50, fontWeight: 300, lineHeight: `${vS * 1.1}px`, color: opC }}>{it.op || "+"}</In>
                ) : null}
                <In t={t} at={ats[i]} style={{ width: boxW, textAlign: "center" }}>
                  <div style={{ height: vS * 1.1, display: "flex", alignItems: "baseline", justifyContent: "center", whiteSpace: "nowrap" }}>
                    {it.value != null ? (
                      <>
                        <Num size={vS} color={K.cardText} style={{ lineHeight: 1.1 }}>{cnt(t, ats[i], it.value, { decimals: it.decimals || 0, dur: 0.45, sep: it.sep })}</Num>
                        {it.unit ? <span style={{ fontSize: 30, fontWeight: 800, marginLeft: 4 }}>{it.unit}</span> : null}
                      </>
                    ) : (
                      <span style={{ ...titleFace(K), fontSize: vS / 1.2, lineHeight: `${vS * 1.1}px` }}>{it.text}</span>
                    )}
                  </div>
                  <div style={{ marginTop: 10, fontSize: lS, color: K.cardMuted, whiteSpace: "nowrap", lineHeight: 1.4 }}>{it.label}</div>
                </In>
              </React.Fragment>
            ))}
          </div>
          {rp > 0 ? (
            <div style={{ position: "relative", marginTop: 30, height: resH, display: "flex", alignItems: "center", gap: 20, padding: "0 30px", borderRadius: 16, overflow: "hidden", opacity: rp, transform: `translateY(${lerp(18, 0, rp)}px)`, whiteSpace: "nowrap" }}>
              <div style={{ position: "absolute", inset: 0, background: SOFT, transformOrigin: "left", transform: `scaleX(${ramp(t, resultAt, resultAt + 0.5, Easing.out(Easing.quad))})` }} />
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: AC }} />
              <span style={{ position: "relative", fontSize: 50, fontWeight: 300, color: opC }}>=</span>
              <span style={{ position: "relative", fontSize: rlS, fontWeight: 900 }}>{R.label}</span>
              <span style={{ position: "relative", marginLeft: "auto", display: "flex", alignItems: "baseline" }}>
                {R.prefix ? <span style={{ fontSize: 40, fontWeight: 900, color: K.cardAc }}>{R.prefix}</span> : null}
                <Num size={rS} color={R.warn ? K.warn : K.cardAc}>{cnt(t, resultAt + 0.1, R.value, { decimals: rDec, sep: R.sep })}</Num>
                {R.unit ? <span style={{ fontSize: ruS, fontWeight: 900, marginLeft: 8 }}>{R.unit}</span> : null}
              </span>
            </div>
          ) : null}
          {s.source ? <Source>{s.source}</Source> : null}
        </CardBox>
      </>
    );
  }
  // list 拆解单
  const resH = 108;
  const avail = CARD_MAX - 46 - hh - 20 - 22 - resH - srcH(s);
  const rowH = Math.floor(clamp(avail / n, 54, 80));
  const h = Math.round(46 + hh + 20 + rowH * n + 22 + resH + srcH(s));
  const lS = Math.min(36, Math.floor(rowH * 0.55), ...items.map((it) => fitSize(it.label || "", IW - 360, 36, 22)));
  const vS = Math.min(56, Math.floor(rowH * 0.78));
  const divP = ramp(t, resultAt - 0.3, resultAt + 0.1, Easing.out(Easing.cubic));
  const rlS = fitSize(R.label || "", 360, 42, 26);
  const rS = Math.floor(clamp((IW - 80 - textW(R.label || "", rlS) - 40 - (R.unit ? textW(R.unit, 36) + 8 : 0)) / numW(rFinal, 1, K), 56, 96));
  const rp = ramp(t, resultAt, resultAt + 0.36);
  return (
    <>
      <Panel t={t} a={pa} b={pb} />
      <CardBox t={t} at={at} out={out} y={cardY(h)} h={h}>
        <Head s={s} t={t} />
        <div style={{ marginTop: 20 }}>
          {items.map((it, i) => (
            <In key={i} t={t} at={ats[i]} style={{ height: rowH, display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
              <span style={{ width: 56, fontSize: 44, fontWeight: 300, color: opC }}>{i === 0 ? "" : it.op || "+"}</span>
              <span style={{ fontSize: lS, fontWeight: 700, overflow: "hidden", maxWidth: IW - 360 }}>{it.label}</span>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "baseline" }}>
                {it.value != null ? (
                  <Num size={vS} color={it.op === "−" || it.op === "-" ? K.cardMuted : K.cardText}>{cnt(t, ats[i], it.value, { decimals: it.decimals || 0, dur: 0.45, sep: it.sep != null ? it.sep : s.sep })}</Num>
                ) : (
                  <span style={{ fontSize: lS, fontWeight: 800 }}>{it.text}</span>
                )}
                {it.unit ? <span style={{ fontSize: 26, fontWeight: 700, marginLeft: 6, color: K.cardMuted }}>{it.unit}</span> : null}
              </span>
            </In>
          ))}
        </div>
        <div style={{ height: 3, marginTop: 10, marginBottom: 9, background: K.cardText, opacity: 0.8, transform: `scaleX(${divP})`, transformOrigin: "left" }} />
        {rp > 0 ? (
          <div style={{ position: "relative", height: resH, display: "flex", alignItems: "center", gap: 20, padding: "0 26px", borderRadius: 16, overflow: "hidden", opacity: rp, whiteSpace: "nowrap" }}>
            <div style={{ position: "absolute", inset: 0, background: SOFT, transformOrigin: "left", transform: `scaleX(${ramp(t, resultAt, resultAt + 0.5, Easing.out(Easing.quad))})` }} />
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: AC }} />
            <span style={{ position: "relative", fontSize: rlS, fontWeight: 900 }}>{R.label}</span>
            <span style={{ position: "relative", marginLeft: "auto", display: "flex", alignItems: "baseline" }}>
              {R.prefix ? <span style={{ fontSize: 36, fontWeight: 900, color: K.cardAc }}>{R.prefix}</span> : null}
              <Num size={rS} color={R.warn ? K.warn : K.cardAc}>{cnt(t, resultAt + 0.1, R.value, { decimals: rDec, sep: R.sep })}</Num>
              {R.unit ? <span style={{ fontSize: 36, fontWeight: 900, marginLeft: 8 }}>{R.unit}</span> : null}
            </span>
          </div>
        ) : null}
        {s.source ? <Source>{s.source}</Source> : null}
      </CardBox>
    </>
  );
}

// ---------- 导出 ----------
export const SCENES_B = {
  number: { C: NumberScene, layout: "B", cn: "大数字卡", use: "说到年限、金额、比例、人数",
    fields: "kicker title value decimals prefix unit countAt chip chipAt labels[] segAt[] warnLast warn source",
    sfx: "at 卡片 whoosh；countAt 细小滴答 0.6s；每段进度条填满一声轻 tick" },
  numCompare: { C: NumCompare, layout: "B", cn: "两数对比", use: "「以前 X，现在 Y」两个数对比",
    fields: "kicker title a{label,value,unit,prefix,decimals,warn} b{…} aAt bAt mode(arrow|vs) delta{pre,value,unit,post,at}|\"文字\" source",
    sfx: "aAt/bAt 各一串滴答；箭头 whoosh 轻；delta 荧光笔划线声" },
  percent: { C: Percent, layout: "B", cn: "百分比环", use: "说到比例、占比、发生率",
    fields: "kicker title value decimals ringAt countDur lines[2] lineAt[] hl hlAt warn source",
    sfx: "ringAt 滴答 0.6s；hlAt 划线声" },
  bars: { C: Bars, layout: "B", cn: "横向条形图", use: "几项排名、占比放在一起比",
    fields: "kicker title items[{label,value,unit,hot,at}] unit decimals max barsAt gap hot hotAt source",
    sfx: "每条长出一声极轻 tick；hotAt 可不加" },
  timeline: { C: Timeline, layout: "B", layouts: "B|C", layoutOf: (s) => pickLayout(s, tlAutoC(s)),
    times: (s) => { const L = pickLayout(s, tlAutoC(s)); const dir = tlDir(s, L); const ns = (s.nodes || []).filter(Boolean).slice(0, dir === "h" ? 5 : TL_MAX[L]); const at = num(s.at, 0.15), f = num(s.firstAt, at + 0.5), g = num(s.gap, 0.7); return { layout: L, dir, showAt: ns.map((_, i) => stagger(at + 0.2, i)), litAt: ns.map((nd, i) => num(nd.at, f + g * i)) }; },
    cn: "时间轴 / 期限", use: "期限、阶段：「30 天内 / 60 天 / 1 年」；节点多、说明长时竖排或用 C 全屏",
    fields: "kicker title nodes[{label,sub,at,warn}] firstAt gap layout(B|C|auto) dir(h|v) fillIn fillOut ring source",
    rule: "layout 不写=B（从不自动换版式）。layout:\"auto\" → C 当且仅当：节点数 ≥ 6，或任一 sub 字数 > (节点数 ≥ 5 ? 14 : 30)。" +
      "dir 不写：C 一律竖排；B 下节点 ≤ 4 且横排时 label ≥ 30px、sub 两行内 28px 放得下 → 横排（原样），否则竖排。上限 B 6 个、C 8 个节点。" +
      "时间：节点在 at+0.2+0.12×i 灰色出现；nodes[i].at（默认 firstAt + gap×i，firstAt 默认 at+0.5，gap 默认 0.7）点亮，连线在点亮前 0.4s 开始长。" +
      "C 版式的 fillIn/fillOut/ring 同 table。",
    sfx: "每个节点 nodes[i].at 点亮一声轻 tick；警示节点不加重音；C 版式 0 秒底色铺开配一声轻 whoosh" },
  table: { C: Table, layout: "B", layouts: "B|C", layoutOf: (s) => pickLayout(s, tablePlan(s, "B").pages.length > 1),
    times: (s) => { const L = pickLayout(s, tablePlan(s, "B").pages.length > 1); const pl = tablePlan(s, L); const at = num(s.at, 0.15); return { layout: L, classic: pl.classic, pages: pl.pages, ...tableTimes(s, pl, at, num(s.out, num(s.dur, 5) - 0.3)) }; },
    cn: "对比表", use: "「个体户还是公司」这类多项对比；行多时 C 全屏或分页",
    fields: "kicker title cols[≤4] rows[[]](≤12) headAt rowAt[] rowGap accentCol focus[{row,at}] focusOff layout(B|C|auto) perPage pageGap fillIn fillOut ring source",
    rule: "layout 不写=B（从不自动换版式），B 放不下就分页；layout:\"auto\" → 按 B 算要分页（页数 > 1）就用 C。" +
      "分页：B 下 ≤4 行且所有单元格/表头 28px 一行放得下 → 原样单页；否则每页 cap 行：perPage（B≤4、C≤8），或按最挤单元格在 B 30px / C 32px 下的折行数 ml：B=ml≥3?2:ml=2?3:4，C=ml≥3?4:ml=2?6:8；页数 P=ceil(行数/cap)，各页尽量平均、前面的页多 1 行。" +
      "时间：表头 headAt（默认 at+0.25）；rowAt[i] 默认 单页 headAt+0.4+rowGap×i，多页 headAt+0.4+pageGap×页号+rowGap×页内序号（rowGap 0.45，pageGap 默认 max(1.6,(out−1.0−headAt−0.4)/P)）；" +
      "第 p 页在 rowAt[该页首行]−0.3 翻页（上一页 0.24s 淡出）；✓/✕ 在 rowAt+0.2；focus 的行不在当前页时不高亮。" +
      "C 版式另有 fillIn/fillOut（默认跟 panelIn/panelOut；false=整屏底色不淡入/不淡出，连续两段 C 用）和 ring（默认 true，圆窗细环 at+0.1 起 0.6s 画完）。",
    sfx: "表头 headAt 轻 whoosh；翻页 rowAt[该页首行]−0.3 一声轻 swish；✓/✕ 在 rowAt+0.2 各一声轻 tick；C 版式 0 秒底色铺开配一声轻 whoosh" },
  compare: { C: Compare, layout: "B", cn: "以为 / 其实", use: "「很多人以为……其实……」",
    fields: "kicker title wrongLabel wrong rightLabel right wrongAt strikeAt rightAt hlAt source",
    sfx: "strikeAt 划线 scribble 0.4s；hlAt 荧光笔 0.5s" },
  formula: { C: Formula, layout: "B", cn: "公式 / 拆解", use: "「到手 = 应发 − 社保 − 个税」这类算账",
    fields: "kicker title items[{op,label,value|text,unit,decimals,at}] result{label,value,unit,prefix,decimals,warn} mode(row|list) itemsAt gap resultAt source",
    sfx: "每项一声轻 tick；resultAt 滴答 0.6s + 色块扫光" },
};

export const DEMOS_B = [
  // 律师：借钱的诉讼时效
  { "scene": "number", "dur": 5.2, "kicker": "普通诉讼时效", "title": "借出去的钱，最多能等多久", "value": 3, "unit": "年", "countAt": 1.0,
    "labels": ["第 1 年", "第 2 年", "第 3 年到期"], "segAt": [1.7, 2.2, 2.7], "warnLast": true, "source": "来源：示例数据，仅演示版式" },
  // 保险：住院 10 万自付多少
  { "scene": "numCompare", "dur": 5.6, "kicker": "住院花了 10 万，自己要掏多少", "title": "加一份百万医疗险，差别在这",
    "a": { "label": "只有医保", "value": 3, "unit": "万" }, "b": { "label": "医保 + 百万医疗", "value": 1, "unit": "万" },
    "aAt": 0.8, "bAt": 2.0, "delta": { "pre": "自付少了", "value": 2, "unit": "万", "at": 3.1 }, "source": "来源：示例数据，按 1 万免赔额估算" },
  // 医生：幽门螺杆菌
  { "scene": "percent", "dur": 5.4, "kicker": "幽门螺杆菌感染率", "value": 50, "ringAt": 0.9,
    "lines": ["每两个人里，就有一个", "多数人没有症状，体检做个碳-13 呼气试验就能查出来"], "hl": "每两个人", "hlAt": 2.2, "lineAt": [0.6, 2.6], "source": "来源：示例数据" },
  // 职场：离职原因
  { "scene": "bars", "dur": 5.6, "kicker": "员工离职的真实原因", "title": "第三条，很多老板没想到", "unit": "%",
    "items": [{ "label": "薪资待遇", "value": 38 }, { "label": "发展空间", "value": 27 }, { "label": "直属领导", "value": 21, "hot": true }, { "label": "工作强度", "value": 14 }],
    "barsAt": 0.8, "gap": 0.35, "hotAt": 3.0, "source": "来源：示例数据" },
  // 房产：房贷逾期
  { "scene": "timeline", "dur": 5.8, "kicker": "房贷逾期会发生什么", "title": "这几个时间点一定要记住",
    "nodes": [{ "label": "第 1 天", "sub": "开始算罚息", "at": 1.0 }, { "label": "30 天", "sub": "可能上征信", "at": 1.9 }, { "label": "90 天", "sub": "列为不良贷款", "at": 2.8 }, { "label": "6 个月", "sub": "银行可能起诉", "at": 3.7, "warn": true }],
    "source": "来源：示例数据，各银行规定不同" },
  // 财税：个体户还是公司
  { "scene": "table", "dur": 6.0, "kicker": "注册个体户还是公司", "title": "看这 4 点就够了", "cols": ["", "个体户", "有限公司"], "accentCol": 2,
    "rows": [["债务责任", "无限责任", "以出资为限"], ["交的税", "经营所得", "企业所得税"], ["能开专票", "✓", "✓"], ["能加股东", "✕", "✓"]],
    "rowAt": [1.0, 1.5, 2.0, 2.5], "focus": [{ "row": 0, "at": 3.2 }, { "row": 3, "at": 4.3 }], "source": "来源：示例数据，具体以当地税务为准" },
  // 劳动法：被拖欠工资（5 个节点、说明长 → B 里自动竖排）
  { "scene": "timeline", "dur": 5.8, "kicker": "被拖欠工资", "title": "维权这几步，别错过时间",
    "nodes": [{ "label": "当天", "sub": "保留工资条、考勤和聊天记录" }, { "label": "30 天内", "sub": "向劳动监察大队投诉" }, { "label": "60 天", "sub": "公司仍不处理，准备仲裁材料" }, { "label": "1 年内", "sub": "申请劳动仲裁的时效" }, { "label": "过期", "sub": "超过时效，很难再主张", "warn": true }],
    "firstAt": 0.8, "gap": 0.7, "source": "示例内容，仅演示版式" },
  // 社保：三种缴纳方式（4 列 × 6 行 → C 全屏讲解，人物缩进左下圆窗）
  { "scene": "table", "layout": "C", "dur": 6.0, "kicker": "社保怎么交更划算", "title": "三种交法，一张表看清",
    "cols": ["对比项", "灵活就业", "单位缴纳", "城乡居民"], "accentCol": 2,
    "rows": [["养老保险", "✓", "✓", "✓"], ["医疗报销", "约 70%", "约 80%", "约 60%"], ["生育保险", "✕", "✓", "✕"], ["每月自己掏", "1,200 元左右", "约 600 元", "一年 400 元"], ["失业金", "✕", "✓", "✕"], ["退休待遇", "按缴费基数", "最高", "较低"]],
    "rowAt": [1.0, 1.5, 2.0, 2.5, 3.0, 3.5], "focus": [{ "row": 3, "at": 4.4 }], "source": "来源：示例数据，各地标准不同" },
  // 职场 / 劳动法：试用期辞退
  { "scene": "compare", "dur": 5.0, "kicker": "试用期被辞退", "wrong": "试用期公司想辞就能辞", "right": "公司得证明你不符合录用条件",
    "strikeAt": 1.3, "rightAt": 1.9, "hlAt": 2.4, "source": "示例内容，仅演示版式" },
  // 财税：到手工资拆解
  { "scene": "formula", "dur": 6.0, "kicker": "月薪 12000，到手多少", "title": "工资条这么算",
    "sep": true,
    "items": [{ "label": "应发工资", "value": 12000, "unit": "元" }, { "op": "−", "label": "个人社保", "value": 1260, "unit": "元" }, { "op": "−", "label": "住房公积金", "value": 1200, "unit": "元" }, { "op": "−", "label": "个人所得税", "value": 136, "unit": "元" }],
    "itemsAt": 0.7, "gap": 0.55, "result": { "label": "实际到手", "value": 9404, "unit": "元", "sep": true }, "resultAt": 3.3, "source": "来源：示例数据，按首月预扣估算" },
];
