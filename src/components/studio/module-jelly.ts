/** Shared jelly assignment for user-created modules.
 *
 * Visuals are unified site-wide (PR #31 follow-up): every module —
 * built-in or custom — shows the ONE animated jelly (JELLY_ANIM_SRC)
 * with the ONE poster frame it was generated from (JELLY_POSTER_SRC).
 * The old per-module stills (dedicated re-cuts for health/finance,
 * mirror+tint variants for the rest) looked like a different species
 * next to the animated jelly and are no longer referenced by any
 * display component; the files stay in public/ but nothing renders
 * them. What still differs per module is only the beam colour (below)
 * and the card title colour derived from it. */

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

/** The one animated jelly every node plays (PR #26): a ~5.2s seamless
 *  image-to-video loop generated from the upscaled jelly-left still,
 *  transcoded to display size (450×414, H.264, pure-black backing). All
 *  nodes share this single file, same direction, same colour — modules
 *  are told apart by their beam colour and card title colour only. */
export const JELLY_ANIM_SRC = "/studio/landing/jelly-anim.mp4";

/** The still the shared clip was generated from (the "A" frame): the
 *  universal poster, error fallback and reduced-motion rendering for
 *  every JellyMedia instance on every surface — landing nodes,
 *  workspace plate hubs, workspace map — so a module can never flash
 *  a different-looking jelly before the video starts or when motion
 *  is reduced. */
export const JELLY_POSTER_SRC = "/studio/landing/jelly-left.webp";

/** Beam colour for a custom module id. */
export function moduleJellyBeam(id: string): string {
  if (id === "health") return "#8FE3B8";
  if (id === "finance") return "#E6CF98";
  // Soft powder blue, unused by the built-ins / health / finance / the
  // hashed pool above.
  if (id === "ontology") return "#A8C6F0";
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
