/**
 * 点云着色器：软圆点（参考 agent-display 的 BRAIN_VS_P / PT_FS 模式
 * 按本站需要重写）。逐点属性：aSize（像素尺寸）、aAlpha（明暗，
 * 由真实数据活性驱动）、color（逐点色）。uShimmer 是纯表现层的
 * 呼吸微光（不携带任何数据语义，幅度 ±12%）。
 */
export const POINT_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
uniform float uTime;
uniform float uDim;
void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float shimmer = 0.88 + 0.12 * sin(uTime * 1.2 + position.x * 5.1 + position.y * 3.7 + position.z * 4.3);
  vAlpha = aAlpha * shimmer * uDim;
  /* 尺寸口径：拟合距离 ≈9.5 世界单位时，aSize≈设备像素（×uScale=dpr） */
  gl_PointSize = aSize * uScale * (10.0 / -mv.z);
}
`;

export const POINT_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float disc = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vColor, vAlpha * disc);
}
`;
