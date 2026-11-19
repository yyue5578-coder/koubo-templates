import React from "react";
import { C, MARK, HAND, BODY, useT, ramp, spr, lerp, Paper, Title, Card, Tick, EINOUT } from "./lib.jsx";

// 示例：文字、时间点都来自作者自己的一条口播视频，只用来演示写法。做你自己的片子时换成你实际说的话和时间。

// B9 · 100.7 → 108.0（7.3s）整理成一套提示词（全文）→ 不用一条条记 → 直接扔进去 → 改写一版
// local: 0–2.4 整理成提示词 | 2.4–3.8 不用一条一条记 | 3.8–5.7 直接把提示词扔进去 | 5.7–7.3 让AI给你改写一版
const FS = 31, LH = 1.5;
const B = ({ children, bg }) => (
  <span style={{ fontWeight: 900, background: bg || "transparent", borderRadius: 6, padding: bg ? "0 4px" : 0 }}>{children}</span>
);
export default function Prompt() {
  const { t } = useT();
  const card = spr(t, 0.15, 0.45);
  // paragraphs reveal one after another
  const P = (i) => ramp(t, 0.35 + i * 0.12, 0.6 + i * 0.12);
  // highlighter sweeps while the speaker says "不用一条一条记"
  const hl = (i) => ramp(t, 2.5 + i * 0.3, 2.8 + i * 0.3);
  const sweep = (i, color) => `linear-gradient(90deg, ${color} ${hl(i) * 100}%, transparent ${hl(i) * 100}%)`;
  const copied = t >= 3.95;
  const press = 1 - 0.12 * Math.max(0, 1 - Math.abs(t - 3.95) / 0.12);
  const bar = spr(t, 4.25, 0.45);
  const sent = ramp(t, 5.0, 5.25);
  const reply = spr(t, 5.95, 0.4);
  const para = { marginBottom: 8 };
  const head = { marginTop: 18, marginBottom: 4 };
  return (
    <Paper t={t}>
      <Title t={t} at={0.05} x={70} y={92} size={72} hl={[360, 216]}>整理成一套提示词</Title>
      {card > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, opacity: Math.min(1, card * 1.6), transform: `translateY(${(1 - card) * 40}px)` }}>
          <Card x={50} y={196} w={980} h={1045} rot={0}>
            <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 66, borderBottom: `3px solid ${C.ink}`, background: "#F3F1EC", borderRadius: "15px 15px 0 0" }}>
              {["#E2483D", "#F2B33D", "#3E9B57"].map((c, i) => (
                <div key={i} style={{ position: "absolute", left: 26 + i * 30, top: 22, width: 18, height: 18, borderRadius: 9, background: c }} />
              ))}
              <div style={{ position: "absolute", left: 130, top: 12, fontFamily: BODY, fontWeight: 700, fontSize: 30, color: C.ink }}>人味提示词.txt</div>
              <div style={{ position: "absolute", right: 22, top: 10, transform: `scale(${press})`, background: copied ? C.green : C.white, color: copied ? C.white : C.ink, border: `3px solid ${C.ink}`, borderRadius: 14, padding: "2px 18px", fontFamily: BODY, fontWeight: 700, fontSize: 28 }}>{copied ? "已复制 ✓" : "复制"}</div>
            </div>
            <div style={{ position: "absolute", left: 40, top: 92, width: 900, fontFamily: BODY, fontWeight: 500, fontSize: FS, lineHeight: LH, color: C.ink, textAlign: "justify" }}>
              <div style={{ ...para, opacity: P(0) }}>你是一个帮我把稿子改回人话的编辑。<br />下面这段是我要发的口播稿。</div>
              <div style={{ ...head, opacity: P(1) }}><B>请你只做三件事：</B></div>
              <div style={{ ...para, opacity: P(2) }}><span style={{ fontWeight: 900, backgroundImage: sweep(0, C.noteY), borderRadius: 6 }}>一、加废话。</span>在每两到三段之间，插一句没有信息量、但人说话时会带的口头过渡，比如“说白了”“你懂我意思吧”“反正吧”。一段里最多一句，不要堆。</div>
              <div style={{ ...para, opacity: P(3) }}><span style={{ fontWeight: 900, backgroundImage: sweep(1, C.noteB), borderRadius: 6 }}>二、打乱句长。</span>把我原来长度接近的句子改掉：挑两句砍到六个字以内，再把一句拉长到四十个字以上。改完我要能在念的时候有喘气的地方。</div>
              <div style={{ ...para, opacity: P(4) }}><span style={{ fontWeight: 900, backgroundImage: sweep(2, C.noteP), borderRadius: 6 }}>三、加偏向。</span>把我写得四平八稳、谁也不得罪的地方，改成有明确立场的说法。该下结论就下结论，不要写“可能”“在一定程度上”“因人而异”。</div>
              <div style={{ ...head, opacity: P(5) }}><B>三条硬约束：</B></div>
              <div style={{ opacity: P(6) }}>1. 不许加形容词和修辞。人味不靠形容词。</div>
              <div style={{ opacity: P(7) }}>2. 不许改我的事实、数字、例子。只改说法，不改内容。</div>
              <div style={{ ...para, opacity: P(8) }}>3. 改完把每处改动标出来，告诉我为什么要这么改。</div>
              <div style={{ ...head, opacity: P(9) }}><B>最后加一个自检：</B>逐句问一遍，“这句话是我会张嘴说出来的吗？”不是的，重写。</div>
            </div>
          </Card>
        </div>
      ) : null}
      {/* 扔给 AI：输入框 + 发送 */}
      {bar > 0 ? (
        <div style={{ position: "absolute", left: 50, top: 1318, width: 500, height: 92, opacity: Math.min(1, bar * 1.6), transform: `translateX(${(1 - bar) * -60}px)`, background: C.white, border: `3px solid ${C.ink}`, borderRadius: 46, boxShadow: "0 8px 16px rgba(60,50,30,0.14)" }}>
          <div style={{ position: "absolute", left: 22, top: 18, background: C.noteY, border: `2px solid ${C.ink}`, borderRadius: 12, padding: "2px 12px", fontFamily: BODY, fontWeight: 700, fontSize: 26, color: C.ink, opacity: 1 - sent }}>提示词 + 你的稿子</div>
          <div style={{ position: "absolute", left: 22, top: 22, fontFamily: BODY, fontWeight: 500, fontSize: 28, color: C.muted, opacity: sent }}>已发送</div>
          <div style={{ position: "absolute", right: 14, top: 12, width: 62, height: 62, borderRadius: 31, background: C.ink, color: C.white, fontFamily: BODY, fontWeight: 900, fontSize: 36, lineHeight: "62px", textAlign: "center", transform: `scale(${1 - 0.15 * Math.max(0, 1 - Math.abs(t - 5.0) / 0.12)})` }}>↑</div>
        </div>
      ) : null}
      {reply > 0 ? (
        <div style={{ position: "absolute", left: 50, top: 1432, width: 500, height: 170, opacity: Math.min(1, reply * 1.8), transform: `translateY(${(1 - reply) * 30}px)`, background: C.white, border: `3px solid ${C.ink}`, borderRadius: 22, boxShadow: "0 8px 16px rgba(60,50,30,0.14)" }}>
          <div style={{ position: "absolute", left: 24, top: 16, fontFamily: BODY, fontWeight: 900, fontSize: 32, color: C.green }}>AI：已改写一版 ✓</div>
          {[0.85, 1, 0.55].map((w, i) => (
            <div key={i} style={{ position: "absolute", left: 24, top: 76 + i * 30, height: 12, width: 440 * w * ramp(t, 6.15 + i * 0.1, 6.45 + i * 0.1), borderRadius: 6, background: "rgba(34,37,43,0.22)" }} />
          ))}
        </div>
      ) : null}
    </Paper>
  );
}
