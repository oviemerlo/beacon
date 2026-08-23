"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clientFetch } from "@/helpers/client-api";
import type { UnreadCount } from "@/types/api";

const NAV_ITEMS = [
  { href: "/feed", label: "Feed" },
  { href: "/broadcasts/new", label: "Broadcast" },
  { href: "/conversations", label: "Messages" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();
  const [feedUnread, setFeedUnread] = useState(0);
  const [messageUnread, setMessageUnread] = useState(0);
  const [mentionUnread, setMentionUnread] = useState(0);

  useEffect(() => {
    let active = true;

    const loadCounts = async () => {
      try {
        const [feed, messages] = await Promise.all([
          clientFetch<UnreadCount>("/feed/unread-count"),
          clientFetch<UnreadCount>("/conversations/unread-count"),
        ]);
        if (!active) return;
        setFeedUnread(feed.count ?? 0);
        setMessageUnread(messages.count ?? 0);
        setMentionUnread(messages.mention_count ?? 0);
      } catch {
        if (!active) return;
        setFeedUnread(0);
        setMessageUnread(0);
        setMentionUnread(0);
      }
    };

    void loadCounts();
    const interval = setInterval(() => {
      void loadCounts();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <nav className="border-b border-dusk-700 bg-dusk-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-2xl mx-auto flex items-center justify-between px-5 py-3.5">
        <Link href="/feed" className="flex items-center gap-2 font-display font-bold text-lg tracking-tight text-parchment-100">
          <img src="/echotocrowd-favicon.png" alt="" className="h-7 w-7 rounded-md" />
          EchoToCrowd
        </Link>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-beacon text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                  active ? "bg-dusk-700 text-signal-400" : "text-parchment-500 hover:text-parchment-100"
                }`}
              >
                {item.label}
                {item.href === "/feed" && feedUnread > 0 && (
                  <span className="inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-rust-500 text-dusk-950 text-[10px] font-bold">
                    {feedUnread > 99 ? "99+" : feedUnread}
                  </span>
                )}
                {item.href === "/conversations" && (messageUnread > 0 || mentionUnread > 0) && (
                  <span className={`inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full text-dusk-950 text-[10px] font-bold ${mentionUnread > 0 ? "bg-signal-500" : "bg-rust-500"}`}>
                    {mentionUnread > 0 ? "@" : messageUnread > 99 ? "99+" : messageUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
