import React from "react";
import { SCENES_A, DEMOS_A } from "./scenes_a.jsx";
import { SCENES_B, DEMOS_B } from "./scenes_b.jsx";
import { SCENES_C, DEMOS_C } from "./scenes_c.jsx";

// 高级感干货风 · 场景总表。每段动效只写一个 SPEC，交给 <Scene spec={SPEC} /> 渲染。
export const SCENES = { ...SCENES_A, ...SCENES_B, ...SCENES_C };
export const DEMOS = [...DEMOS_A, ...DEMOS_B, ...DEMOS_C];

export function Scene({ spec }) {
  const s = SCENES[spec.scene];
  if (!s) return null;
  const C = s.C;
  return <C spec={spec} />;
}
