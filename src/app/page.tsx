"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";

const programmeHighlights = [
  {
    title: "Immersion scénique",
    description:
      "Des portraits transformés en musiciens virtuoses au cœur d'un orchestre symphonique.",
  },
  {
    title: "Expérience personnalisée",
    description:
      "Chaque photo partagée reçoit une interprétation fidèle à ta présence et ton style.",
  },
  {
    title: "Partage instantané",
    description:
      "Retrouve tes créations dans ton tableau de bord et diffuse-les sur les réseaux.",
  },
];

const creationSteps = [
  {
    title: "1. Crée ton compte",
    detail: "Inscris-toi pour accéder à l'espace sécurisé et à la galerie personnelle.",
  },
  {
    title: "2. Téléverse ton portrait",
    detail: "Depuis le tableau de bord, importe une photo en haute résolution.",
  },
  {
    title: "3. Reçois ta mise en scène",
    detail: "L'IA harmonise ton portrait avec l'univers orchestral de Concerto Final.",
  },
];

export default function Home() {
  const { user } = useAuth();

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const primaryCtaHref = user ? "/dashboard" : "/signup";
  const primaryCtaLabel = user ? "Accéder au tableau de bord" : "Commencer l'expérience";
  const secondaryCta = user ? "/dashboard" : "/login";

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!contactName.trim() || !contactEmail.trim()) {
      setContactError("Nom et email sont requis.");
      setContactStatus(null);
      return;
    }

    setIsSubmittingContact(true);
    setContactStatus(null);
    setContactError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nomPrenom: contactName.trim(),
          email: contactEmail.trim(),
          message: contactMessage.trim() || undefined,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Impossible d'envoyer ton message.");
      }

      setContactStatus("Merci ! Nous revenons vers toi très vite.");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    } catch (error) {
      console.error(error);
      setContactError(
        error instanceof Error ? error.message : "Une erreur inattendue est survenue."
      );
      setContactStatus(null);
    } finally {
      setIsSubmittingContact(false);
    }
  };

  return (
    <main className="relative min-h-screen text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/Piano%20concert.jpg)" }}
        />
        <div className="absolute inset-0 bg-black/65" />
      </div>

      <section
        id="accueil"
        className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 pb-24 pt-20 text-center md:pt-24"
      >
        <span className="text-xs uppercase tracking-[0.4em] text-white/70">
          18 décembre · Temple de l&apos;Étoile · Paris
        </span>
        <h1 className="font-display text-4xl font-semibold leading-tight text-white md:text-5xl">
          Partage ton portrait et rejoins l&apos;orchestre du Concerto Final
        </h1>
        <p className="max-w-3xl text-base text-white/75 md:text-lg">
          Inscris-toi pour transformer ton image en musicien de scène, vivre l&apos;ambiance
          grandiose du concert et conserver un souvenir unique de la soirée.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm uppercase tracking-[0.3em]">
          <Link
            href={primaryCtaHref}
            className="rounded-full bg-[var(--accent)] px-8 py-3 text-black transition hover:bg-white"
          >
            {primaryCtaLabel}
          </Link>
          <Link
            href={secondaryCta}
            className="rounded-full border border-white/25 px-8 py-3 text-white transition hover:bg-white/10"
          >
            {user ? "Voir mes créations" : "Déjà inscrit ? Connexion"}
          </Link>
        </div>
      </section>

      <section
        id="informations"
        className="bg-black/40 py-20"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          {programmeHighlights.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/10 p-6 text-left backdrop-blur transition hover:border-[var(--accent)]"
            >
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-[0.3em] text-white">
                {item.title}
              </h2>
              <p className="text-sm text-white/70">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="generation"
        className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-20"
      >
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-semibold uppercase tracking-[0.35em] text-white">
            Ton parcours créatif
          </h2>
          <p className="mx-auto max-w-3xl text-base text-white/70">
            L&apos;accès à la génération se fait depuis ton tableau de bord personnel. Suis les
            étapes ci-dessous et rejoins-nous sur scène en quelques minutes.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {creationSteps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-white/10 bg-black/60 p-6 text-sm text-white/80"
            >
              <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-white">
                {step.title}
              </h3>
              <p className="mt-3 text-white/70">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-sm uppercase tracking-[0.3em]">
          <Link
            href={primaryCtaHref}
            className="rounded-full bg-[var(--accent)] px-8 py-3 text-black transition hover:bg-white"
          >
            {primaryCtaLabel}
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/25 px-8 py-3 text-white transition hover:bg-white/10"
          >
            Se connecter
          </Link>
        </div>
      </section>

      <section
        id="reservation"
        className="bg-black/55 py-20"
      >
        <div className="mx-auto grid max-w-5xl gap-12 px-6 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold uppercase tracking-[0.3em] text-white">
              Une question ? Écris-nous
            </h2>
            <p className="mt-4 text-sm text-white/70">
              Pour toute demande logistique ou artistique, l&apos;équipe Concerto Final te répond
              rapidement.
            </p>
          </div>

          <form
            onSubmit={handleContactSubmit}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur"
          >
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-[0.3em] text-white/60">
                Nom / Prénom
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:bg-black/60"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                disabled={isSubmittingContact}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-[0.3em] text-white/60">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:bg-black/60"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                disabled={isSubmittingContact}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-[0.3em] text-white/60">
                Message
              </label>
              <textarea
                className="h-32 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:bg-black/60"
                value={contactMessage}
                onChange={(event) => setContactMessage(event.target.value)}
                disabled={isSubmittingContact}
              />
            </div>

            {contactStatus ? (
              <p className="text-sm text-emerald-400">{contactStatus}</p>
            ) : null}
            {contactError ? <p className="text-sm text-red-400">{contactError}</p> : null}

            <button
              type="submit"
              className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmittingContact}
            >
              {isSubmittingContact ? "Envoi en cours…" : "Envoyer"}
            </button>
          </form>
        </div>
      </section>

      <footer className="bg-black/70 py-8 text-center text-xs uppercase tracking-[0.3em] text-white/40">
        Concerto Final © {new Date().getFullYear()} — Une expérience orchestrale augmentée
      </footer>
    </main>
  );
}
