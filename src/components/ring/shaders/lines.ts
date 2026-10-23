/**
 * 线段着色器：逐顶点色 + 逐顶点 alpha（参考 BRAIN_VS_L 模式重写）。
 * 用于团内近邻连边、远程细丝、突触束与 HUD 几何环。
 */
export const LINE_VERT = /* glsl */ `
attribute float aAlpha;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vColor = color;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LINE_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
}
`;
