"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BROADCAST_CONTENT_MAX } from "@/helpers/broadcast-content";

export function EchoBody({
  children,
  className = "text-parchment-100",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setCanExpand(el.scrollHeight > el.clientHeight + 1);
  }, [children, expanded]);

  return (
    <div>
      <div ref={ref} className={`${className} ${expanded ? "" : "line-clamp-4"}`}>
        {children}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded((open) => !open);
          }}
          className="mt-1 text-[11px] font-mono text-parchment-500 hover:text-parchment-100"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export function CharacterCountdown({ value, max = BROADCAST_CONTENT_MAX }: { value: string; max?: number }) {
  const left = Math.max(0, max - value.length);
  return (
    <p className={`text-right font-mono text-[11px] mt-1 ${left <= 20 ? "text-signal-400" : "text-parchment-500"}`}>
      {left} left
    </p>
  );
}
