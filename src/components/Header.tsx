"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddJobButton } from "@/components/AddJob";
import { APP_NAME } from "@/config/app";
import { Logo } from "@/components/Logo";

const PAGES = [
  { href: "/", label: "Today" },
  { href: "/industry", label: "Industry" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/metrics", label: "Metrics" },
  { href: "/admin", label: "Admin" },
];

export function Header() {
  const path = usePathname();
  const current = PAGES.find((p) => p.href === path) ?? PAGES[0];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey); document.addEventListener("click", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick); };
  }, []);
  return (
    <header className="bar">
      <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
        <Logo />
        {APP_NAME}
      </Link>
      <div className="status" />
      <AddJobButton />
      <nav className="menu" ref={ref}>
        <button aria-haspopup="true" aria-expanded={open} aria-controls="menuList" onClick={() => setOpen(!open)}>
          {current.label} <span aria-hidden="true">▾</span>
        </button>
        <ul id="menuList" hidden={!open}>
          {PAGES.map((p) => (
            <li key={p.href}><Link href={p.href} aria-current={p.href === path ? "page" : undefined} onClick={() => setOpen(false)}>{p.label}</Link></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
