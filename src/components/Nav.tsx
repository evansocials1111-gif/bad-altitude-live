"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/client/AppProvider";
import { Avatar, TierBadge } from "./ui/bits";

const SHOW_NAME = process.env.NEXT_PUBLIC_SHOW_NAME || "Degen Den";

function Logo() {
  return (
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden className="shrink-0">
      <rect width="40" height="40" rx="10" fill="#ff3d8b" />
      <path d="M7 25 Q7 17 13 17 H27 Q33 17 33 25 V30 H7 Z" fill="#0b0b0f" />
      <rect x="5" y="22" width="5" height="10" rx="2" fill="#0b0b0f" />
      <rect x="30" y="22" width="5" height="10" rx="2" fill="#0b0b0f" />
      <circle cx="15" cy="12" r="3.2" fill="#c6ff3d" />
      <circle cx="25" cy="12" r="3.2" fill="#c6ff3d" />
    </svg>
  );
}

const LINKS = [["/", "Live"], ["/token", "Token"], ["/about", "About"]] as const;

export function Nav() {
  const path = usePathname();
  const { me, openAuth, status } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <nav className="glass glass-strong mx-auto flex max-w-[1500px] items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5" aria-label="Main">
        <Link href="/" className="display flex shrink-0 items-center gap-2.5 text-xl leading-none tracking-wide sm:text-2xl" onClick={() => setOpen(false)}><Logo />{SHOW_NAME.replace(/ live$/i, "")}</Link>
        <div className="mx-auto hidden items-center gap-0.5 md:flex">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`relative rounded-full px-3 py-1.5 text-sm font-bold transition hover:text-snow ${path === href ? "bg-white/10 text-snow" : "text-frost"}`}>
              {label}
              {href === "/" && status.live && <span className="on-air-dot absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" />}
            </Link>
          ))}
          {(me?.user?.role === "admin" || me?.user?.role === "moderator") && <Link href="/admin" className={`rounded-full px-3 py-1.5 text-sm font-bold ${path === "/admin" ? "bg-white/10" : "text-ember-soft"}`}>Admin</Link>}
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {me?.user ? (
            <Link href="/profile" className="flex items-center gap-2 rounded-full bg-white/8 py-1 pl-1 pr-3 transition hover:bg-white/15">
              <Avatar seed={me.user.avatarSeed} size={28} />
              <span className="hidden max-w-28 truncate text-sm font-bold sm:block">{me.user.username}</span>
              {me.tier && <TierBadge tier={me.tier} size="xs" />}
            </Link>
          ) : (
            <button onClick={openAuth} className="btn btn-ember px-3 py-2 text-xs sm:px-4 sm:text-sm">Connect wallet</button>
          )}
          <button onClick={() => setOpen(!open)} className="btn btn-glass h-9 w-9 md:hidden" aria-label="Menu" aria-expanded={open}>{open ? "×" : "≡"}</button>
        </div>
      </nav>
      {open && (
        <div className="glass glass-strong mx-auto mt-2 grid max-w-7xl gap-1 rounded-3xl p-3 md:hidden">
          {LINKS.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`rounded-xl px-4 py-2.5 font-bold ${path === href ? "bg-white/10" : "text-frost"}`}>{label}</Link>)}
          {(me?.user?.role === "admin" || me?.user?.role === "moderator") && <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 font-bold text-ember-soft">Admin</Link>}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/8 px-5 py-10 text-sm text-mist">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:justify-between">
        <p className="max-w-2xl">Entertainment only. Tanner and Jade are fictional AI characters: they are crude, they are rude, and they are often wrong. Nothing here is financial advice or a promise about any token&apos;s value. Meme coins can go to zero. Never share your seed phrase or private key.</p>
        <p>Adult comedy. 18+</p>
      </div>
    </footer>
  );
}
