"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { MAIN_EVENT } from "@/lib/constants";

const navItems = [
  { href: "#concert", label: "Concert" },
  { href: "#apropos", label: "À propos" },
  { href: "#infos", label: "Infos pratiques" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, loading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isLanding = pathname === "/";

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo-concert.png"
            alt="Concerto"
            width={72}
            height={72}
            className="h-12 w-auto"
            priority
          />
          <div className="hidden flex-col leading-tight text-sm uppercase tracking-[0.35em] text-[#7a1c1a] sm:flex">
            <span>Concerto</span>
            <span className="text-xs tracking-[0.4em] text-neutral-600">Saison 2025·2026</span>
          </div>
        </Link>

        {isLanding ? (
          <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.28em] text-neutral-600 lg:flex">
            {navItems.map(({ href, label }) => (
              <a key={href} className="transition hover:text-[#7a1c1a]" href={href}>
                {label}
              </a>
            ))}
          </nav>
        ) : (
          <div className="hidden items-center gap-3 text-xs uppercase tracking-[0.3em] text-neutral-600 lg:flex">
            <span>{MAIN_EVENT.venue}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-neutral-400" />
            <span>{MAIN_EVENT.time}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em]">
          {user ? (
            <>
              <span className="hidden rounded-full bg-neutral-100 px-3 py-2 text-neutral-600 sm:block">
                {user.email}
              </span>
              <Link
                href="/dashboard"
                className="rounded-full border border-[#7a1c1a]/20 px-4 py-2 text-[#7a1c1a] transition hover:bg-[#7a1c1a] hover:text-white"
              >
                Réservations
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading || isSigningOut}
                className="rounded-full border border-[#7a1c1a]/20 px-4 py-2 text-[#7a1c1a] transition hover:bg-[#7a1c1a] hover:text-white disabled:opacity-60"
              >
                {isSigningOut ? "Déconnexion…" : "Déconnexion"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-[#7a1c1a]/20 px-4 py-2 text-[#7a1c1a] transition hover:bg-[#7a1c1a] hover:text-white"
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-[#7a1c1a] px-4 py-2 text-white transition hover:bg-[#56100f]"
              >
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
