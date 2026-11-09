"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/hooks/api";

type Props = { state: string; checked: number; total: number; finishedAt: string | null };

// The sun rises only while the once-a-day check runs. A reload after it finishes shows the sun up and nothing moving.
export function MorningStrip({ state, checked, total, finishedAt }: Props) {
  const router = useRouter();
  const [p, setP] = useState({ state, checked, total });
  useEffect(() => {
    if (p.state !== "RUNNING") return;
    const t = setInterval(async () => {
      const next = await api.progress();
      if (!next || next.state !== "RUNNING") { clearInterval(t); router.refresh(); setP({ state: "DONE", checked: 0, total: 0 }); return; }
      setP(next);
    }, 1500);
    return () => clearInterval(t);
  }, [p.state, router]);

  const running = p.state === "RUNNING";
  const frac = running ? (p.total ? p.checked / p.total : 0) : 1;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const label = running
    ? `Checking job boards · ${p.checked} of ${p.total}`
    : finishedAt ? `Updated ${new Date(finishedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Not checked yet";
  const style = { "--p": frac } as React.CSSProperties;
  return (
    <div className="dawn" style={style}>
      <h1>Good morning.</h1>
      <p>{today}</p>
      <div className="horizon" aria-hidden="true">
        <div className="glow" />
        <div className="sun" style={{ ...style, transition: running ? undefined : "none" }} />
        <div className="ground" />
      </div>
      <div className="progress" aria-live="polite">{label}</div>
    </div>
  );
}
