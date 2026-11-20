import React from "react";
import { Img } from "remotion";
import { C, MARK, HAND, BODY, useT, ramp, spr, lerp, EINOUT, Paper, Title, Note, Hand, Highlight, Strike, Tick, XMark, Chip, Bubble, ChatWin, Tape, Stamp, RectStamp, DrawCircle, Wavy, Doodle, Erase, enter, jit } from "./lib.jsx";

// 白板便签风 · 场景模板。每段动效只写一个 SPEC（纯 JSON，时间是「动效内秒」），交给对应场景渲染。
// 版面、安全区、字号适配都在这里（版式 B 内容区下沿 y=1190，下面依次是字幕 1200–1290、人物圆圈 1320–1640）；scripts/scene_cues.py 读同一份 SPEC 生成音效并检查放不放得下。
// 文字测量与换行规则要和 scene_cues.py 保持一致。

// ---------- 文字测量 / 适配 ----------
const WIDE = /[⺀-鿿豈-﫿＀-￯　-〿‘-‟…←-⇿①-⓿]/;
export function charW(ch) {
  if (WIDE.test(ch)) return 1.0;
  if (ch === " ") return 0.3;
  if (/[A-Z0-9]/.test(ch)) return 0.62;
  if (/[a-z]/.test(ch)) return 0.55;
  return 0.4;
}
export const rawW = (s, size) => [...s].reduce((a, ch) => a + charW(ch), 0) * size;
export const textW = (s, size) => rawW(s, size) * 1.05;
const BREAK_AFTER = /[，。、；：！？,.;:!?）)\s]/;
const ALNUM = /[A-Za-z0-9]/;

// 一行放不下：先在字号范围内缩，再按短语断成两行；仍放不下 over=true（scene_cues.py 会报出来）
export function fit(text, maxW, maxSize, minSize, maxLines = 2) {
  const one = textW(text, 1);
  let size = Math.min(maxSize, maxW / one);
  if (size >= minSize || maxLines < 2) return { lines: [text], size: Math.floor(Math.max(size, minSize)), over: size < minSize };
  // 先找标点处断开（按短语）；标点处断开放得下就一定用它，否则才在字与字之间断
  const chars = [...text];
  let bp = null, bc = null;
  for (let i = 1; i < chars.length; i++) {
    const a = chars[i - 1], b = chars[i];
    if (ALNUM.test(a) && ALNUM.test(b)) continue;
    const l1 = chars.slice(0, i).join("").trimEnd(), l2 = chars.slice(i).join("").trimStart();
    if (!l1 || !l2) continue;
    const w = Math.max(textW(l1, 1), textW(l2, 1));
    if (BREAK_AFTER.test(a)) { if (!bp || w < bp.w) bp = { w, lines: [l1, l2] }; }
    else if (!bc || w < bc.w) bc = { w, lines: [l1, l2] };
  }
  const sz = (o) => Math.min(maxSize, maxW / o.w);
  const best = bp && sz(bp) >= minSize ? bp : bc && (!bp || sz(bc) > sz(bp)) ? bc : bp;
  if (!best) return { lines: [text], size: minSize, over: true };
  size = sz(best);
  return { lines: best.lines, size: Math.floor(Math.max(size, minSize)), over: size < minSize };
}

// 固定字号下按宽度折行（聊天气泡用），不拆英文单词
export function wrap(text, maxW, size) {
  const chars = [...text], lines = [];
  let cur = "";
  for (let i = 0; i < chars.length; i++) {
    const nxt = cur + chars[i];
    if (cur && textW(nxt, size) > maxW) {
      let cut = cur.length;
      if (ALNUM.test(chars[i])) {
        const m = cur.match(/[A-Za-z0-9]+$/);
        if (m && m[0].length < cur.length) cut = cur.length - m[0].length;
      }
      lines.push(cur.slice(0, cut).trimEnd());
      cur = cur.slice(cut).trimStart() + chars[i];
    } else cur = nxt;
  }
  if (cur) lines.push(cur);
  return lines;
}

const col = (name, d) => (name && C[name]) || d;
const CYCLE = ["noteY", "noteB", "noteG", "noteP"];
const dflt = (v, d) => (v == null ? d : v);

function FitText({ f, font, color = C.ink, weight, lh = 1.15, style = {} }) {
  return (
    <div style={{ fontFamily: font, fontSize: f.size, fontWeight: weight, color, lineHeight: lh, whiteSpace: "nowrap", ...style }}>
      {f.lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

// 手写字：可能被 fit 断成两行，按字数分配书写时间，逐行写出
function HandLines({ t, a, b, x, y, f, rot = -2, color }) {
  const n = f.lines.reduce((s, l) => s + [...l].length, 0) || 1;
  let acc = 0;
  return (
    <>
      {f.lines.map((l, i) => {
        const a1 = a + ((b - a) * acc) / n;
        acc += [...l].length;
        const b1 = a + ((b - a) * acc) / n;
        return <Hand key={i} t={t} a={a1} b={b1} x={x + i * 10} y={y + i * f.size * 1.15} size={f.size} rot={rot} color={color}>{l}</Hand>;
      })}
    </>
  );
}

// 版式 B 标题：一行，84→56；hl 是标题里要荧光笔划出的那几个字
function SceneTitle({ t, spec }) {
  if (!spec.title) return null;
  const f = fit(spec.title, 880, 84, 56, 1);
  let hl = null;
  if (spec.hl && spec.title.indexOf(spec.hl) >= 0) {
    hl = [rawW(spec.title.slice(0, spec.title.indexOf(spec.hl)), f.size), rawW(spec.hl, f.size)];
  }
  return <Title t={t} at={dflt(spec.titleAt, 0.05)} x={120} y={110} size={f.size} hl={hl}>{spec.title}</Title>;
}

// 条目标记：tick 打勾 | x 打叉 | circle 手绘圈住这一条 | erase 橡皮擦擦掉这一条（box 是这一条的范围）
function Mark({ t, kind, at, x, y, box }) {
  if (kind === "tick") return <Tick t={t} a={at} x={x} y={y - 6} size={64} />;
  if (kind === "x") return <XMark t={t} a={at} x={x + 4} y={y} size={52} />;
  if (kind === "circle" && box) return <DrawCircle t={t} a={at} x={box.x} y={box.y} w={box.w} h={box.h} seed={"mk" + at} />;
  if (kind === "erase" && box) return <Erase t={t} a={at} b={at + 0.6} x={box.x} y={box.y} w={box.w} h={box.h} />;
  return null;
}

// ---------- 1 清单：标题 + 逐条出现（可编号、可打勾/打叉） ----------
// {"scene":"list","title":"把 5 件事说清楚","hl":"5 件事","items":[{"text":"我要什么结果？","at":0.05,"mark":"tick","markAt":0.6}],"numbered":true}
export function ListScene({ spec }) {
  if (spec.style === "notes") return <ListNotes spec={spec} />;
  const { t } = useT();
  const items = spec.items || [];
  const n = Math.max(items.length, 1);
  const top = spec.title ? 300 : 160, bottom = 1190;
  const rowH = Math.min(172, (bottom - top) / n);
  const num = spec.numbered !== false;
  const circ = Math.min(110, rowH - 40);
  const left = num ? 120 + circ + 30 : 150;
  const markW = items.some((o) => o.mark) ? 110 : 0;
  const maxW = 960 - left - markW;
  const maxSize = Math.min(60, Math.floor(rowH * 0.42));
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      {items.map((o, i) => {
        const p = spr(t, o.at, 0.45);
        if (p <= 0) return null;
        const f = fit(o.text, maxW, maxSize, 36, 2);
        const y = top + i * rowH;
        const lineH = f.size * 1.2;
        const ty = y + circ / 2 - (f.lines.length * lineH) / 2;
        const active = t >= o.at && (i === items.length - 1 || t < items[i + 1].at);
        const wMax = Math.max(...f.lines.map((l) => rawW(l, f.size)));
        const hc = col(o.color, C[CYCLE[i % 4]]);
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, opacity: Math.min(1, p * 1.8), transform: `translateX(${(1 - p) * -40}px)` }}>
            {num ? <div style={{ position: "absolute", left: 120, top: y, width: circ, height: circ, borderRadius: circ / 2, background: active ? C.red : C.ink, color: C.white, fontFamily: MARK, fontSize: circ * 0.64, lineHeight: `${circ}px`, textAlign: "center" }}>{i + 1}</div> : null}
            <div style={{ position: "absolute", left, top: ty }}>
              {f.lines.map((l, k) => (
                <Highlight key={k} t={t} a={o.at + 0.2 + k * 0.15} b={o.at + 0.8 + k * 0.15} x={-6} y={k * lineH + f.size * 0.6} w={rawW(l, f.size) + 12} h={f.size * 0.6} color={hc} />
              ))}
              <div style={{ position: "relative" }}><FitText f={f} font={BODY} weight={700} lh={1.2} /></div>
            </div>
            {o.mark ? <Mark t={t} kind={o.mark} at={dflt(o.markAt, o.at + 0.4)} x={Math.min(left + wMax + 30, 960 - 70)} y={y + circ / 2 - 30}
              box={o.mark === "erase" ? { x: num ? 110 : left - 14, y: Math.min(y, ty) - 8, w: (num ? left - 110 : 14) + wMax + 24, h: Math.max(circ, f.lines.length * lineH) + 16 } : { x: left - 10, y: ty - 6, w: wMax + 20, h: f.lines.length * lineH + 12 }} /> : null}
          </div>
        );
      })}
    </Paper>
  );
}

// ---------- 2 划掉替换：「不是 X，而是 Y」 ----------
// {"scene":"strike","title":"关键是什么","from":"去AI味","fromAt":0.5,"strikeAt":2.0,"to":"+ 人味","toAt":3.0,"hand":{"text":"……","at":4,"end":5}}
// from 也可以是数组（一串词逐个出现、逐个划掉）
export function StrikeScene({ spec }) {
  const { t } = useT();
  const top = spec.title ? 330 : 200;
  const fromAt = dflt(spec.fromAt, 0.3), sAt = spec.strikeAt;
  const toAt = dflt(spec.toAt, sAt + 0.7);
  let y = top;
  const els = [];
  if (Array.isArray(spec.from)) {
    let x = 120, row = 0;
    spec.from.forEach((w, i) => {
      const cw = textW(w, 46) + 62;
      if (x + cw > 960 && x > 120) { x = 120; row += 1; }
      const cy = top + row * 120;
      const st = sAt + i * 0.17;
      els.push(
        <div key={"c" + i} style={{ opacity: 1 - 0.45 * ramp(t, toAt - 0.3, toAt) }}>
          <Chip t={t} at={fromAt + i * 0.16} x={x} y={cy} size={46} rot={i % 2 ? 1.5 : -1.5}>{w}</Chip>
          {t >= st ? <Strike t={t} a={st} x={x - 6} y={cy + 40} w={cw + 10} width={8} rot={-3} /> : null}
        </div>
      );
      x += cw + 34;
    });
    y = top + (row + 1) * 120 + 40;
  } else {
    const f = fit(spec.from, 840, 120, 64, 1);
    const struck = t >= sAt + 0.1;
    els.push(
      <div key="from" style={{ position: "absolute", left: 120, top: y, opacity: ramp(t, fromAt, fromAt + 0.3) }}>
        <FitText f={f} font={MARK} color={struck ? C.muted : C.ink} />
      </div>
    );
    els.push(<Strike key="s" t={t} a={sAt} b={sAt + 0.4} x={114} y={y + f.size * 0.62} w={rawW(spec.from, f.size) + 16} width={10} rot={-5} />);
    y += f.size * 1.2 + 20;
  }
  const arrowAt = dflt(spec.arrowAt, Math.min(sAt + 0.5, toAt - 0.1));
  els.push(<div key="ar" style={{ position: "absolute", left: 140, top: y, fontFamily: MARK, fontSize: 96, color: C.red, opacity: ramp(t, arrowAt, arrowAt + 0.2) }}>↓</div>);
  y += 130;
  const tf = fit(spec.to, 740, 110, 60, 1);
  const nw = Math.min(840, textW(spec.to, tf.size) + 110), nh = Math.round(tf.size * 1.7);
  if (t >= toAt) els.push(<Note key="to" t={t} at={toAt} x={120} y={y} w={nw} h={nh} color={col(spec.toColor, C.noteY)} seed={spec.to} fontSize={tf.size}>{spec.to}</Note>);
  y += nh + 60;
  if (spec.hand) {
    const hf = fit(spec.hand.text, 860, 84, 52, 2);
    els.push(<HandLines key="h" t={t} a={spec.hand.at} b={spec.hand.end} x={130} y={Math.min(y, 1190 - hf.lines.length * hf.size * 1.15)} f={hf} />);
  }
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      {els}
    </Paper>
  );
}

// ---------- 3 步骤头：第 N 步 + 大便签 + 小气泡 + 手写补充 ----------
// {"scene":"step","n":1,"sub":"先说最简单的","label":"第一步","at":0.05,"note":{"text":"加废话","at":1.2},"chips":[{"text":"啊","at":2.7}],"hand":{"text":"这些语气词","at":3.5,"end":4.0}}
export function StepScene({ spec }) {
  const { t } = useT();
  const at = dflt(spec.at, 0.05);
  const p = spr(t, at, 0.45);
  const lf = fit(spec.label || "", 730, 72, 48, 1);
  let y = 330;
  const els = [];
  if (spec.note) {
    const nf = fit(spec.note.text, 680, 120, 60, 1);
    if (t >= spec.note.at) els.push(<Note key="n" t={t} at={spec.note.at} x={160} y={y} w={760} h={220} color={col(spec.note.color, C.noteY)} seed={"s" + spec.n} fontSize={nf.size}>{spec.note.text}</Note>);
    y += 220 + 110;
  }
  if (spec.chips && spec.chips.length) {
    let x = 160, row = 0;
    spec.chips.forEach((c, i) => {
      const cs = fit(c.text, 380, 100, 44, 1).size;
      const cw = textW(c.text, cs) + 110;
      if (x + cw > 960 && x > 160) { x = 160; row += 1; }
      els.push(<Bubble key={"b" + i} t={t} at={c.at} x={x} y={y + row * 200} size={cs} tail={i % 2 ? "right" : "left"} rot={i % 2 ? 4 : -4} color={col(c.color, i % 2 ? C.noteP : C.white)} pad="10px 44px">{c.text}</Bubble>);
      x += cw + 60;
    });
    y += (row + 1) * 200 + 80;
  }
  if (spec.hand) {
    const hf = fit(spec.hand.text, 840, 84, 52, 2);
    els.push(<HandLines key="h" t={t} a={spec.hand.at} b={spec.hand.end} x={160} y={Math.min(y, 1190 - hf.lines.length * hf.size * 1.15)} f={hf} />);
  }
  return (
    <Paper t={t}>
      <div style={{ position: "absolute", left: 120, top: 100, opacity: Math.min(1, p * 1.8), display: "flex", alignItems: "center", gap: 26, transform: `translateY(${(1 - p) * 20}px)` }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, background: C.ink, color: C.white, fontFamily: MARK, fontSize: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>{spec.n}</div>
        <div>
          {spec.sub ? <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 36, color: C.muted, whiteSpace: "nowrap" }}>{spec.sub}</div> : null}
          <div style={{ fontFamily: MARK, fontSize: lf.size, color: C.ink, whiteSpace: "nowrap" }}>{spec.label}</div>
        </div>
      </div>
      {els}
    </Paper>
  );
}

// ---------- 4 聊天演示：聊天窗里你/AI 一来一回，窗下可接结论标签 ----------
// {"scene":"chat","title":"聊天最典型的模式","hl":"聊天","window":"聊天窗口","winAt":0.45,
//  "messages":[{"who":"me","text":"出一个题目","at":2.0},{"who":"ai","text":"来回答","at":3.1,"typing":true,"typeDur":1.2}],
//  "notes":[{"text":"错了 → 就改","at":4.1,"color":"noteP","mark":"x"}]}
export const CHAT = { size: 46, maxW: 560, lh: 1.35, pad: 22, gap: 34 };
export function ChatScene({ spec }) {
  const { t } = useT();
  const winAt = dflt(spec.winAt, 0.45);
  const win = spr(t, winAt, 0.5);
  const wy = spec.title ? 280 : 120;
  let my = 36;
  const msgs = (spec.messages || []).map((m) => {
    const lines = wrap(m.text, CHAT.maxW, CHAT.size);
    const h = lines.length * CHAT.size * CHAT.lh + CHAT.pad * 2;
    const o = { ...m, lines, y: my, h };
    my += h + CHAT.gap;
    return o;
  });
  const winH = Math.max(360, my + 30 + 46);
  let ny = wy + winH + 70;
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      {win > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, opacity: Math.min(1, win * 1.6), transform: `translateY(${(1 - win) * 40}px)` }}>
          <ChatWin x={110} y={wy} w={860} h={winH} title={spec.window || "聊天窗口"}>
            {msgs.map((m, i) => {
              const p = spr(t, m.at, 0.4);
              if (p <= 0) return null;
              const me = m.who === "me";
              let lines = m.lines;
              if (m.typing) {
                const total = [...m.text].length;
                let k = Math.floor(total * ramp(t, m.at, m.at + dflt(m.typeDur, Math.min(2.5, total * 0.09)), (v) => v));
                lines = m.lines.map((l) => { const s = [...l].slice(0, Math.max(0, k)).join(""); k -= [...l].length; return s; });
              }
              const bw = Math.max(...m.lines.map((l) => rawW(l, CHAT.size))) + CHAT.pad * 2 + 8;
              return (
                <div key={i} style={{ position: "absolute", top: m.y, [me ? "right" : "left"]: 30, width: bw, opacity: Math.min(1, p * 1.8), transform: `scale(${0.7 + 0.3 * p})`, transformOrigin: me ? "100% 0%" : "0% 0%" }}>
                  <div style={{ background: me ? C.noteB : C.white, border: `3px solid ${C.ink}`, borderRadius: 26, padding: `${CHAT.pad}px`, fontFamily: BODY, fontWeight: 700, fontSize: CHAT.size, color: C.ink, lineHeight: CHAT.lh, whiteSpace: "nowrap", minHeight: CHAT.size * CHAT.lh }}>
                    {lines.map((l, k) => <div key={k}>{l || " "}</div>)}
                  </div>
                </div>
              );
            })}
          </ChatWin>
        </div>
      ) : null}
      {(spec.notes || []).map((o, i) => {
        const y = ny + i * 130;
        const cw = textW(o.text, 46) + 62;
        return (
          <React.Fragment key={i}>
            <Chip t={t} at={o.at} x={120} y={y} size={46} color={col(o.color, C.white)}>{o.text}</Chip>
            {o.mark ? <Mark t={t} kind={o.mark} at={dflt(o.markAt, o.at + 0.2)} x={Math.min(120 + cw + 30, 900)} y={y + 4} /> : null}
          </React.Fragment>
        );
      })}
    </Paper>
  );
}

// ---------- 5 顶部卡片（版式 A 叠层）：人物全屏，顶部一张纸卡 ----------
// {"scene":"topcard","at":0.1,"phases":[
//   {"label":"关键就在这儿 ↓","big":{"text":"人","at":1.6},"notes":[{"text":"有情绪","at":2.35}]},
//   {"start":5.25,"label":"写出爆款脚本的关键","big":{"text":"去AI味","at":5.5,"strikeAt":6.1},"to":{"text":"+ 人味","at":7.0},
//    "hand":{"text":"……","at":7.5,"end":8.3}}]}
// 单阶段时可以把 label/big/hand/notes/to 直接写在顶层。big 可带 "hl":"要划出来的字","hlAt":秒。
export const CARD = { x: 70, y: 96, w: 940, pad: 44, minH: 240, maxH: 420 };
export function layoutPhase(ph) {
  const inner = CARD.w - CARD.pad * 2;
  const L = { els: [] };
  let y = 30;
  if (ph.label) { L.label = { y }; y += 70; }
  const notes = ph.notes || [];
  const nf = notes.map((n) => fit(n.text, 300, 64, 40, 1));
  const nW = notes.map((n, i) => Math.min(420, Math.max(200, textW(n.text, nf[i].size) + 80)));
  const right = ph.to ? 440 + 90 : (ph.big && notes.length ? nW.reduce((a, b) => a + b + 30, 0) : 0);
  let rowH = 0;
  if (ph.big) {
    const f = fit(ph.big.text, inner - right, 112, 64, right ? 1 : 2);
    L.big = { y, f };
    rowH = f.lines.length * f.size * 1.12;
  }
  if (ph.to) {
    const tf = fit(ph.to.text, 360, 96, 48, 1);
    L.to = { x: CARD.pad + inner - 420, y: y - 20, f: tf, w: 420, h: Math.round(tf.size * 1.55) };
    L.arrow = { x: CARD.pad + inner - 420 - 90, y: y + 6 };
    rowH = Math.max(rowH, L.to.h - 20);
  }
  if (notes.length) {
    let x = ph.big ? CARD.pad + inner - nW.reduce((a, b) => a + b + 30, -30) : CARD.pad;
    const ny = ph.big ? y - 6 : y;
    L.notes = notes.map((n, i) => { const o = { x, y: ny, w: nW[i], h: 130, f: nf[i] }; x += nW[i] + 30; return o; });
    rowH = Math.max(rowH, 124);
  }
  y += rowH + (rowH ? 16 : 0);
  if (ph.hand) {
    const hf = fit(ph.hand.text, inner, 80, 48, 2);
    L.hand = { y, f: hf };
    y += hf.lines.length * hf.size * 1.15 + 6;
  }
  L.h = y + 34;
  return L;
}
export function TopCard({ spec }) {
  const { t, dur } = useT();
  const at = dflt(spec.at, 0.1);
  const p = spr(t, at, 0.5);
  const out = 1 - ramp(t, dur - 0.25, dur);
  const phases = spec.phases || [spec];
  const lays = phases.map(layoutPhase);
  const H = Math.min(CARD.maxH, Math.max(CARD.minH, ...lays.map((l) => l.h)));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, opacity: out }}>
      <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, height: H, opacity: Math.min(1, p * 1.8), transform: `scale(${0.82 + 0.18 * p}) rotate(${dflt(spec.rot, -1.2)}deg)` }}>
        <div style={{ position: "absolute", inset: 0, background: C.paper, borderRadius: 12, boxShadow: "0 14px 30px rgba(0,0,0,0.28)" }} />
        {phases.map((ph, i) => {
          const L = lays[i];
          const s = i === 0 ? -1 : ph.start;
          const next = i < phases.length - 1 ? phases[i + 1].start : null;
          const op = (i === 0 ? 1 : ramp(t, s + 0.2, s + 0.55)) * (next == null ? 1 : 1 - ramp(t, next, next + 0.3));
          if (op <= 0) return null;
          const big = ph.big;
          const struck = big && big.strikeAt != null && t >= big.strikeAt + 0.1;
          return (
            <div key={i} style={{ position: "absolute", inset: 0, opacity: op }}>
              {ph.label ? <div style={{ position: "absolute", left: CARD.pad, top: L.label.y, fontFamily: BODY, fontWeight: 700, fontSize: 40, color: C.muted, whiteSpace: "nowrap", opacity: ramp(t, dflt(ph.labelAt, i === 0 ? at : s + 0.2), dflt(ph.labelAt, i === 0 ? at : s + 0.2) + 0.3) }}>{ph.label}</div> : null}
              {big ? (
                <div style={{ position: "absolute", left: CARD.pad, top: L.big.y, opacity: ramp(t, big.at, big.at + 0.3) }}>
                  {big.hl && big.text.indexOf(big.hl) >= 0 ? (
                    <Highlight t={t} a={dflt(big.hlAt, big.at + 0.4)} b={dflt(big.hlAt, big.at + 0.4) + 0.6} x={rawW(big.text.slice(0, big.text.indexOf(big.hl)), L.big.f.size) - 8} y={L.big.f.size * 0.6} w={rawW(big.hl, L.big.f.size) + 16} h={L.big.f.size * 0.45} />
                  ) : null}
                  <div style={{ position: "relative" }}><FitText f={L.big.f} font={MARK} color={struck ? C.muted : C.ink} lh={1.12} /></div>
                </div>
              ) : null}
              {big && big.strikeAt != null ? <Strike t={t} a={big.strikeAt} b={big.strikeAt + 0.4} x={CARD.pad - 4} y={L.big.y + L.big.f.size * 0.6} w={rawW(L.big.f.lines[0], L.big.f.size) + 16} width={10} rot={-6} /> : null}
              {ph.to ? (
                <>
                  <div style={{ position: "absolute", left: L.arrow.x, top: L.arrow.y, fontFamily: MARK, fontSize: 80, color: C.red, opacity: ramp(t, ph.to.at - 0.25, ph.to.at - 0.05) }}>→</div>
                  {t >= ph.to.at ? <Note t={t} at={ph.to.at} x={L.to.x} y={L.to.y} w={L.to.w} h={L.to.h} color={col(ph.to.color, C.noteY)} seed={ph.to.text} fontSize={L.to.f.size}>{ph.to.text}</Note> : null}
                </>
              ) : null}
              {(ph.notes || []).map((n, k) => (t >= n.at ? <Note key={k} t={t} at={n.at} x={L.notes[k].x} y={L.notes[k].y} w={L.notes[k].w} h={L.notes[k].h} color={col(n.color, C[CYCLE[k % 4]])} seed={n.text} fontSize={L.notes[k].f.size}>{n.text}</Note> : null))}
              {ph.hand ? <HandLines t={t} a={ph.hand.at} b={ph.hand.end} x={CARD.pad + 6} y={L.hand.y} f={L.hand.f} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- 1b 清单的便签墙样式：{"scene":"list","style":"notes",...}，两列便签，最多 6 张 ----------
export const NOTES = { colW: 400, gapX: 60, left: 110, maxRowH: 300, size: 56, minSize: 34 };
function ListNotes({ spec }) {
  const { t } = useT();
  const items = spec.items || [];
  const rows = Math.max(1, Math.ceil(items.length / 2));
  const top = spec.title ? 320 : 170;
  const rowH = Math.min(NOTES.maxRowH, (1190 - top) / rows);
  const nh = rowH - 50;
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      {items.map((o, i) => {
        if (t < o.at) return null;
        const f = fit(o.text, NOTES.colW - 60, Math.min(NOTES.size, nh * 0.36), NOTES.minSize, 2);
        const x = NOTES.left + (i % 2) * (NOTES.colW + NOTES.gapX) + jit("lnx" + i, 14);
        const y = top + Math.floor(i / 2) * rowH + jit("lny" + i, 8);
        return (
          <React.Fragment key={i}>
            <Note t={t} at={o.at} x={x} y={y} w={NOTES.colW} h={nh} color={col(o.color, C[CYCLE[i % 4]])} seed={"ln" + i + o.text} fontSize={f.size} out={o.out == null ? null : o.out}>
              <div style={{ textAlign: "center", lineHeight: 1.15 }}>{f.lines.map((l, k) => <div key={k}>{l}</div>)}</div>
            </Note>
            {o.mark && (o.out == null || t < o.out) ? <Mark t={t} kind={o.mark} at={dflt(o.markAt, o.at + 0.4)} x={x + NOTES.colW - 70} y={y + nh - 70} box={{ x: x - 16, y: y - 22, w: NOTES.colW + 32, h: nh + 44 }} /> : null}
          </React.Fragment>
        );
      })}
    </Paper>
  );
}

// ---------- 6 对比：两栏「以前/现在」「A/B」，可判输赢 ----------
// {"scene":"compare","title":"手动剪 vs AI 剪","hl":"vs","left":{"label":"手动剪","at":0.4,"items":[{"text":"3 小时","at":0.8}],"mark":"x","markAt":2.0},
//  "right":{"label":"AI 剪","at":2.4,"items":[{"text":"10 分钟","at":2.8}],"mark":"tick"},"vs":true,"verdict":{"side":"right","at":4.2,"text":"差了 18 倍"}}
export const CMP = { colW: 430, gap: 40, left: 90, headH: 130, itemW: 370, size: 58, minSize: 34, bottom: 1190 };
export function compareLayout(spec) {
  const top = spec.title ? 300 : 170;
  const cols = [spec.left || {}, spec.right || {}].map((c) => {
    let h = CMP.headH + 20;
    const items = (c.items || []).map((o) => {
      const f = fit(o.text, CMP.itemW, CMP.size, CMP.minSize, 2);
      const ih = f.lines.length * f.size * 1.22 + 34;
      const r = { ...o, f, y: h, h: ih };
      h += ih;
      return r;
    });
    return { ...c, items, h: h + 26, lf: fit(c.label || "", CMP.colW - 60, 64, 40, 1) };
  });
  const colH = Math.max(...cols.map((c) => c.h), 360);
  const vf = spec.verdict && spec.verdict.text ? fit(spec.verdict.text, 760, 84, 48, 1) : null;
  const blockH = colH + (vf ? 50 + vf.size * 1.7 : 0);
  const top2 = top + Math.max(0, (CMP.bottom - top - blockH) * 0.4);
  return { top: Math.round(top2), cols, colH, vf };
}
export function CompareScene({ spec }) {
  const { t } = useT();
  const L = compareLayout(spec);
  const v = spec.verdict;
  const decided = v && t >= v.at;
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      {L.cols.map((c, i) => {
        const at = dflt(c.at, 0.4 + i * 0.8);
        const p = spr(t, at, 0.5);
        if (p <= 0) return null;
        const x = CMP.left + i * (CMP.colW + CMP.gap);
        const e = enter(p, "cmp" + i);
        const lose = decided && v.side && v.side !== (i ? "right" : "left");
        const head = col(c.color, i ? C.noteG : C.noteP);
        return (
          <div key={i} style={{ position: "absolute", left: x, top: L.top, width: CMP.colW, height: L.colH, opacity: e.opacity * (lose ? lerp(1, 0.5, ramp(t, v.at, v.at + 0.4)) : 1), transform: `${e.transform} rotate(${jit("cmpr" + i, 1.2)}deg)` }}>
            <div style={{ position: "absolute", inset: 0, background: C.white, border: `3px solid ${C.ink}`, borderRadius: 16, boxShadow: "0 10px 20px rgba(60,50,30,0.14)" }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: CMP.colW, height: CMP.headH, background: head, borderBottom: `3px solid ${C.ink}`, borderRadius: "14px 14px 0 0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MARK, fontSize: c.lf.size, color: C.ink, whiteSpace: "nowrap" }}>{c.label}</div>
            {c.items.map((o, k) => {
              const q = ramp(t, o.at, o.at + 0.35);
              return (
                <div key={k} style={{ position: "absolute", left: 30, top: o.y, opacity: q, transform: `translateY(${(1 - q) * 16}px)` }}>
                  <FitText f={o.f} font={BODY} weight={700} lh={1.22} />
                </div>
              );
            })}
            {c.mark === "tick" ? <Tick t={t} a={dflt(c.markAt, at + 0.6)} x={CMP.colW - 96} y={18} size={70} /> : null}
            {c.mark === "x" ? <XMark t={t} a={dflt(c.markAt, at + 0.6)} x={CMP.colW - 86} y={28} size={58} /> : null}
          </div>
        );
      })}
      {spec.vs !== false && L.cols[1].items ? (
        <Stamp t={t} at={dflt(spec.vsAt, dflt((spec.right || {}).at, 1.2) + 0.15)} x={540} y={L.top + CMP.headH + (L.colH - CMP.headH) / 2} r={46} size={40} color={C.ink}>VS</Stamp>
      ) : null}
      {decided && v.side ? (
        <DrawCircle t={t} a={v.at} b={v.at + 0.5} x={CMP.left + (v.side === "right" ? CMP.colW + CMP.gap : 0) + 20} y={L.top + 10} w={CMP.colW - 40} h={CMP.headH - 20} seed={"cmpv"} />
      ) : null}
      {L.vf && decided ? (
        <Note t={t} at={dflt(v.textAt, v.at + 0.4)} x={140} y={Math.min(L.top + L.colH + 50, 1190 - L.vf.size * 1.7)} w={800} h={Math.round(L.vf.size * 1.7)} color={col(v.color, C.noteY)} seed={"verdict" + v.text} fontSize={L.vf.size}>{v.text}</Note>
      ) : null}
    </Paper>
  );
}

// ---------- 7 数字大字：数字滚动到目标值，手绘圈出，可带横条对比 ----------
// {"scene":"number","title":"省下来的时间","value":"90","suffix":"%","from":0,"at":0.4,"countDur":1.0,"label":"剪辑时间减少","circleAt":1.8,
//  "bars":[{"label":"手动","value":180,"at":2.4},{"label":"AI","value":18,"at":2.8}],"note":{"text":"一杯咖啡的时间","at":3.6}}
export function numberText(spec, p) {
  const v = String(spec.value);
  const m = v.match(/^-?\d+(\.\d+)?$/);
  if (!m || p >= 1) return v;
  const dec = (v.split(".")[1] || "").length;
  const from = Number(dflt(spec.from, 0));
  return (from + (Number(v) - from) * p).toFixed(dec);
}
export function numberLayout(spec) {
  const top = spec.title ? 300 : 200;
  const full = (spec.prefix || "") + spec.value;
  const size = fit(full, 640, 300, 120, 1).size;
  const suf = spec.suffix ? Math.round(size * 0.42) : 0;
  const lf = spec.label ? fit(spec.label, 860, 64, 40, 1) : null;
  const nf = spec.note ? fit(spec.note.text, 700, 84, 46, 1) : null;
  const h = size * 1.05 + (lf ? lf.size * 1.4 + 40 : 0) + ((spec.bars || []).length ? spec.bars.length * 110 + 30 : 0) + (nf ? nf.size * 1.7 + 40 : 0) + (spec.hand ? 120 : 0);
  const top2 = top + Math.max(0, (1190 - top - h) * 0.4);
  return { top: Math.round(top2), size, suf, w: textW(full, size) + (spec.suffix ? textW(spec.suffix, suf) + 10 : 0), lf };
}
export function NumberScene({ spec }) {
  const { t } = useT();
  const at = dflt(spec.at, 0.4);
  const L = numberLayout(spec);
  const p = ramp(t, at, at + dflt(spec.countDur, 0.9), EINOUT);
  const e = enter(spr(t, at, 0.45), "num");
  const x0 = Math.max(110, 540 - L.w / 2);
  let y = L.top + L.size * 1.05;
  const els = [];
  if (L.lf) {
    const la = dflt(spec.labelAt, at + 0.5);
    els.push(<div key="l" style={{ position: "absolute", left: 0, width: 1080, top: y, textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: L.lf.size, color: C.ink, opacity: ramp(t, la, la + 0.3) }}>{spec.label}</div>);
    y += L.lf.size * 1.4 + 40;
  }
  const bars = spec.bars || [];
  if (bars.length) {
    const mx = Math.max(...bars.map((b) => Math.abs(Number(b.value)) || 0), 1);
    bars.forEach((b, i) => {
      const q = ramp(t, b.at, b.at + 0.6, EINOUT);
      const bw = 520 * (Math.abs(Number(b.value)) / mx) * q;
      const by = y + i * 110;
      els.push(
        <div key={"b" + i} style={{ position: "absolute", left: 120, top: by, opacity: Math.min(1, q * 3) }}>
          <div style={{ position: "absolute", left: 0, top: 6, width: 180, fontFamily: BODY, fontWeight: 700, fontSize: 40, color: C.ink, whiteSpace: "nowrap" }}>{b.label}</div>
          <div style={{ position: "absolute", left: 200, top: 0, width: Math.max(bw, 6), height: 64, background: col(b.color, C[CYCLE[i % 4]]), border: `3px solid ${C.ink}`, borderRadius: 10, transform: `rotate(${jit("bar" + i, 0.6)}deg)` }} />
          <div style={{ position: "absolute", left: 220 + bw, top: 6, fontFamily: MARK, fontSize: 44, color: C.ink, whiteSpace: "nowrap", opacity: ramp(t, b.at + 0.5, b.at + 0.7) }}>{b.value}{b.unit || ""}</div>
        </div>
      );
    });
    y += bars.length * 110 + 30;
  }
  if (spec.note && t >= spec.note.at) {
    const nf = fit(spec.note.text, 700, 84, 46, 1);
    els.push(<Note key="n" t={t} at={spec.note.at} x={540 - 400} y={Math.min(y, 1190 - nf.size * 1.7)} w={800} h={Math.round(nf.size * 1.7)} color={col(spec.note.color, C.noteY)} seed={"numnote"} fontSize={nf.size}>{spec.note.text}</Note>);
    y += nf.size * 1.7 + 40;
  }
  if (spec.hand) {
    const hf = fit(spec.hand.text, 860, 80, 48, 2);
    els.push(<HandLines key="h" t={t} a={spec.hand.at} b={spec.hand.end} x={130} y={Math.min(y, 1190 - hf.lines.length * hf.size * 1.15)} f={hf} />);
  }
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      <div style={{ position: "absolute", left: x0, top: L.top, opacity: e.opacity, transform: e.transform, whiteSpace: "nowrap", fontFamily: MARK, color: C.red, lineHeight: 1 }}>
        <span style={{ fontSize: L.size }}>{(spec.prefix || "") + numberText(spec, p)}</span>
        {spec.suffix ? <span style={{ fontSize: L.suf, marginLeft: 10, color: C.ink }}>{spec.suffix}</span> : null}
      </div>
      {spec.circleAt != null ? <DrawCircle t={t} a={spec.circleAt} x={x0 - 10} y={L.top - 10} w={textW((spec.prefix || "") + spec.value, L.size) + 20} h={L.size * 1.0 + 20} seed="num" color={C.ink} width={6} /> : null}
      {els}
    </Paper>
  );
}

// ---------- 8 截图展示：把用户的截图贴上白板，圈重点、推近局部 ----------
// image 是 push_asset 返回的图片 assetId；ratio = 图宽/图高；marks 和 zoom 的 x/y/w/h 都是图内比例（0–1）
// {"scene":"shot","title":"后台数据","image":"<assetId>","ratio":0.46,"at":0.3,
//  "marks":[{"kind":"circle","x":0.1,"y":0.42,"w":0.5,"h":0.08,"at":1.6},{"kind":"arrow","x":0.62,"y":0.46,"at":2.2,"text":"涨了"}],
//  "zoom":{"x":0.05,"y":0.38,"w":0.9,"h":0.2,"at":3.0},"caption":{"text":"一周涨了 3 倍","at":4.0}}
export function shotLayout(spec) {
  const top = spec.title ? 290 : 150;
  const capH = spec.caption ? 150 : 0;
  const boxW = 820, boxH = 1180 - top - capH;
  const r = Number(spec.ratio) > 0 ? Number(spec.ratio) : 0.75;
  let iw = boxW, ih = iw / r;
  if (ih > boxH) { ih = boxH; iw = ih * r; }
  return { top, iw: Math.round(iw), ih: Math.round(ih), x: Math.round(540 - iw / 2), capY: top + ih + 50 };
}
function ShotMark({ t, m, iw, ih }) {
  const x = m.x * iw, y = m.y * ih, w = (m.w || 0.2) * iw, h = (m.h || 0.08) * ih;
  if (m.kind === "box") {
    const p = ramp(t, m.at, m.at + 0.4, EINOUT);
    if (p <= 0) return null;
    return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, border: `6px solid ${C.red}`, borderRadius: 10, clipPath: `inset(0 ${100 - p * 100}% 0 0)` }} />;
  }
  if (m.kind === "hl") return <Highlight t={t} a={m.at} b={m.at + 0.5} x={x} y={y} w={w} h={h} />;
  if (m.kind === "arrow") {
    const tx = m.text ? <div style={{ position: "absolute", left: x + 110, top: y - 120, fontFamily: HAND, fontSize: 60, color: C.red, whiteSpace: "nowrap", opacity: ramp(t, m.at + 0.35, m.at + 0.6) }}>{m.text}</div> : null;
    return (
      <>
        <svg width={iw} height={ih} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <ArrowPath t={t} a={m.at} x1={x + 120} y1={y - 90} x2={x + 8} y2={y - 6} />
        </svg>
        {tx}
      </>
    );
  }
  return <DrawCircle t={t} a={m.at} x={x} y={y} w={w} h={h} seed={"shot" + m.at} />;
}
function ArrowPath({ t, a, x1, y1, x2, y2 }) {
  const p = ramp(t, a, a + 0.4, EINOUT);
  if (p <= 0) return null;
  const mx = (x1 + x2) / 2 + 40, my = (y1 + y2) / 2 - 30, len = Math.hypot(x2 - x1, y2 - y1) * 1.3;
  const ang = Math.atan2(y2 - my, x2 - mx);
  return (
    <g>
      <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`} fill="none" stroke={C.red} strokeWidth="7" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />
      {p > 0.95 ? <path d={`M ${x2 - 28 * Math.cos(ang - 0.5)} ${y2 - 28 * Math.sin(ang - 0.5)} L ${x2} ${y2} L ${x2 - 28 * Math.cos(ang + 0.5)} ${y2 - 28 * Math.sin(ang + 0.5)}`} fill="none" stroke={C.red} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </g>
  );
}
export function ShotScene({ spec }) {
  const { t } = useT();
  const at = dflt(spec.at, 0.3);
  const L = shotLayout(spec);
  const p = spr(t, at, 0.5);
  const e = enter(p, "shot");
  const z = spec.zoom;
  let zs = 1, zx = 0, zy = 0;
  if (z) {
    const q = ramp(t, z.at, z.at + dflt(z.dur, 0.6), EINOUT) * (z.out == null ? 1 : 1 - ramp(t, z.out, z.out + 0.5, EINOUT));
    const s = Math.max(1, Math.min(3, 0.92 / Math.max(z.w, z.h)));
    const cx = (z.x + z.w / 2) * L.iw, cy = (z.y + z.h / 2) * L.ih;
    const tx = Math.max(L.iw - L.iw * s, Math.min(0, L.iw / 2 - cx * s));
    const ty = Math.max(L.ih - L.ih * s, Math.min(0, L.ih / 2 - cy * s));
    zs = lerp(1, s, q);
    zx = lerp(0, tx, q);
    zy = lerp(0, ty, q);
  }
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      {p > 0 ? (
        <div style={{ position: "absolute", left: L.x - 16, top: L.top - 16, width: L.iw + 32, height: L.ih + 32, opacity: e.opacity, transform: `${e.transform} rotate(${dflt(spec.rot, jit("shotrot", 1.5))}deg)` }}>
          <div style={{ position: "absolute", inset: 0, background: C.white, borderRadius: 6, boxShadow: "0 14px 28px rgba(60,50,30,0.22)" }} />
          <div style={{ position: "absolute", left: 16, top: 16, width: L.iw, height: L.ih, overflow: "hidden", background: "#E9E6DF" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: L.iw, height: L.ih, transformOrigin: "0 0", transform: `translate(${zx}px, ${zy}px) scale(${zs})` }}>
              {spec.image ? (
                <Img src={spec.image} style={{ width: L.iw, height: L.ih, objectFit: "cover" }} />
              ) : (
                <div style={{ width: L.iw, height: L.ih, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: BODY, fontSize: 40, color: C.muted }}>缺截图：SPEC 里填 image（图片 assetId）</div>
              )}
              {(spec.marks || []).map((m, i) => <ShotMark key={i} t={t} m={m} iw={L.iw} ih={L.ih} />)}
            </div>
          </div>
          <Tape x={(L.iw + 32) / 2 + jit("shottape", 60)} y={2} w={170} rot={jit("shottaper", 6)} />
        </div>
      ) : null}
      {spec.caption ? <CaptionHand t={t} c={spec.caption} y={L.capY} /> : null}
    </Paper>
  );
}
function CaptionHand({ t, c, y }) {
  const f = fit(c.text, 840, 76, 46, 1);
  const a = c.at, b = dflt(c.end, c.at + Math.min(1.2, [...c.text].length * 0.08));
  return <Hand t={t} a={a} b={b} x={Math.max(120, 540 - textW(c.text, f.size) / 2)} y={Math.min(y, 1190 - f.size)} size={f.size} rot={-2}>{c.text}</Hand>;
}

// ---------- 9 金句整屏：一句话逐字写出，划重点、波浪线、署名 ----------
// {"scene":"quote","text":"不是 AI 不行，是你只会去 AI 味","at":0.3,"hl":"只会去 AI 味","hlAt":2.2,"wavyAt":2.8,"by":"—— 写给每个做内容的人","byAt":3.4,"card":true}
export function quoteLayout(spec) {
  const f = fit(spec.text, 800, 120, 64, 2);
  const lh = f.size * 1.3;
  const h = f.lines.length * lh;
  const y = Math.round(640 - h / 2);
  return { f, lh, h, y };
}
export function QuoteScene({ spec }) {
  const { t } = useT();
  const at = dflt(spec.at, 0.3);
  const L = quoteLayout(spec);
  const total = [...spec.text].length;
  const wd = dflt(spec.writeDur, Math.min(1.6, total * 0.07));
  const shown = Math.floor(total * ramp(t, at, at + wd, (v) => v));
  let acc = 0;
  const cardP = spr(t, Math.max(0, at - 0.2), 0.5);
  const ce = enter(cardP, "quotecard");
  return (
    <Paper t={t}>
      {spec.card !== false ? (
        <div style={{ position: "absolute", left: 90, top: L.y - 150, width: 900, height: L.h + 300, opacity: ce.opacity, transform: `${ce.transform} rotate(${jit("qcard", 1.6)}deg)`, background: col(spec.color, C.noteY), borderRadius: 6, boxShadow: "0 16px 30px rgba(60,50,30,0.18)" }}>
          <Tape x={450} y={0} w={160} rot={jit("qtape", 5)} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 120, top: L.y - 150, fontFamily: MARK, fontSize: 200, color: C.red, opacity: 0.85 * ramp(t, at - 0.1, at + 0.2), lineHeight: 1 }}>“</div>
      {L.f.lines.map((line, i) => {
        const chars = [...line];
        const vis = Math.max(0, Math.min(chars.length, shown - acc));
        const hlIdx = spec.hl ? line.indexOf(spec.hl) : -1;
        acc += chars.length;
        const lw = textW(line, L.f.size);
        const lx = 540 - lw / 2;
        return (
          <div key={i} style={{ position: "absolute", left: lx, top: L.y + i * L.lh }}>
            {hlIdx >= 0 ? <Highlight t={t} a={dflt(spec.hlAt, at + wd + 0.3)} b={dflt(spec.hlAt, at + wd + 0.3) + 0.6} x={rawW(line.slice(0, hlIdx), L.f.size) - 8} y={L.f.size * 0.55} w={rawW(spec.hl, L.f.size) + 16} h={L.f.size * 0.5} color={spec.card !== false ? C.noteP : C.hl} /> : null}
            <div style={{ position: "relative", fontFamily: MARK, fontSize: L.f.size, color: C.ink, whiteSpace: "nowrap" }}>
              <span>{chars.slice(0, vis).join("")}</span>
              <span style={{ opacity: 0 }}>{chars.slice(vis).join("")}</span>
            </div>
            {spec.wavyAt != null && i === L.f.lines.length - 1 ? <Wavy t={t} a={spec.wavyAt} x={0} y={L.f.size * 1.08} w={lw} /> : null}
          </div>
        );
      })}
      {spec.by ? <Hand t={t} a={dflt(spec.byAt, at + wd + 0.6)} b={dflt(spec.byAt, at + wd + 0.6) + 0.8} x={Math.max(140, 900 - textW(spec.by, 52))} y={L.y + L.h + 50} size={52} color={C.ink}>{spec.by}</Hand> : null}
    </Paper>
  );
}

// ---------- 10 思维导图：中心词长出分支 ----------
// {"scene":"mindmap","center":{"text":"爆款脚本","at":0.3},"nodes":[{"text":"有情绪","at":1.0},{"text":"有信息","at":1.6},{"text":"有反差","at":2.2}],"hand":{"text":"三样缺一不可","at":3.0,"end":3.8}}
// 内容区到 y=1190（下面是字幕 1200–1290 和人物圆圈）；整张图比旧版上移 30，第 6 个分支放到 1095
export const MIND = { cx: 540, cy: 650, slots: [[260, 310], [820, 310], [230, 990], [850, 990], [540, 220], [540, 1095]], nodeW: 340, size: 52, minSize: 32 };
export function mindLayout(spec) {
  const nodes = (spec.nodes || []).map((n, i) => {
    const f = fit(n.text, MIND.nodeW - 60, MIND.size, MIND.minSize, 2);
    const w = Math.min(MIND.nodeW, Math.max(...f.lines.map((l) => textW(l, f.size))) + 70);
    const h = f.lines.length * f.size * 1.2 + 50;
    const [sx, sy] = MIND.slots[i] || MIND.slots[MIND.slots.length - 1];
    return { ...n, f, w, h, x: Math.max(60, Math.min(1020 - w, sx - w / 2)), y: sy - h / 2, sx, sy };
  });
  const c = spec.center || { text: "", at: 0.3 };
  const cf = fit(c.text, 380, 84, 48, 2);
  return { nodes, cf, cw: Math.max(...cf.lines.map((l) => textW(l, cf.size))) + 120, ch: cf.lines.length * cf.size * 1.2 + 90 };
}
export function MindmapScene({ spec }) {
  const { t } = useT();
  const L = mindLayout(spec);
  const c = spec.center || { text: "", at: 0.3 };
  const cp = spr(t, c.at, 0.5);
  const ce = enter(cp, "mindc");
  return (
    <Paper t={t}>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {L.nodes.map((n, i) => {
          const a = n.at - 0.25;
          const p = ramp(t, a, a + 0.35, EINOUT);
          if (p <= 0) return null;
          const mx = (MIND.cx + n.sx) / 2 + jit("mb" + i, 50), my = (MIND.cy + n.sy) / 2 + jit("mbb" + i, 40);
          const len = Math.hypot(n.sx - MIND.cx, n.sy - MIND.cy) * 1.2;
          return <path key={i} d={`M ${MIND.cx} ${MIND.cy} Q ${mx} ${my} ${n.sx} ${n.sy}`} fill="none" stroke={C.ink} strokeWidth="6" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />;
        })}
      </svg>
      {cp > 0 ? (
        <div style={{ position: "absolute", left: MIND.cx - L.cw / 2, top: MIND.cy - L.ch / 2, width: L.cw, height: L.ch, opacity: ce.opacity, transform: ce.transform, borderRadius: L.ch / 2, background: C.red, color: C.white, border: `4px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 20px rgba(60,50,30,0.2)" }}>
          <FitText f={L.cf} font={MARK} color={C.white} style={{ textAlign: "center" }} />
        </div>
      ) : null}
      {L.nodes.map((n, i) => (t >= n.at ? (
        <Note key={i} t={t} at={n.at} x={n.x} y={n.y} w={n.w} h={n.h} color={col(n.color, C[CYCLE[i % 4]])} seed={"mind" + i + n.text} fontSize={n.f.size} tape={false}>
          <div style={{ textAlign: "center", lineHeight: 1.2 }}>{n.f.lines.map((l, k) => <div key={k}>{l}</div>)}</div>
        </Note>
      ) : null))}
      {spec.hand ? <HandLines t={t} a={spec.hand.at} b={spec.hand.end} x={120} y={1110} f={fit(spec.hand.text, 440, 64, 40, 1)} /> : null}
    </Paper>
  );
}

// ---------- 11 评论区问答：网友评论卡片 + 作者回复 ----------
// {"scene":"comment","title":"评论区问得最多的","hl":"最多","comments":[{"user":"小鱼","text":"国产模型能做到吗？","at":0.6,"likes":"2.1w"}],"reply":{"text":"能做，但效果差一截","at":2.4}}
export const CMT = { x: 100, w: 880, size: 44, textW: 700, lh: 1.35 };
export function commentLayout(spec) {
  let y = spec.title ? 300 : 170;
  const cards = (spec.comments || []).map((c) => {
    const lines = wrap(c.text, CMT.textW, CMT.size);
    const h = 100 + lines.length * CMT.size * CMT.lh + 30;
    const o = { ...c, lines, y, h };
    y += h + 30;
    return o;
  });
  let reply = null;
  if (spec.reply) {
    const lines = wrap(spec.reply.text, CMT.textW - 60, CMT.size);
    reply = { ...spec.reply, lines, y: y + 10, h: 90 + lines.length * CMT.size * CMT.lh + 26 };
    y = reply.y + reply.h + 30;
  }
  return { cards, reply, bottom: y };
}
export function CommentScene({ spec }) {
  const { t } = useT();
  const L = commentLayout(spec);
  const AV = [C.noteB, C.noteG, C.noteP, C.noteY];
  return (
    <Paper t={t}>
      <SceneTitle t={t} spec={spec} />
      {L.cards.map((c, i) => {
        const p = spr(t, c.at, 0.45);
        if (p <= 0) return null;
        const e = enter(p, "cmt" + i);
        return (
          <div key={i} style={{ position: "absolute", left: CMT.x, top: c.y, width: CMT.w, height: c.h, opacity: e.opacity, transform: `${e.transform} rotate(${jit("cmtr" + i, 0.8)}deg)`, background: C.white, border: `3px solid ${C.ink}`, borderRadius: 18, boxShadow: "0 8px 16px rgba(60,50,30,0.12)" }}>
            <div style={{ position: "absolute", left: 28, top: 24, width: 64, height: 64, borderRadius: 32, background: AV[i % 4], border: `3px solid ${C.ink}`, fontFamily: MARK, fontSize: 34, lineHeight: "58px", textAlign: "center", color: C.ink }}>{[...(c.user || "友")][0]}</div>
            <div style={{ position: "absolute", left: 112, top: 34, fontFamily: BODY, fontWeight: 700, fontSize: 32, color: C.muted, whiteSpace: "nowrap" }}>{c.user || "网友"}</div>
            {c.likes ? (
              <div style={{ position: "absolute", right: 30, top: 30, fontFamily: BODY, fontWeight: 700, fontSize: 30, color: C.muted, whiteSpace: "nowrap" }}><span style={{ color: C.red }}>♥</span> {c.likes}</div>
            ) : null}
            <div style={{ position: "absolute", left: 112, top: 90, fontFamily: BODY, fontWeight: 700, fontSize: CMT.size, lineHeight: CMT.lh, color: C.ink, whiteSpace: "nowrap" }}>
              {c.lines.map((l, k) => <div key={k}>{l}</div>)}
            </div>
          </div>
        );
      })}
      {L.reply ? (() => {
        const r = L.reply;
        const p = spr(t, r.at, 0.45);
        if (p <= 0) return null;
        const e = enter(p, "reply");
        let lines = r.lines;
        if (r.typing) {
          let k = Math.floor([...r.text].length * ramp(t, r.at, r.at + dflt(r.typeDur, Math.min(2.2, [...r.text].length * 0.08)), (v) => v));
          lines = r.lines.map((l) => { const s2 = [...l].slice(0, Math.max(0, k)).join(""); k -= [...l].length; return s2; });
        }
        return (
          <div style={{ position: "absolute", left: CMT.x + 80, top: r.y, width: CMT.w - 80, height: r.h, opacity: e.opacity, transform: e.transform, background: C.noteB, border: `3px solid ${C.ink}`, borderRadius: 18 }}>
            <div style={{ position: "absolute", left: 28, top: 22, fontFamily: BODY, fontWeight: 700, fontSize: 30, color: C.blue, whiteSpace: "nowrap" }}>{r.label || "作者回复"}</div>
            <div style={{ position: "absolute", left: 28, top: 70, fontFamily: BODY, fontWeight: 700, fontSize: CMT.size, lineHeight: CMT.lh, color: C.ink, whiteSpace: "nowrap" }}>
              {lines.map((l, k) => <div key={k}>{l || " "}</div>)}
            </div>
          </div>
        );
      })() : null}
      {spec.hand ? (() => { const hf = fit(spec.hand.text, 820, 76, 46, 2); return <HandLines t={t} a={spec.hand.at} b={spec.hand.end} x={130} y={Math.min(L.bottom + 10, 1190 - hf.lines.length * hf.size * 1.15)} f={hf} />; })() : null}
    </Paper>
  );
}

// ---------- 12 结尾互动卡：只在口播里真说了才用 ----------
// {"scene":"outro","text":"你踩过哪个坑？","at":0.3,"sub":{"text":"评论区告诉我","at":1.2},"icons":[{"kind":"question","at":0.8},{"kind":"heart","at":2.0}]}
export function outroLayout(spec) {
  const f = fit(spec.text, 840, 140, 72, 2);
  return { f, y: 360, h: f.lines.length * f.size * 1.2 };
}
export function OutroScene({ spec }) {
  const { t } = useT();
  const at = dflt(spec.at, 0.3);
  const L = outroLayout(spec);
  const p = spr(t, at, 0.5);
  const e = enter(p, "outro");
  const icons = spec.icons || [];
  const sub = spec.sub;
  const subY = L.y + L.h + 60;
  return (
    <Paper t={t}>
      <div style={{ position: "absolute", left: 0, top: L.y, width: 1080, opacity: e.opacity, transform: e.transform, textAlign: "center" }}>
        <FitText f={L.f} font={MARK} lh={1.2} style={{ textAlign: "center" }} />
      </div>
      {sub ? <Hand t={t} a={sub.at} b={dflt(sub.end, sub.at + Math.min(1.2, [...sub.text].length * 0.09))} x={Math.max(120, 540 - textW(sub.text, 72) / 2)} y={subY} size={72} rot={-2}>{sub.text}</Hand> : null}
      {sub ? <Wavy t={t} a={dflt(sub.end, sub.at + Math.min(1.2, [...sub.text].length * 0.09)) + 0.1} x={Math.max(120, 540 - textW(sub.text, 72) / 2)} y={subY + 96} w={Math.min(820, textW(sub.text, 72))} /> : null}
      {icons.map((ic, i) => {
        const n = icons.length, gap = 220;
        const x = 540 - ((n - 1) * gap) / 2 + i * gap - 60 + jit("oix" + i, 20);
        return <Doodle key={i} t={t} at={ic.at} kind={ic.kind} x={x} y={subY + 220 + jit("oiy" + i, 30)} size={120} color={i % 2 ? C.ink : C.red} fill={ic.kind === "heart" || ic.kind === "star" ? C.noteP : null} />;
      })}
    </Paper>
  );
}

// ---------- 所有场景通用的点缀：手绘小图标 doodles、印章 stamp。位置用预设名，不用自己算坐标 ----------
// "doodles":[{"kind":"bulb","at":1.2,"pos":"title"}]   "stamp":{"text":"踩坑","at":2.0,"pos":"tr"}
// pos: title 标题右边 | tr 右上 | tl 左上 | mr 右侧中间 | ml 左侧中间 | bl 左下 | mid 正中偏右（人物圆圈在右下，不提供 br）
export const EXTRA_POS = { tr: [880, 190], tl: [26, 190], mr: [962, 660], ml: [14, 660], bl: [130, 1080], mid: [600, 820] };
export const DOODLE_KINDS = ["bulb", "question", "exclaim", "star", "fire", "heart", "bolt", "check", "eyes"];
function extraPos(spec, pos, w) {
  if (pos === "title" && spec.title) {
    const f = fit(spec.title, 880, 84, 56, 1);
    return [Math.min(120 + textW(spec.title, f.size) + 24, 1060 - w), 96];
  }
  const p = EXTRA_POS[pos] || EXTRA_POS.tr;
  return [Math.min(p[0], 1060 - w), p[1]];
}
function Extras({ spec }) {
  const { t } = useT();
  const ds = spec.doodles || [];
  const st = spec.stamp;
  return (
    <>
      {ds.map((d, i) => {
        const size = d.size || 96;
        const [x, y] = d.x != null ? [d.x, d.y] : extraPos(spec, d.pos || "tr", size);
        return <Doodle key={i} t={t} at={d.at} kind={d.kind} x={x} y={y + jit("dy" + i, 10)} size={size} color={d.kind === "check" ? C.green : i % 2 ? C.ink : C.red} />;
      })}
      {st ? (() => {
        const w = textW(st.text, 56) + 70;
        const [x, y] = st.x != null ? [st.x, st.y] : extraPos(spec, st.pos || "tr", w);
        return <RectStamp t={t} at={st.at} x={st.pos === "title" ? x : x - (st.pos === "tr" || st.pos === "mr" ? w - 90 : 0)} y={y} rot={-8 + jit("stamp", 4)}>{st.text}</RectStamp>;
      })() : null}
    </>
  );
}

// 按 SPEC.scene 分派，段落文件里也可以直接用具体场景
export const SCENES = { list: ListScene, strike: StrikeScene, step: StepScene, chat: ChatScene, topcard: TopCard, compare: CompareScene, number: NumberScene, shot: ShotScene, quote: QuoteScene, mindmap: MindmapScene, comment: CommentScene, outro: OutroScene };
export function Scene({ spec }) {
  const M = SCENES[spec.scene];
  if (!M) return null;
  return spec.doodles || spec.stamp ? <><M spec={spec} /><Extras spec={spec} /></> : <M spec={spec} />;
}

