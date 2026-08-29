export function VerifiedMark({ verified }: { verified?: boolean }) {
  if (!verified) return null;
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-moss-500 text-[11px] font-bold leading-none text-dusk-950"
      title="Verified student"
      aria-label="Verified student"
    >
      ✓
    </span>
  );
}
