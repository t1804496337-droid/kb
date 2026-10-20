/**
 * Soft 「弥散呼吸」atmosphere — CSS-only blooms + rotating conic aurora.
 * Behind glass UI; never captures pointer.
 */
export function BloomAtmosphere({
  className = "bloom-atmosphere pointer-events-none fixed inset-0 z-[1] overflow-hidden",
}: {
  className?: string;
}) {
  return (
    <div className={className} aria-hidden>
      <div className="bloom-aurora" />
      <div className="bloom-orb bloom-orb-a" />
      <div className="bloom-orb bloom-orb-b" />
      <div className="bloom-orb bloom-orb-c" />
      <div className="bloom-orb bloom-orb-d" />
    </div>
  );
}
