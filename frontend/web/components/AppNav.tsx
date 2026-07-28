"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/feed", label: "Feed" },
  { href: "/broadcasts/new", label: "Broadcast" },
  { href: "/conversations", label: "Messages" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-dusk-700 bg-dusk-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-5 py-3.5">
        <Link href="/feed" className="font-display font-bold text-lg tracking-tight text-parchment-100">
          Beacon
        </Link>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-beacon text-sm font-medium transition-colors ${
                  active ? "bg-dusk-700 text-signal-400" : "text-parchment-500 hover:text-parchment-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
