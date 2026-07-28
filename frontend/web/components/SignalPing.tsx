/**
 * The "signature element" per the design brief: a radiating ping, standing
 * in for the broadcast metaphor. Used sparingly — new-broadcast markers,
 * the "posting" state, and nowhere else, so it stays meaningful rather
 * than decorative.
 */
export function SignalPing({ size = 10 }: { size?: number }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-signal-500 animate-ping-slow" />
      <span className="relative inline-flex rounded-full bg-signal-500" style={{ width: size, height: size }} />
    </span>
  );
}
