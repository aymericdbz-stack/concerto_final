"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";

const navItems = [
  { href: "#accueil", label: "Accueil" },
  { href: "#informations", label: "Informations" },
  { href: "#generation", label: "Génération" },
  { href: "#reservation", label: "Contact" },
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
    <header className="sticky top-0 z-20 border-b border-white/10 bg-black/35 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-sm text-white">
        <Link href="/" className="font-semibold uppercase tracking-[0.25em]">
          Concerto Final
        </Link>

        {isLanding ? (
          <nav className="hidden items-center gap-6 text-xs uppercase tracking-[0.3em] text-white/70 sm:flex">
            {navItems.map(({ href, label }) => (
              <a key={href} className="transition hover:text-[var(--accent)]" href={href}>
                {label}
              </a>
            ))}
          </nav>
        ) : (
          <div className="hidden items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70 sm:flex">
            <span>Temple de l&apos;Étoile</span>
            <span className="h-1 w-1 rounded-full bg-white/50" aria-hidden />
            <span>19h30 — 21h</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em]">
          {user ? (
            <>
              <span className="hidden rounded-full bg-white/10 px-3 py-2 text-white/80 sm:block">
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading || isSigningOut}
                className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:bg-white hover:text-black disabled:opacity-60"
              >
                {isSigningOut ? "Déconnexion…" : "Déconnexion"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-4 py-2 text-white transition hover:bg-white hover:text-black"
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-black transition hover:bg-white"
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
