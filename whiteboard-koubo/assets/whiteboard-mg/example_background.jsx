import React from "react";
import { C, MARK, HAND, BODY, useT, ramp, spr, Paper, Title, Chip, Strike, Card, Lines, Stamp, Hand, Highlight } from "./lib.jsx";

// 示例：文字、时间点都来自作者自己的一条口播视频，只用来演示写法。做你自己的片子时换成你实际说的话和时间。

// B1 · 11.37 → 20.03（8.67s）去AI味 = 减法
const WORDS = [
  { w: "赋能", x: 120, y: 360 },
  { w: "值得注意的是", x: 380, y: 360 },
  { w: "综上所述", x: 120, y: 490 },
  { w: "不可或缺", x: 470, y: 490 },
  { w: "深度剖析", x: 120, y: 620 },
  { w: "全方位", x: 470, y: 620 },
];
export default function Subtract() {
  const { t } = useT();
  const chipsOut = 3.45;
  const card = spr(t, 3.6, 0.5);
  return (
    <Paper t={t}>
      <Title t={t} at={0.05} x={120} y={120} size={84} hl={[300, 260]}>去AI味 = 做减法</Title>
      <div style={{ position: "absolute", left: 860, top: 96, width: 120, height: 120, borderRadius: 60, background: C.red, color: C.white, fontFamily: MARK, fontSize: 110, lineHeight: "108px", textAlign: "center", opacity: ramp(t, 0.5, 0.8), transform: `scale(${0.6 + 0.4 * spr(t, 0.5, 0.4)})` }}>−</div>
      {WORDS.map((o, i) => (
        <React.Fragment key={i}>
          <Chip t={t} at={1.8 + i * 0.16} x={o.x} y={o.y} size={44} rot={(i % 2 ? 1.5 : -1.5)} out={chipsOut}>{o.w}</Chip>
          {t < chipsOut + 0.3 ? <Strike t={t} a={2.35 + i * 0.17} x={o.x - 6} y={o.y + 44} w={o.w.length * 46 + 70} width={8} rot={-3} /> : null}
        </React.Fragment>
      ))}
      <div style={{ position: "absolute", left: 120, top: 780, fontFamily: HAND, fontSize: 60, color: C.red, opacity: ramp(t, 2.6, 2.9) * (1 - ramp(t, chipsOut, chipsOut + 0.3)) }}>删掉 AI 味的词</div>
      {card > 0 ? (
        <div style={{ position: "absolute", left: 0, top: 0, opacity: Math.min(1, card * 1.6), transform: `translateY(${(1 - card) * 40}px)` }}>
          <Card x={150} y={330} w={780} h={600} rot={-1}>
            <div style={{ position: "absolute", left: 50, top: 40, fontFamily: BODY, fontWeight: 700, fontSize: 40, color: C.ink }}>稿子.txt</div>
            <Lines x={50} y={130} w={660} n={9} gap={48} t={t} at={3.8} step={0.07} widths={[1, 0.92, 1, 0.85, 0.97, 1, 0.9, 0.95, 0.55]} />
          </Card>
          <Stamp t={t} at={5.35} x={820} y={370} r={78} color={C.green} size={40}>无错</Stamp>
        </div>
      ) : null}
      <Hand t={t} a={6.8} b={7.9} x={130} y={1000} size={70} rot={-2}>但……这不像人在说话</Hand>
      <div style={{ position: "absolute", left: 900, top: 930, fontFamily: MARK, fontSize: 150, color: C.red, opacity: ramp(t, 7.9, 8.1), transform: `rotate(${12 * spr(t, 7.9, 0.4)}deg)` }}>?</div>
    </Paper>
  );
}
