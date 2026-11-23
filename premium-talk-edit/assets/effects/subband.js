// 遮掉原片烧录字幕：只在一条横带内做强模糊 + 轻微压暗，带子上下边缘羽化。
// 坐标都是素材画面的比例（0 = 顶部，1 = 底部）。
const shader = {
  id: "subband-fragment",
  source: `#version 300 es
precision highp float;
uniform sampler2D u_input;
uniform vec2 u_size;
uniform float u_center;
uniform float u_half;
uniform float u_feather;
uniform float u_radius;
uniform float u_dim;
uniform float u_flip;
in vec2 v_texCoord;
out vec4 fragColor;
void main() {
  vec2 uv = v_texCoord;
  float y = u_flip > 0.5 ? 1.0 - uv.y : uv.y;
  float d = abs(y - u_center);
  float m = 1.0 - smoothstep(u_half, u_half + u_feather, d);
  vec4 src = texture(u_input, uv);
  if (m <= 0.001) { fragColor = src; return; }
  vec2 px = 1.0 / u_size;
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -10; i <= 10; i++) {
    for (int j = -5; j <= 5; j++) {
      vec2 o = vec2(float(i) * u_radius / 10.0, float(j) * u_radius * 0.5 / 5.0);
      float w = exp(-(float(i * i)) / 50.0 - (float(j * j)) / 12.0);
      acc += texture(u_input, uv + o * px) * w;
      wsum += w;
    }
  }
  vec4 blurred = acc / wsum;
  blurred.rgb *= (1.0 - u_dim);
  fragColor = mix(src, blurred, m);
}`,
};

export class SubtitleBand extends EffectProcessor {
  async initialize(ctx) {
    ctx.compileShader({ id: "subband", fragmentShader: shader });
  }

  render(ctx) {
    const p = ctx.properties || {};
    const w = ctx.width || 1080;
    const h = ctx.height || 1920;
    return ctx.renderPass({
      id: "subband",
      textures: { u_input: { texture: ctx.inputTexture, filter: "linear" } },
      uniforms: {
        u_size: [w, h],
        u_center: p.center ?? 0.781,
        u_half: p.half ?? 0.03,
        u_feather: p.feather ?? 0.022,
        u_radius: p.radius ?? 26,
        u_dim: p.dim ?? 0.12,
        u_flip: p.flip ? 1 : 0,
      },
    });
  }
}
