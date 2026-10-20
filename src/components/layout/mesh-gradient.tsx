/**
 * CSS mesh gradient — multi-radial teal/cyan/violet under bloom.
 * Animates a small blurred layer via transform (not background-position).
 */
export function MeshGradient({
  className = "mesh-gradient pointer-events-none fixed inset-0 z-0 overflow-hidden",
}: {
  className?: string;
}) {
  return (
    <div className={className} aria-hidden>
      <div className="mesh-gradient-layer" />
    </div>
  );
}
