import React from "react";
import { Easing } from "remotion";
import {
  useK, useT, ramp, lerp, clamp, io, countUp, stagger, fitSize, textW, hexA,
  Scrim, CardBox, Mark, SANS, SERIF, WARN, WARN_SOFT, INK, ZONE, SAFE,
} from "./lib.jsx";

// 高级感干货风 · 批次 A「人物全屏叠层与钩子」
// 9 个场景都叠在人物全屏上（layout A）。除 chapter 外不遮脸：大字和卡片在 y 230–640，小条在 y 1100–1250 / 1380–1480。
// 时间一律是段内秒；spec 里没给的时间按合理默认值走。

// ---------- 私有小工具 ----------
const X0 = SAFE.left; // 左对齐 x=72
const FULLW = 936; // 72 → 1008
const SH_BIG = "0 2px 14px rgba(0,0,0,0.42), 0 0 2px rgba(0,0,0,0.35)"; // 压暗区上的大字投影（柔和，不是描边）

// 段内时间 + 出场时间（默认 dur-0.3）
// 注意：在 <Sequence> 里 useVideoConfig 拿到的是整条合成的长度，所以 spec 带了 dur 时优先用 spec.dur。
function useSeg(spec) {
  const T = useT();
  const dur = spec.dur != null ? spec.dur : T.dur;
  const out = spec.out != null ? spec.out : dur - 0.3;
  return { t: T.t, dur, out };
}
const fadeOut = (t, out) => 1 - ramp(t, out, out + 0.24, Easing.linear);
// 标题字重（站酷小薇只有 400）
const heavy = (K, w = 900) => (K.T.title === "elegant" || K.T.title === "xiaowei" ? 500 : w);
// 是否纯英文/数字（决定用窄体数字字体还是标题字体）
const isAscii = (s) => /^[\x00-\x7F]*$/.test(String(s || ""));
// 把一句话按关键词切成三段；找不到返回 null
function cut3(text, hl) {
  const s = String(text || "");
  if (!hl) return null;
  const i = s.indexOf(hl);
  if (i < 0) return null;
  return [s.slice(0, i), hl, s.slice(i + hl.length)];
}
// 叠在人物上的「底色玻璃」配色：不跟 card 质感走，固定用风格包的 base 色（ivory 时是浅色玻璃 + 深字）
function glassOf(K, alpha) {
  const dark = K.baseDark;
  return {
    bg: `rgba(${K.baseRgb},${alpha != null ? alpha : dark ? 0.86 : 0.92})`,
    text: K.baseText,
    muted: K.baseMuted,
    ac: dark ? K.accent : K.accentDeep,
    border: dark ? "rgba(255,255,255,0.12)" : "rgba(18,22,28,0.10)",
    shadow: dark ? "0 18px 44px rgba(0,0,0,0.35)" : "0 14px 36px rgba(0,0,0,0.28)",
    hl: hexA(K.accent, dark ? 0.5 : 0.55),
    dark,
  };
}
// 钩子用的顶部压暗：比 lib 的 Scrim 往下多压一段（大字最低到 y≈640），亮背景、白衣服上也看得清。
// k：浓度倍数（spec.scrim，默认 1）
function HookScrim({ t, k = 1 }) {
  const o = ramp(t, 0, 0.3, Easing.linear);
  if (o <= 0) return null;
  const c = (a) => `rgba(10,12,16,${clamp(a * k, 0, 0.95)})`;
  return <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 920, opacity: o, background: `linear-gradient(180deg, ${c(0.84)} 0px, ${c(0.66)} 470px, ${c(0.34)} 660px, ${c(0)} 900px)` }} />;
}
// 遮罩升起（钩子大字专用，0.5 秒）：外层 overflow hidden，内层从下方 108% 升上来
function riseY(t, d) {
  return `translateY(${lerp(108, 0, ramp(t, d, d + 0.5))}%)`;
}
// 小字引子：左边一条强调色短线擦开 + 文字淡入
function HookKicker({ t, text, at = 0.05, color }) {
  const K = useK();
  if (!text) return null;
  const bar = ramp(t, at + 0.05, at + 0.45);
  const size = fitSize(text, FULLW - 80, 36, 26);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: SANS, fontSize: size, fontWeight: 800, letterSpacing: "0.12em", color: color || K.accent, whiteSpace: "nowrap", opacity: ramp(t, at, at + 0.3), textShadow: "0 1px 8px rgba(0,0,0,0.35)" }}>
      <div style={{ flex: "none", width: 54, height: 5, background: color || K.accent, transform: `scaleX(${bar})`, transformOrigin: "left" }} />
      {text}
    </div>
  );
}

// ======================================================================
// 1. hook 钩子大字：顶部压暗 + 小字引子 + 两行大字从遮罩升起，关键词强调色划线
// spec: kicker, lines[2], hl（要划线的词，在哪行都行）, hlAt
// ======================================================================
function HookScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const o = fadeOut(t, out);
  if (o <= 0) return null;
  const lines = (spec.lines || []).slice(0, 2);
  const size = Math.min(...lines.map((l) => fitSize(l, FULLW, 104, 56)));
  const hlAt = spec.hlAt != null ? spec.hlAt : 1.1;
  const ul = ramp(t, hlAt, hlAt + 0.45, Easing.out(Easing.quad));
  let used = false; // 关键词只划第一次出现
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <HookScrim t={t} k={spec.scrim} />
      <div style={{ position: "absolute", left: X0, width: FULLW, top: 236, color: "#FFFFFF" }}>
        <HookKicker t={t} text={spec.kicker} />
        {lines.map((l, i) => {
          const parts = used ? null : cut3(l, spec.hl);
          if (parts) used = true;
          return (
            <div key={i} style={{ overflow: "hidden", fontFamily: K.titleFont, fontSize: size, fontWeight: heavy(K), lineHeight: 1.26, letterSpacing: "-0.01em", whiteSpace: "nowrap", marginTop: i === 0 ? 8 : 0, paddingBottom: 4 }}>
              <span style={{ display: "inline-block", transform: riseY(t, 0.25 + 0.12 * i), textShadow: SH_BIG }}>
                {parts ? (
                  <>
                    {parts[0]}
                    <span style={{ color: K.accent, backgroundImage: `linear-gradient(${K.accent}, ${K.accent})`, backgroundRepeat: "no-repeat", backgroundPosition: "left bottom", backgroundSize: `${ul * 100}% ${Math.max(6, size * 0.075)}px`, paddingBottom: 6 }}>{parts[1]}</span>
                    {parts[2]}
                  </>
                ) : l}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================================================================
// 2. hookQ 问句钩子：左边一个很大的强调色问号（窄体数字字体），右边两行问题，关键词色块扫过
// spec: kicker?, lines[2], hl, hlAt, mark（默认 "?"）
// ======================================================================
function HookQScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const o = fadeOut(t, out);
  if (o <= 0) return null;
  const lines = (spec.lines || []).slice(0, 2);
  const mark = spec.mark || "?";
  // 问号高度 ≈ 两行字高；先按 88 估问号宽，再算右侧可用宽度
  const qGuess = 88 * 1.25 * 2;
  const qW = Math.max(textW(mark, qGuess) * 0.95, qGuess * 0.42);
  const rightW = FULLW - qW - 34;
  const size = Math.min(...lines.map((l) => fitSize(l, rightW - 24, 88, 50)));
  const qSize = size * 1.25 * 2 * 1.08;
  const hlAt = spec.hlAt != null ? spec.hlAt : 1.0;
  const q = ramp(t, hlAt, hlAt + 0.45, Easing.out(Easing.quad));
  const qp = ramp(t, 0.12, 0.62);
  let used = false;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <HookScrim t={t} k={spec.scrim} />
      <div style={{ position: "absolute", left: X0, width: FULLW, top: 236, color: "#FFFFFF" }}>
        <HookKicker t={t} text={spec.kicker} />
        <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: spec.kicker ? 14 : 0 }}>
          <div style={{ flex: "none", width: qW, height: size * 1.26 * 2, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: K.numFont, fontSize: qSize * K.numScale, fontWeight: 700, lineHeight: 1, color: K.accent, opacity: qp, transform: `translateY(${lerp(30, 0, qp)}px) scale(${lerp(0.92, 1, qp)})`, textShadow: SH_BIG }}>{mark}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {lines.map((l, i) => {
              const parts = used ? null : cut3(l, spec.hl);
              if (parts) used = true;
              return (
                <div key={i} style={{ overflow: "hidden", fontFamily: K.titleFont, fontSize: size, fontWeight: heavy(K), lineHeight: 1.26, whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-block", transform: riseY(t, 0.3 + 0.12 * i), textShadow: SH_BIG }}>
                    {parts ? (
                      <>
                        {parts[0]}
                        <span style={{ padding: "0 10px", margin: "0 4px", borderRadius: 8, color: q > 0.35 ? INK : "#FFFFFF", textShadow: q > 0.35 ? "none" : SH_BIG, backgroundImage: `linear-gradient(${K.accent}, ${K.accent})`, backgroundRepeat: "no-repeat", backgroundPosition: "left center", backgroundSize: `${q * 100}% 100%` }}>{parts[1]}</span>
                        {parts[2]}
                      </>
                    ) : l}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
// 3. hookNum 数字钩子：超大数字计数 + 单位（可选前缀），下面一句话说明
// spec: kicker?, pre?, num（数字，可带小数）, unit, from?, numAt, line, hl?, hlAt?
// ======================================================================
function HookNumScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const o = fadeOut(t, out);
  if (o <= 0) return null;
  const numStr = String(spec.num != null ? spec.num : 0);
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  const to = parseFloat(numStr) || 0;
  const numAt = spec.numAt != null ? spec.numAt : 0.35;
  const pre = spec.pre || "";
  const unit = spec.unit || "";
  // 数字字号：按「前缀 + 数字 + 单位」整行不超过 936 算
  const digitW = 0.62 * K.numScale * 1.04 * (K.T.num === "serif" ? 1.1 : 1);
  const unitAscii = isAscii(unit);
  const per = numStr.length * digitW + (pre ? textW(pre, 1) * 0.34 + 0.06 : 0) + (unit ? (unitAscii ? textW(unit, 1) * 0.55 * K.numScale : textW(unit, 1) * 0.34) + 0.06 : 0);
  const N = Math.floor(clamp(FULLW / per, 140, 260)); // 数字行高固定 0.92N，换数字字体也不会把下面那句挤到脸上
  const lineSize = spec.line ? fitSize(spec.line, FULLW, 60, 36) : 0;
  const hlAt = spec.hlAt != null ? spec.hlAt : numAt + 0.9;
  const parts = cut3(spec.line, spec.hl);
  const shown = countUp(t, numAt, to, { from: spec.from || 0, decimals });
  const np = ramp(t, numAt - 0.15, numAt + 0.25);
  const lineIO = io(t, numAt + 0.45, null, K.motion);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <HookScrim t={t} k={spec.scrim} />
      <div style={{ position: "absolute", left: X0, width: FULLW, top: 236, color: "#FFFFFF" }}>
        <HookKicker t={t} text={spec.kicker} />
        <div style={{ display: "flex", alignItems: "baseline", gap: N * 0.05, whiteSpace: "nowrap", marginTop: 4, opacity: np, transform: `translateY(${lerp(24, 0, np)}px)`, textShadow: SH_BIG }}>
          {pre ? <span style={{ fontFamily: K.titleFont, fontSize: N * 0.3, fontWeight: heavy(K) }}>{pre}</span> : null}
          <span style={{ fontFamily: K.numFont, fontSize: N * K.numScale, fontWeight: 700, lineHeight: `${Math.round(N * 0.92)}px`, color: K.accent }}>{shown}</span>
          {unit ? (unitAscii
            ? <span style={{ fontFamily: K.numFont, fontSize: N * 0.55 * K.numScale, fontWeight: 700, lineHeight: 1, color: K.accent }}>{unit}</span>
            : <span style={{ fontFamily: K.titleFont, fontSize: N * 0.3, fontWeight: heavy(K) }}>{unit}</span>) : null}
        </div>
        {spec.line && lineIO._vis ? (
          <div style={{ fontFamily: K.titleFont, fontSize: lineSize, fontWeight: heavy(K, 800), lineHeight: 1.3, whiteSpace: "nowrap", marginTop: 10, opacity: lineIO.opacity, transform: lineIO.transform, clipPath: lineIO.clipPath, textShadow: SH_BIG }}>
            {parts ? <>{parts[0]}<Mark t={t} at={hlAt} color={hexA(K.accent, 0.55)}>{parts[1]}</Mark>{parts[2]}</> : spec.line}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ======================================================================
// 4. hookFlip 反常识钩子：「很多人以为 X」X 被红线划掉；「其实 Y」Y 荧光笔扫过
// spec: kicker?, a（默认 "很多人以为"）, x, b（默认 "其实"）, y, strikeAt, bAt, markAt
// ======================================================================
function HookFlipScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const o = fadeOut(t, out);
  if (o <= 0) return null;
  const a = spec.a != null ? spec.a : "很多人以为";
  const b = spec.b != null ? spec.b : "其实";
  const LEAD = 0.56; // 引导词相对大字的比例
  const fitRow = (lead, big) => FULLW / (textW(lead, 1) * LEAD + textW(big, 1) + 0.2);
  const size = Math.floor(clamp(Math.min(fitRow(a, spec.x || ""), fitRow(b, spec.y || "")), 46, 92));
  const strikeAt = spec.strikeAt != null ? spec.strikeAt : 0.9;
  const bAt = spec.bAt != null ? spec.bAt : strikeAt + 0.45;
  const markAt = spec.markAt != null ? spec.markAt : bAt + 0.35;
  const sp = ramp(t, strikeAt, strikeAt + 0.35, Easing.out(Easing.quad));
  const row = { overflow: "hidden", whiteSpace: "nowrap", lineHeight: 1.3, paddingBottom: 4 };
  const lead = (txt, color) => <span style={{ fontFamily: SANS, fontSize: size * LEAD, fontWeight: 700, color, marginRight: size * 0.2, letterSpacing: "0.04em" }}>{txt}</span>;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <HookScrim t={t} k={spec.scrim} />
      <div style={{ position: "absolute", left: X0, width: FULLW, top: 236, color: "#FFFFFF" }}>
        <HookKicker t={t} text={spec.kicker} />
        <div style={{ ...row, marginTop: spec.kicker ? 10 : 0 }}>
          <span style={{ display: "inline-block", transform: riseY(t, 0.25), textShadow: SH_BIG }}>
            {lead(a, "rgba(255,255,255,0.78)")}
            <span style={{ position: "relative", display: "inline-block", fontFamily: K.titleFont, fontSize: size, fontWeight: heavy(K), color: sp > 0.5 ? "rgba(255,255,255,0.55)" : "#FFFFFF" }}>
              {spec.x}
              <span style={{ position: "absolute", left: -6, right: -6, top: "53%", height: Math.max(6, size * 0.075), borderRadius: 4, background: K.warn, transform: `scaleX(${sp})`, transformOrigin: "left", boxShadow: "0 1px 6px rgba(0,0,0,0.3)" }} />
            </span>
          </span>
        </div>
        <div style={row}>
          <span style={{ display: "inline-block", transform: riseY(t, bAt), textShadow: SH_BIG }}>
            {lead(b, K.accent)}
            <span style={{ fontFamily: K.titleFont, fontSize: size, fontWeight: heavy(K) }}>
              <Mark t={t} at={markAt} color={hexA(K.accent, 0.55)}>{spec.y}</Mark>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
// 5. term 名词卡：固定用 base 色玻璃底（不跟 card 质感），左侧强调色竖线从上长出
// spec: kicker?, word, sub（英文/拼音）, def（一两行释义）, hl?, hlAt?, chips?[], chipAt?（数组或起始秒）
// ======================================================================
function TermScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const at = spec.at != null ? spec.at : 0.15;
  const s = io(t, at, out, spec.motion || K.motion);
  if (!s._vis) return null;
  const G = glassOf(K);
  const W0 = 840, PL = 58, PR = 40, inner = W0 - PL - PR;
  const bar = ramp(t, at + 0.25, at + 0.65);
  const wordSize = fitSize(spec.word || "", inner * 0.62, 64, 40);
  const subSize = 28;
  const inlineSub = spec.sub && textW(spec.word || "", wordSize) + 22 + textW(spec.sub, subSize) * 0.92 <= inner;
  const chips = (spec.chips || []).slice(0, 4);
  const chipTimes = chips.map((_, i) => Array.isArray(spec.chipAt) ? (spec.chipAt[i] != null ? spec.chipAt[i] : at + 1 + 0.6 * i) : (spec.chipAt != null ? spec.chipAt : at + 1.0) + 0.6 * i);
  // 胶囊字号：一行放下所有子类
  const n = chips.length;
  const chipSize = n ? Math.floor(clamp((inner - n * 50 - 14 * (n - 1)) / chips.reduce((acc, c) => acc + textW(c, 1) + 1.25, 0), 26, 42)) : 0;
  const defParts = cut3(spec.def, spec.hl);
  const hlAt = spec.hlAt != null ? spec.hlAt : at + 0.9;
  const { _vis, ...st } = s;
  return (
    <div style={{ position: "absolute", left: X0, top: spec.y != null ? spec.y : 270, width: W0, ...st }}>
      <div style={{ position: "relative", background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 22, boxShadow: G.shadow, padding: `26px ${PR}px 28px ${PL}px`, color: G.text, fontFamily: SANS }}>
        <div style={{ position: "absolute", left: 24, top: 28, bottom: 28, width: 8, borderRadius: 8, background: K.accent, transform: `scaleY(${bar})`, transformOrigin: "top" }} />
        {spec.kicker ? <div style={{ fontSize: 28, fontWeight: 700, color: G.muted, letterSpacing: "0.08em", whiteSpace: "nowrap", marginBottom: 6 }}>{spec.kicker}</div> : null}
        <div style={{ display: inlineSub ? "flex" : "block", alignItems: "baseline", gap: 22, whiteSpace: "nowrap" }}>
          <div style={{ fontFamily: K.titleFont, fontSize: wordSize, fontWeight: heavy(K), lineHeight: 1.22 }}>{spec.word}</div>
          {spec.sub ? <div style={{ fontFamily: "Georgia, 'Noto Serif SC', serif", fontStyle: "italic", fontSize: fitSize(spec.sub, inner, subSize, 20), color: G.muted, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis" }}>{spec.sub}</div> : null}
        </div>
        {spec.def ? (
          <div style={{ fontSize: 30, lineHeight: 1.5, marginTop: 8, color: G.text, opacity: 0.9, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {defParts ? <>{defParts[0]}<Mark t={t} at={hlAt} color={G.hl}>{defParts[1]}</Mark>{defParts[2]}</> : spec.def}
          </div>
        ) : null}
        {n ? (
          <div style={{ display: "flex", gap: 14, marginTop: 16, whiteSpace: "nowrap" }}>
            {chips.map((c, i) => {
              const p = ramp(t, chipTimes[i], chipTimes[i] + 0.3);
              return (
                <div key={i} style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 8, padding: "8px 20px", borderRadius: 14, background: p > 0 ? hexA(K.accent, (G.dark ? 0.22 : 0.26) * p) : (G.dark ? "rgba(255,255,255,0.06)" : "rgba(18,22,28,0.05)"), border: `2px solid ${hexA(K.accent, 0.18 + 0.62 * p)}`, opacity: lerp(0.42, 1, p), transform: `scale(${lerp(0.96, 1, p)})` }}>
                  <span style={{ fontFamily: K.numFont, fontSize: chipSize * 0.86 * K.numScale, fontWeight: 700, color: G.ac }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ fontSize: chipSize, fontWeight: 900, color: G.text }}>{c}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ======================================================================
// 6. nameplate 身份条（下三分之一）：姓名大字 + 头衔/机构小字 + 可选「执业 N 年」，y 1100–1250，强调色细线从左擦开
// spec: name, role?, org?, stat?{pre, num, unit, at}, lineAt?
// ======================================================================
function NameplateScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const at = spec.at != null ? spec.at : 0.1;
  const s = io(t, at, out, spec.motion || K.motion);
  if (!s._vis) return null;
  const G = glassOf(K);
  const PX = 34, maxW = 840, inner = maxW - PX * 2;
  const st0 = spec.stat;
  const statStr = st0 ? String(st0.num) : "";
  const statW = st0 ? 2 + 36 + textW(st0.pre || "", 26) + 8 + statStr.length * 0.62 * 64 * K.numScale + 8 + textW(st0.unit || "", 26) : 0;
  const nameSize = fitSize(spec.name || "", inner - statW, 60, 40);
  const role = [spec.role, spec.org].filter(Boolean).join("  ·  ");
  const roleSize = role ? fitSize(role, inner, 30, 22) : 0;
  const lineAt = spec.lineAt != null ? spec.lineAt : at + 0.2;
  const lp = ramp(t, lineAt, lineAt + 0.5);
  const statAt = st0 && st0.at != null ? st0.at : at + 0.6;
  const sp = ramp(t, statAt - 0.1, statAt + 0.25);
  const rp = ramp(t, at + 0.2, at + 0.5);
  const { _vis, ...st } = s;
  return (
    <div style={{ position: "absolute", left: X0, top: spec.y != null ? spec.y : 1100, maxWidth: maxW, ...st }}>
      <div style={{ position: "relative", display: "inline-block", background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 16, boxShadow: G.shadow, padding: `18px ${PX}px 20px`, color: G.text, fontFamily: SANS, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
          <div style={{ fontFamily: K.titleFont, fontSize: nameSize, fontWeight: heavy(K), lineHeight: 1.15, letterSpacing: "0.04em" }}>{spec.name}</div>
          {st0 ? (
            <div style={{ display: "flex", alignItems: "center", opacity: sp }}>
              <div style={{ width: 2, height: nameSize * 0.8, background: G.border.replace(/0\.1[02]\)/, "0.3)"), margin: "0 18px", opacity: 0.9 }} />
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                {st0.pre ? <span style={{ fontSize: 26, fontWeight: 700, color: G.muted }}>{st0.pre}</span> : null}
                <span style={{ fontFamily: K.numFont, fontSize: 64 * K.numScale, fontWeight: 700, lineHeight: 0.9, color: G.ac }}>{countUp(t, statAt, parseFloat(statStr) || 0, { decimals: statStr.includes(".") ? statStr.split(".")[1].length : 0 })}</span>
                {st0.unit ? <span style={{ fontSize: 26, fontWeight: 700, color: G.muted }}>{st0.unit}</span> : null}
              </div>
            </div>
          ) : null}
        </div>
        {role ? <div style={{ fontSize: roleSize, fontWeight: 600, color: G.muted, lineHeight: 1.4, marginTop: 6, whiteSpace: "nowrap", opacity: rp, letterSpacing: "0.04em" }}>{role}</div> : null}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: K.accent, transform: `scaleX(${lp})`, transformOrigin: "left" }} />
      </div>
    </div>
  );
}

// ======================================================================
// 7. quote 金句卡：叠在人物上方 y 230–640，大号引号（强调色）+ 宋体两行金句（关键几字荧光笔）+ 可选署名
// 用风格包的 card 质感；line/glass 叠在人物上时自动加厚底色，保证 ivory 下也看得清。
// spec: lines[2], hl, hlAt, by?, byAt?
// ======================================================================
function QuoteScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const at = spec.at != null ? spec.at : 0.15;
  const lines = (spec.lines || []).slice(0, 2);
  const PADX = 54;
  const size = Math.min(...lines.map((l) => fitSize(l, FULLW - PADX * 2 - 8, 62, 38)));
  const lh = size * 1.5;
  const h = 40 + 66 + lines.length * lh + (spec.by ? 54 : 0) + 40;
  const hlAt = spec.hlAt != null ? spec.hlAt : at + 1.0;
  const byAt = spec.byAt != null ? spec.byAt : at + 0.6;
  // line（细线框）默认只有 0.55 底色，叠在人物上太透：加厚
  const bgFix = K.card === "line" ? { background: `rgba(${K.baseRgb},${K.baseDark ? 0.8 : 0.92})` } : K.card === "glass" && !K.baseDark ? { background: `rgba(${K.baseRgb},0.94)` } : undefined;
  const hlColor = K.lightCard ? K.hl : hexA(K.accent, 0.5);
  let used = false;
  return (
    <CardBox t={t} at={at} out={out} x={X0} y={spec.y != null ? spec.y : 250} w={FULLW} h={h} pad={`40px ${PADX}px`} style={bgFix}>
      <div style={{ position: "absolute", left: PADX - 6, top: 16, fontFamily: SERIF, fontSize: 150, fontWeight: 900, lineHeight: 1, color: K.cardAc, opacity: ramp(t, at + 0.1, at + 0.4) }}>“</div>
      <div style={{ marginTop: 66, fontFamily: SERIF }}>
        {lines.map((l, i) => {
          const p = ramp(t, stagger(at + 0.2, i), stagger(at + 0.2, i) + 0.36);
          const parts = used ? null : cut3(l, spec.hl);
          if (parts) used = true;
          return (
            <div key={i} style={{ fontSize: size, fontWeight: 900, lineHeight: 1.5, whiteSpace: "nowrap", opacity: p, transform: `translateY(${lerp(16, 0, p)}px)` }}>
              {parts ? <>{parts[0]}<Mark t={t} at={hlAt} color={hlColor}>{parts[1]}</Mark>{parts[2]}</> : l}
            </div>
          );
        })}
      </div>
      {spec.by ? (
        <div style={{ marginTop: 14, fontSize: fitSize(spec.by, FULLW - PADX * 2, 28, 20), fontWeight: 600, color: K.cardMuted, whiteSpace: "nowrap", letterSpacing: "0.04em", opacity: ramp(t, byAt, byAt + 0.3) }}>{spec.by}</div>
      ) : null}
    </CardBox>
  );
}

// ======================================================================
// 8. warn 提示条：字幕下方 y≈1392–1478 一条细条，左侧竖线；kind risk（警示红）/ info（强调色）/ law（灰，免责）
// spec: kind, label?, text, hl?, hlAt?, at?
// ======================================================================
const WARN_LABEL = { risk: "注意", info: "提示", law: "声明" };
function WarnScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const at = spec.at != null ? spec.at : 0.3;
  const s = io(t, at, out, spec.motion || K.motion);
  if (!s._vis) return null;
  const G = glassOf(K);
  const kind = spec.kind || "risk";
  const barC = kind === "risk" ? K.warn : kind === "info" ? K.accent : G.muted;
  const labC = kind === "risk" ? (G.dark ? K.warnSoft : K.warn) : kind === "info" ? G.ac : G.muted;
  const label = spec.label != null ? spec.label : WARN_LABEL[kind] || "提示";
  const maxW = 840, PL = 54, PR = 30;
  const base = kind === "law" ? 28 : 32;
  const labW = label ? textW(label, base) + 14 : 0;
  const avail = maxW - PL - PR - labW - 6;
  let size = fitSize(spec.text || "", avail, base, 20);
  // 一行要缩到 24 以下就改两行（最多两行，超出截断）
  const wrap = size < 24;
  if (wrap) size = kind === "law" ? 25 : 27;
  const bar = ramp(t, at + 0.2, at + 0.6);
  const parts = cut3(spec.text, spec.hl);
  const hlAt = spec.hlAt != null ? spec.hlAt : at + 0.8;
  const hlC = kind === "risk" ? hexA(K.warn, G.dark ? 0.45 : 0.3) : G.hl;
  const { _vis, ...st } = s;
  return (
    <div style={{ position: "absolute", left: X0, top: spec.y != null ? spec.y : 1392, maxWidth: maxW, ...st }}>
      <div style={{ position: "relative", display: "inline-flex", alignItems: "baseline", whiteSpace: wrap ? "normal" : "nowrap", width: wrap ? maxW : undefined, boxSizing: "border-box", background: G.bg, border: `1.5px solid ${G.border}`, borderRadius: 16, boxShadow: G.shadow, padding: `${kind === "law" ? 18 : 20}px ${PR}px ${kind === "law" ? 18 : 20}px ${PL}px`, fontFamily: SANS, fontSize: size, lineHeight: 1.45, color: kind === "law" ? G.muted : G.text }}>
        <div style={{ position: "absolute", left: 24, top: 18, bottom: 18, width: 7, borderRadius: 7, background: barC, transform: `scaleY(${bar})`, transformOrigin: "top" }} />
        {label ? <b style={{ flex: "none", color: labC, marginRight: 14, fontSize: wrap ? size : base, fontWeight: 900 }}>{label}</b> : null}
        <span style={wrap ? { flex: 1, minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>{parts ? <>{parts[0]}<Mark t={t} at={hlAt} color={hlC}>{parts[1]}</Mark>{parts[2]}</> : spec.text}</span>
      </div>
    </div>
  );
}

// ======================================================================
// 9. chapter 章节过场：短暂压暗全屏（默认 1.2 秒），「第 2 点」大字 + 强调色横线 + 小标题；
//    压暗结束后大字缩小停到顶部（dock，默认开），人物露出来；dock:false 则随压暗一起退场。
// spec: pre（"第"/"Part"）, no, post（"点"）, title, titleAt?, dim?, dock?, total?
// ======================================================================
function ChapterScene({ spec }) {
  const K = useK();
  const { t, out } = useSeg(spec);
  const dim = clamp(spec.dim != null ? spec.dim : 1.2, 0.6, 2.0);
  const dock = spec.dock !== false;
  const endAt = dock ? out : dim;
  const o = fadeOut(t, endAt);
  if (o <= 0) return null;
  const dimO = ramp(t, 0, 0.25, Easing.linear) * (1 - ramp(t, dim, dim + 0.5, Easing.linear)); // 压暗和停靠同步退，大字移过脸时还有底
  const dk = dock ? ramp(t, dim, dim + 0.5, Easing.inOut(Easing.cubic)) : 0;
  const pre = spec.pre != null ? spec.pre : "第";
  const post = spec.post != null ? spec.post : "点";
  const no = String(spec.no != null ? spec.no : 1);
  const N = 230;
  const sideSize = (s) => (isAscii(s) ? { fontFamily: K.numFont, fontSize: N * 0.42 * K.numScale, fontWeight: 700, letterSpacing: "0.04em" } : { fontFamily: K.titleFont, fontSize: N * 0.36, fontWeight: heavy(K) });
  const titleAt = spec.titleAt != null ? spec.titleAt : 0.45;
  const titleSize = spec.title ? fitSize(spec.title, FULLW, 54, 34) : 0;
  const tp = ramp(t, titleAt, titleAt + 0.36);
  const lineP = ramp(t, 0.3, 0.75);
  const total = spec.total ? Math.min(8, spec.total) : 0;
  const cur = parseInt(no, 10) || 0;
  const enter = io(t, 0.08, null, K.motion);
  const { _vis, ...est } = enter;
  const topY = lerp(640, 262, dk);
  const sc = lerp(1, 0.56, dk);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      {/* 顶部压暗：停靠后保证小标签清楚 */}
      {dock ? <Scrim t={t} a={dim - 0.2} h={820} strength={0.72} /> : null}
      {dimO > 0 ? <div style={{ position: "absolute", inset: 0, background: "rgba(10,12,16,0.8)", opacity: dimO }} /> : null}
      <div style={{ position: "absolute", left: X0, top: topY, width: FULLW, transform: `scale(${sc})`, transformOrigin: "0 0", color: "#FFFFFF" }}>
        <div style={{ ...est, transform: est.transform }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: N * 0.06, whiteSpace: "nowrap", textShadow: SH_BIG }}>
            {pre ? <span style={sideSize(pre)}>{pre}</span> : null}
            <span style={{ fontFamily: K.numFont, fontSize: N * K.numScale, fontWeight: 700, lineHeight: 0.92, color: K.accent }}>{no}</span>
            {post ? <span style={sideSize(post)}>{post}</span> : null}
          </div>
          <div style={{ width: 150, height: 7, borderRadius: 4, marginTop: 22, background: K.accent, transform: `scaleX(${lineP})`, transformOrigin: "left" }} />
        </div>
        {spec.title ? (
          <div style={{ fontFamily: K.titleFont, fontSize: titleSize, fontWeight: heavy(K, 800), lineHeight: 1.3, marginTop: 24, whiteSpace: "nowrap", opacity: tp, transform: `translateY(${lerp(18, 0, tp)}px)`, textShadow: SH_BIG }}>{spec.title}</div>
        ) : null}
        {total ? (
          <div style={{ display: "flex", gap: 10, marginTop: 26, opacity: ramp(t, titleAt + 0.1, titleAt + 0.4) }}>
            {Array.from({ length: total }).map((_, i) => {
              const on = i + 1 < cur ? 1 : i + 1 === cur ? ramp(t, titleAt + 0.25, titleAt + 0.6) : 0;
              return (
                <div key={i} style={{ width: 64, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.22)", overflow: "hidden" }}>
                  <div style={{ width: `${on * 100}%`, height: "100%", background: K.accent }} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------- 导出 ----------
export const SCENES_A = {
  hook: { C: HookScene, layout: "A", cn: "钩子大字", use: "开头 3 秒内最抓人的一句", sfx: "0 秒 whoosh；hlAt 关键词划线 scribble 0.45s" },
  hookQ: { C: HookQScene, layout: "A", cn: "问句钩子", use: "开头抛出一个问题：「到底要不要…？」", sfx: "0.1 秒 whoosh；hlAt 色块扫光 swipe 0.45s" },
  hookNum: { C: HookNumScene, layout: "A", cn: "数字钩子", use: "开头用一个数字抓人：年限、比例、金额", sfx: "numAt 起细小滴答 0.6s；hlAt 划线声" },
  hookFlip: { C: HookFlipScene, layout: "A", cn: "反常识钩子", use: "开头「很多人以为…其实…」", sfx: "strikeAt 划掉 scratch 0.35s；markAt 荧光笔 swipe 0.5s" },
  term: { C: TermScene, layout: "A", cn: "名词卡", use: "专业名词第一次出现时解释一下", sfx: "at 轻 whoosh；每个 chipAt 一声轻 tick" },
  nameplate: { C: NameplateScene, layout: "A", cn: "身份条", use: "开头报身份，建立信任", sfx: "at 轻 whoosh；stat.at 细小滴答 0.6s" },
  quote: { C: QuoteScene, layout: "A", cn: "金句卡", use: "一句值得截图的话，叠在人物上方", sfx: "at 轻 whoosh；hlAt 荧光笔 swipe 0.55s" },
  warn: { C: WarnScene, layout: "A", cn: "提示条", use: "风险提醒、补充提示、免责声明", sfx: "risk 可配一声低沉 tick；info/law 不配音效" },
  chapter: { C: ChapterScene, layout: "A", cn: "章节过场", use: "长视频分段：「第 2 点」", sfx: "0 秒低频 whoosh；titleAt 轻 tick" },
};

export const DEMOS_A = [
  { "scene": "hook", "dur": 4.0, "kicker": "借钱给朋友的人注意", "lines": ["拖过这个期限", "钱可能要不回来"], "hl": "要不回来", "hlAt": 1.1 },
  { "scene": "hookQ", "dur": 4.0, "kicker": "体检报告", "lines": ["查出甲状腺结节", "到底要不要切？"], "hl": "要不要切", "hlAt": 1.15 },
  { "scene": "hookNum", "dur": 4.5, "kicker": "试用期最长不能超过", "num": 6, "unit": "个月", "numAt": 0.4, "line": "多约的部分，公司要给你赔偿金", "hl": "赔偿金", "hlAt": 1.6 },
  { "scene": "hookFlip", "dur": 4.5, "kicker": "开了个体户的注意", "x": "没收入就不用报税", "y": "没收入也要零申报", "strikeAt": 1.0, "bAt": 1.5, "markAt": 1.9 },
  { "scene": "term", "dur": 4.5, "kicker": "名词解释", "word": "幽门螺杆菌", "sub": "Helicobacter pylori", "def": "能在胃里长期存活的细菌，和慢性胃炎、胃溃疡有关", "hl": "慢性胃炎、胃溃疡", "hlAt": 1.1, "chips": ["呼气试验", "胃镜活检", "粪便抗原"], "chipAt": [2.0, 2.6, 3.2] },
  { "scene": "nameplate", "dur": 4.0, "name": "陈律师", "role": "婚姻家事律师", "org": "示例律师事务所", "stat": { "pre": "执业", "num": 12, "unit": "年", "at": 0.9 } },
  { "scene": "quote", "dur": 5.0, "lines": ["孩子不是不努力", "是没找到对的方法"], "hl": "对的方法", "hlAt": 1.5, "by": "—— 王老师 · 高中数学教研 15 年" },
  { "scene": "warn", "dur": 4.0, "kind": "risk", "text": "签购房合同前，一定先查产权和抵押", "hl": "产权和抵押", "hlAt": 1.2 },
  { "scene": "chapter", "dur": 3.5, "pre": "第", "no": 2, "post": "点", "title": "离职前，先把这三样证据留好", "total": 3, "dim": 1.2 },
];
