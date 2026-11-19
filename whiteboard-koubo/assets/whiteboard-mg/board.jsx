import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { THEME, W, H, BoardCtx, PaperBase, PaperScreen, paperColor, EINOUT, ramp, lerp } from "./lib.jsx";
import { BOARD } from "./board_data.jsx";

// 整板运镜：整条片子共用一块大白板，每段全屏动效占白板上的一格，切段时镜头从上一格拉远、平移、推近到下一格，
// 写过的内容都留在板上。overview 段把镜头拉远看整块白板。
// board_data.jsx 和每段的 cam_*.jsx 由 scene_cues.py 生成（theme.jsx 的 camera 设成 "board"），不要手改。

// 格子按纸张花纹的周期对齐，每一格里的方格、横线、点阵和单独一页时完全一样
const TILE = { lines: 64 }[THEME.paper] || 54;
const PAD = TILE * 4; // 留够边，开场推近时看不到白板外面
const PX = Math.ceil((W + 100) / TILE) * TILE;
const PY = Math.ceil((H + 100) / TILE) * TILE;

export function boardLayout(n) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cells = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), k = i % cols;
    const c = r % 2 ? cols - 1 - k : k; // 蛇形：第二行从右往左，镜头每次只挪到相邻的一格
    cells.push({ x: PAD + c * PX, y: PAD + r * PY });
  }
  return { cells, bw: PAD * 2 + (cols - 1) * PX + W, bh: PAD * 2 + (rows - 1) * PY + H };
}

// 每个窗口（时间线上的一段 cam_*.jsx）镜头要停的位置：{cx, cy, s}，s=1 就是正好框住这一格
function plan(fps) {
  const wins = [...BOARD].sort((a, b) => a.start - b.start);
  const L = boardLayout(wins.filter((w) => !w.overview).length);
  const fit = Math.min((0.92 * W) / L.bw, (0.8 * H) / L.bh);
  let ci = 0;
  const shots = wins.map((w) => {
    if (w.overview) return { ...w, cx: L.bw / 2, cy: L.bh / 2 + (H / 2 - 860) / fit, s: fit };
    const c = L.cells[ci++];
    return { ...w, cell: c, cx: c.x + W / 2, cy: c.y + H / 2, s: 1 };
  });
  return { L, shots: shots.map((w) => ({ ...w, t0: w.start / fps, t1: (w.start + w.dur) / fps })) };
}

function camera(L, shots, T) {
  let k = 0;
  shots.forEach((w, i) => { if (w.t0 <= T + 1e-6) k = i; });
  const to = shots[k];
  const from = k > 0 ? shots[k - 1] : { ...to, s: to.s * 0.84 }; // 第一段：从稍远处推近
  const dist = Math.hypot(to.cx - from.cx, to.cy - from.cy);
  const zoom = to.s !== from.s && k > 0;
  const D = k === 0 ? 0.9 : zoom ? 1.1 : 0.7 + 0.15 * Math.min(3, dist / PX);
  const p = ramp(T - to.t0, 0, D, EINOUT);
  const z = zoom || k === 0 ? 0 : Math.min(1.4, Math.max(0.3, dist / 2600)); // 平移途中拉远多少，距离越远拉得越远
  const s = Math.exp(lerp(Math.log(from.s), Math.log(to.s), p)) / (1 + z * Math.sin(Math.PI * p));
  let cx = lerp(from.cx, to.cx, p), cy = lerp(from.cy, to.cy, p);
  if (!from.overview && !to.overview) { // 格子之间平移时，画面不出白板（不露出桌面）
    cx = keep(cx, W / 2 / s, L.bw);
    cy = keep(cy, H / 2 / s, L.bh);
  }
  return { cx, cy, s };
}
const keep = (c, half, size) => (2 * half >= size ? size / 2 : Math.min(Math.max(c, half), size - half));

export function Board({ id }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { L, shots } = plan(fps);
  const me = shots.find((w) => w.id === id);
  const T = (me ? me.t0 : 0) + frame / fps; // 整片时间（秒）
  const cam = camera(L, shots, T);
  const tr = { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${W / 2 - cam.cx * cam.s}px, ${H / 2 - cam.cy * cam.s}px) scale(${cam.s})` };
  const vx0 = cam.cx - W / 2 / cam.s, vx1 = cam.cx + W / 2 / cam.s, vy0 = cam.cy - H / 2 / cam.s, vy1 = cam.cy + H / 2 / cam.s;
  const mx = PAD + 78;
  const desk = THEME.paper === "cork" || THEME.paper === "kraft" ? "#6E5A45" : "#D8D2C6";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", background: desk }}>
      <div style={{ ...tr, width: L.bw, height: L.bh, boxShadow: "0 30px 90px rgba(0,0,0,0.35)" }}>
        <PaperBase w={L.bw} h={L.bh} mx={mx} />
      </div>
      <PaperScreen />
      <div style={{ ...tr, width: L.bw, height: L.bh }}>
        {shots.map((w) => {
          if (!w.cell || !w.C || T < w.t0 - 1e-6) return null; // 还没讲到的格子是空的
          const c = w.cell;
          if (c.x > vx1 || c.x + W < vx0 || c.y > vy1 || c.y + H < vy0) return null;
          const Seg = w.C;
          const t = Math.min(T - w.t0, w.t1 - w.t0);
          return (
            <div key={w.id} style={{ position: "absolute", left: c.x, top: c.y, width: W, height: H }}>
              <BoardCtx.Provider value={{ t, dur: w.t1 - w.t0, x: c.x, y: c.y, bw: L.bw, bh: L.bh, mx }}>
                <Seg />
              </BoardCtx.Provider>
            </div>
          );
        })}
      </div>
    </div>
  );
}
