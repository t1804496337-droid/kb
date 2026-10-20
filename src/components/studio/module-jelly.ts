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
