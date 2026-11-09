"use client";
import { useEffect, useRef } from "react";
import { api } from "@/hooks/api";

// Records "All caught up" once per page view when it scrolls into sight (sweep-time KPI).
export function CaughtUp() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api.event("TODAY_OPENED");
    const el = ref.current; if (!el) return;
    let sent = false;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !sent) { sent = true; api.event("ALL_CAUGHT_UP"); } });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div className="done" ref={ref}>All caught up.</div>;
}
