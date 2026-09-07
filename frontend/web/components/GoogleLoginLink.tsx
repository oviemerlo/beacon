"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function isSafeJoinNext(next: string | undefined): next is string {
  return typeof next === "string" && /^\/join\/[A-Za-z0-9_-]+$/.test(next);
}

export function GoogleLoginLink({ next }: { next?: string }) {
  return (
    <a
      href={`${API_URL}/auth/google/login`}
      className="btn-secondary w-full flex items-center justify-center gap-2 mb-3"
      onClick={() => {
        if (isSafeJoinNext(next)) {
          document.cookie = `beacon_login_next=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax`;
        }
      }}
    >
      Continue with Google
    </a>
  );
}
