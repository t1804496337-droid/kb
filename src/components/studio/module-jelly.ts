/** Shared jelly assignment for user-created modules.
 *
 * Landing nodes (PR #16) and workspace-map hubs draw from the same pool:
 * health/finance have dedicated re-cut jellies; every other module picks a
 * pre-generated mirror+tint variant (public/studio/landing/jelly-var-*.webp)
 * plus a beam colour by a stable id hash — so a module always shows the
 * same jelly + beam wherever it appears. */

export const CUSTOM_NODE_VARIANTS = 8;

export const CUSTOM_NODE_BEAMS = [
  "#C8C0FF",
  "#F2B8C6",
  "#A6E6EC",
  "#B8A6FF",
  "#F0A6B4",
  "#93E2D2",
  "#EBC27E",
  "#B8C6F2",
];

export function hashModuleId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Jelly image for a custom module id (health/finance pinned, rest hashed). */
export function moduleJellyImg(id: string): string {
  if (id === "health") return "/studio/landing/jelly-health.webp";
  if (id === "finance") return "/studio/landing/jelly-finance.webp";
  return `/studio/landing/jelly-var-${(hashModuleId(id) % CUSTOM_NODE_VARIANTS) + 1}.webp`;
}

/** Beam colour for a custom module id — always paired with moduleJellyImg. */
export function moduleJellyBeam(id: string): string {
  if (id === "health") return "#8FE3B8";
  if (id === "finance") return "#E6CF98";
  return CUSTOM_NODE_BEAMS[hashModuleId(id) % CUSTOM_NODE_BEAMS.length];
}

/** Life-like motion parameters for a jelly, derived from its id (built-ins
 *  pass their hub key, custom modules their module id) so the same jelly
 *  drifts, sways and breathes with the same rhythm on the landing and in
 *  the workspace map. Consumed as CSS variables by the `.jelly-alive`
 *  animation rules in globals.css:
 *  --jelly-dur / --jelly-delay   drift + sway cycle (8–14s, starts mid-cycle)
 *  --jelly-bdur / --jelly-bdelay breathe + bell-pulse cycle (4.2–7.2s)
 *  --jelly-ax / --jelly-ay       drift amplitude per axis (±4–7px)
 *  --jelly-rot                   sway amplitude (0.6–1.5deg)
 *  The glow colour itself is set separately as --jelly-glow from the
 *  jelly's beam colour at the render site. */
export function jellyMotion(id: string): Record<string, string> {
  const h = hashModuleId(id);
  // Slice the unsigned hash with division, not >> (which would reinterpret
  // hashes >= 2^31 as negative and skew the ranges below).
  const part = (shift: number, mod: number) => Math.floor(h / 2 ** shift) % mod;
  const dur = 8 + part(0, 61) / 10;
  const bdur = 4.2 + part(4, 31) / 10;
  const delay = -(part(6, 130) / 10);
  const bdelay = -(part(9, 70) / 10);
  const ax = (4 + part(3, 4)) * (part(2, 2) === 0 ? 1 : -1);
  const ay = (4 + part(8, 4)) * (part(5, 2) === 0 ? 1 : -1);
  const rot = (6 + part(11, 10)) / 10;
  return {
    "--jelly-dur": `${dur.toFixed(1)}s`,
    "--jelly-bdur": `${bdur.toFixed(1)}s`,
    "--jelly-delay": `${delay.toFixed(1)}s`,
    "--jelly-bdelay": `${bdelay.toFixed(1)}s`,
    "--jelly-ax": `${ax}px`,
    "--jelly-ay": `${ay}px`,
    "--jelly-rot": `${rot.toFixed(1)}deg`,
  };
}
