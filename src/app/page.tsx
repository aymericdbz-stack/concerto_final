/* eslint-disable @next/next/no-img-element */

"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

const DEFAULT_PROMPT =
  "Transform the uploaded portrait so the person performs centre stage at a grand classical music concert. They play a classical instrument such as a grand piano, violin or cello, surrounded by a full symphony orchestra and conductor in an opulent concert hall. Keep facial likeness, formal black-tie attire, warm golden spotlights and polished wood stage. Avoid rock, pop, electric guitars, microphones or modern festival lighting.";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleGenerationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Merci d&apos;importer un portrait pour commencer.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("Génération en cours, cela peut prendre quelques instants…");
    setErrorMessage(null);
    setGeneratedImageUrl(null);
    setGenerationProgress(5);

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("prompt", DEFAULT_PROMPT);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "La génération a échoué.");
      }

      const data = (await response.json()) as { imageUrl?: string; error?: string };

      if (!data.imageUrl) {
        throw new Error(data.error || "Impossible de récupérer l&apos;image générée.");
      }

      setGeneratedImageUrl(data.imageUrl);
      setStatusMessage("Image générée avec succès !");
      setGenerationProgress(100);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Une erreur inattendue est survenue."
      );
      setStatusMessage(null);
      setGenerationProgress(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

  useEffect(() => {
    if (!isGenerating) {
      if (!generatedImageUrl) {
        setGenerationProgress(0);
      } else {
        setGenerationProgress(100);
      }
      return;
    }

    const interval = window.setInterval(() => {
      setGenerationProgress((previous) => {
        if (previous >= 90) {
          return previous;
        }

        const nextValue = previous + Math.random() * 12 + 4;
        return Math.min(90, Math.round(nextValue));
      });
    }, 500);

    return () => window.clearInterval(interval);
  }, [isGenerating, generatedImageUrl]);

  return (
    <div className="relative min-h-screen text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="animate-slow-pan absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url(/Piano%20concert.jpg)",
          }}
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/35 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 text-sm text-white">
          <a href="#accueil" className="font-semibold tracking-[0.25em] uppercase">
            Concerto Final
          </a>
          <div className="hidden items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/70 sm:flex">
            <span>Temple de l&apos;Étoile</span>
            <span className="h-1 w-1 rounded-full bg-white/50" aria-hidden />
            <span>19h30 — 21h</span>
          </div>
          <nav className="flex flex-wrap items-center gap-6">
            <a className="transition hover:text-[var(--accent)]" href="#accueil">
              Accueil
            </a>
            <a className="transition hover:text-[var(--accent)]" href="#informations">
              Informations
            </a>
            <a className="transition hover:text-[var(--accent)]" href="#generation">
              Génération d&apos;images
            </a>
            <a className="transition hover:text-[var(--accent)]" href="#reservation">
              Réservation
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-24 pt-20 text-white">
        <section id="accueil" className="scroll-mt-32 space-y-8">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">
              Temple de l&apos;Étoile — Paris 17ᵉ
            </p>
            <h1 className="text-5xl font-semibold leading-tight">
              Jeudi 18 décembre — 19h30 à 21h
            </h1>
            <p className="text-base text-white/85">
              Une parenthèse suspendue sous la nef du Temple de l&apos;Étoile. Lumières ambrées, cordes et
              cuivres dialoguent avec les respirations du public avant l&apos;apothéose collective.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.25em]">
            <span className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)] px-6 py-3 text-white shadow-md">
              Accueil 19h00
            </span>
            <span className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)] px-6 py-3 text-white shadow-md">
              Concert 19h30 - 21h
            </span>
            <span className="rounded-full border border-[var(--accent)]/50 bg-[var(--accent)] px-6 py-3 text-white shadow-md">
              After en loggia 21h15
            </span>
          </div>
        </section>

        <section
          id="informations"
          className="scroll-mt-32 space-y-6 rounded-[32px] border border-white/10 bg-white/12 p-8 text-[var(--foreground)] backdrop-blur"
        >
          <div className="space-y-2 text-white">
            <h2 className="text-3xl font-semibold">Informations essentielles</h2>
            <p className="text-sm text-white/75">
              Temple de l&apos;Étoile, 54 Av. de la Grande Armée — Métro Argentine ou Charles de Gaulle.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-white/80 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <h3 className="text-base font-semibold text-white">Planning</h3>
              <p className="mt-2">19h00 accueil — 19h30 mise en lumière — 21h clôture instrumentale.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <h3 className="text-base font-semibold text-white">Ambiance</h3>
              <p className="mt-2">
                Dress code cuivre &amp; beige. Le temple devient scène : textures bois, voûtes étoilées,
                acoustique enveloppante.
              </p>
            </div>
          </div>
        </section>

        <section
          id="generation"
          className="scroll-mt-32 grid w-full gap-3 rounded-2xl border border-white/20 bg-black/80 p-3 text-white backdrop-blur-sm lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="space-y-2 text-white">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-white/70">
              Portraits du public
            </p>
            <h2 className="text-xl font-semibold leading-snug">
              Glissez votre portrait, entrez dans l&apos;orchestre
            </h2>
            <p className="text-[0.7rem] text-white/70">
              Notre atelier éphémère transforme votre portrait en instantané de musique classique. Aucun
              réglage requis : remettez-nous simplement votre photo (portrait only) et repartez avec un
              cliché où vous interprétez une œuvre au piano, violon ou violoncelle, entouré·e d&apos;un
              orchestre dans une salle de concert.
            </p>
            <p className="text-[0.6rem] uppercase tracking-[0.25em] text-white/60">
              Disponible sur place avant et après le concert
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-white/20 bg-black/90 p-3 text-white shadow-lg">
            <form onSubmit={handleGenerationSubmit} className="space-y-3">
              <div className="space-y-2">
                <label
                  htmlFor="image"
                  className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
                >
                  Dépose ton portrait (JPG, PNG, WEBP, HEIC)
                </label>
                <label
                  htmlFor="image"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/40 bg-black/70 p-4 text-center transition hover:border-white hover:bg-black"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white">
                    Glisse ou clique pour importer
                  </span>
                  <span className="text-[0.6rem] text-white/60">
                    Portrait poitrine ou visage recommandé — max 10 Mo
                  </span>
                  <input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                </label>
                {previewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-white/30">
                    <img src={previewUrl} alt="Prévisualisation" className="max-h-32 w-full object-cover" />
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full rounded-full bg-[var(--accent)] px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white shadow-md transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? "Génération en cours…" : "Recevoir mon instantané"}
              </button>

              {statusMessage ? (
                <p className="text-[0.6rem] font-medium text-emerald-300">{statusMessage}</p>
              ) : null}
              {errorMessage ? (
                <p className="text-[0.6rem] font-medium text-rose-300">{errorMessage}</p>
              ) : null}
            </form>

            <div className="rounded-xl border border-white/20 bg-black/70 p-2 text-[0.6rem] text-white/70">
              <p>
                Les portraits générés restituent automatiquement l&apos;énergie d&apos;un concert de musique
                classique. Aucune personnalisation à fournir : laissez l&apos;orchestre vous mettre en lumière.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-white/20 bg-black/90 p-3 text-white">
            <h3 className="text-base font-semibold uppercase tracking-[0.15em] text-white">
              Résultat aperçu
            </h3>
            <div className="mt-2 rounded-xl border border-white/20 bg-black/70 p-4">
              {isGenerating ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[0.65rem] text-white/60">
                    <span>Progression</span>
                    <span>{generationProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <p className="text-[0.6rem] text-white/60">
                    Génération en cours… merci de patienter.
                  </p>
                </div>
              ) : generatedImageUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[0.65rem] text-white/60">
                    <span>Progression</span>
                    <span>100%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: "100%" }} />
                  </div>
                  <div className="flex items-center justify-center">
                    <img
                      src={generatedImageUrl}
                      alt="Image générée"
                      className="max-h-[160px] w-full rounded-lg object-contain"
                    />
                  </div>
                  <a
                    href={generatedImageUrl}
                    download
                    className="inline-flex items-center justify-center rounded-full border border-white/40 px-4 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:text-white/80"
                  >
                    Télécharger l&apos;instantané
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[0.65rem] text-white/60">
                    <span>Progression</span>
                    <span>{generationProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <p className="text-[0.65rem] text-white/60">
                    Dès que ton portrait est prêt, il apparaît ici.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <footer
          id="reservation"
          className="rounded-[32px] bg-[var(--foreground)] px-10 py-24 text-white shadow-2xl"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-10">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                Concerto Final — Jeudi 18 décembre
              </p>
              <h2 className="text-3xl font-semibold">Réservez avant le 10 décembre</h2>
              <p className="text-sm text-white/70">
                Laisse-nous ton nom, ton email et un court message : l&apos;équipe te recontacte rapidement
                pour la billetterie.
              </p>
            </div>

            <form onSubmit={handleContactSubmit} className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="contact-name"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white/70"
                >
                  Nom &amp; Prénom
                </label>
                <input
                  id="contact-name"
                  name="contact-name"
                  type="text"
                  autoComplete="name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  placeholder="Ton nom complet"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="contact-email"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white/70"
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  name="contact-email"
                  type="email"
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  placeholder="ton@email.fr"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label
                  htmlFor="contact-message"
                  className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white/70"
                >
                  Message (facultatif)
                </label>
                <textarea
                  id="contact-message"
                  name="contact-message"
                  rows={4}
                  value={contactMessage}
                  onChange={(event) => setContactMessage(event.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white focus:outline-none"
                  placeholder="Partage-nous ton besoin"
                />
              </div>

              {contactError ? (
                <p className="sm:col-span-2 text-[0.7rem] font-medium text-rose-300">{contactError}</p>
              ) : null}
              {contactStatus ? (
                <p className="sm:col-span-2 text-[0.7rem] font-medium text-emerald-300">
                  {contactStatus}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmittingContact}
                className="sm:col-span-2 inline-flex w-full items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-[var(--foreground)] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmittingContact ? "Envoi en cours…" : "Envoyer ma demande"}
              </button>
            </form>
          </div>
        </footer>
      </main>
    </div>
  );
}
