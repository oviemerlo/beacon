export function VerifiedMark({ verified }: { verified?: boolean }) {
  if (!verified) return null;
  return (
    <span className="text-moss-400" title="Verified student" aria-label="Verified student">
      ✓
    </span>
  );
}
