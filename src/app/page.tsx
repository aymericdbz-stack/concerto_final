"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useAuth } from "@/components/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONCERT_EVENTS, MAIN_EVENT } from "@/lib/constants";

const FEATURED_MEDIA_DIMENSIONS = {
  width: 2192,
  height: 1566,
};

export default function Home() {
  const { user } = useAuth();

  const instructionMessage = user
    ? "Retrouve toutes tes réservations depuis l’espace abonné accessible en haut à droite."
    : "Pour réserver ta place, connecte-toi ou inscris-toi depuis le menu en haut à droite.";

  const currentEvent = useMemo(() => CONCERT_EVENTS[0] ?? MAIN_EVENT, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#fefaf3] via-[#f7ecdd] to-[#f3dcc8] text-neutral-800">
      <section
        id="concert"
        className="relative overflow-hidden border-b border-[#eadacf]"
      >
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[url('/images/concert-evening.jpg')] bg-cover bg-center opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fefaf3] via-[#fefaf3]/98 to-white/70" />
        </div>

        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-24 pt-28 md:flex-row md:items-center">
          <div className="flex-1 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#7a1c1a]">
              {currentEvent.subtitle}
            </p>
            <h1 className="font-display text-4xl font-semibold leading-tight text-[#401f18] md:text-5xl">
              {currentEvent.title}
            </h1>
            <p className="max-w-lg text-sm font-medium uppercase tracking-[0.28em] text-[#7a1c1a]">
              {instructionMessage}
            </p>
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.26em] text-neutral-500">
              <span>{currentEvent.date}</span>
              <span className="hidden h-1 w-1 rounded-full bg-[#7a1c1a]/40 sm:inline-flex" />
              <span>{currentEvent.time}</span>
              <span className="hidden h-1 w-1 rounded-full bg-[#7a1c1a]/40 sm:inline-flex" />
              <span>{currentEvent.venue}</span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-white/60 shadow-[0_35px_60px_rgba(122,28,26,0.18)] aspect-[2192/1566] w-full md:max-w-[680px] md:ml-auto">
            <Image
              src={currentEvent.heroImage}
              alt={`Ambiance ${currentEvent.title}`}
              width={FEATURED_MEDIA_DIMENSIONS.width}
              height={FEATURED_MEDIA_DIMENSIONS.height}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section
        id="apropos"
        className="mx-auto max-w-6xl px-6 py-20"
      >
        <div className="grid gap-10 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-500">
              À propos de nous
            </p>
            <h2 className="font-display text-3xl text-[#401f18]">
              Venez nous écouter pour aider l&apos;association{" "}
              <a
                href="https://louiseetrosalie.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7a1c1a] underline-offset-4 hover:underline"
              >
                Louise et Rosalie
              </a>
            </h2>
            <p className="text-sm leading-relaxed text-neutral-600">
              Rencontre l&apos;équipe Concerto :
            </p>
            <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-neutral-600">
              <li>Martin au chant</li>
              <li>Hippolyte au cor de chasse</li>
              <li>Douce au chant</li>
              <li>Aymeric au piano</li>
              <li>Pacôme à la contrebasse</li>
              <li>Jean-Baptiste au piano</li>
              <li>Coralie au piano</li>
            </ul>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-[#eadacf] shadow-[0_30px_55px_rgba(122,28,26,0.15)] aspect-[2192/1566] w-full md:max-w-[680px] md:ml-auto">
            <Image
              src="/images/montage-concert.png"
              alt="Moments partagés lors des concerts Concerto"
              width={FEATURED_MEDIA_DIMENSIONS.width}
              height={FEATURED_MEDIA_DIMENSIONS.height}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section
        id="infos"
        className="border-y border-[#eadacf] bg-[#fdf3e3]"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7a1c1a]">
              Infos pratiques
            </p>
            <h2 className="font-display text-3xl text-[#401f18]">Temple de l&apos;Étoile</h2>
            <p className="text-sm leading-relaxed text-neutral-700">
              Situé aux portes de l&apos;Arc de Triomphe, le Temple de l&apos;Étoile offre une acoustique généreuse
              et un décor chaleureux. Notre équipe t&apos;accueille dès 19h15 sur place.
            </p>
            <Card className="max-w-lg border-[#eadacf] bg-white/90 shadow-md shadow-[#7a1c1a]/10">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg">Adresse</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-neutral-600">
                <p>{currentEvent.address}</p>
                <a
                  className="mt-4 inline-flex text-sm font-semibold text-[#7a1c1a] underline-offset-4 hover:underline"
                  href={currentEvent.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ouvrir dans Google Maps →
                </a>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#eadacf] shadow-xl shadow-[#7a1c1a]/12 aspect-[2192/1566] w-full md:max-w-[680px] md:ml-auto">
            <iframe
              title="Temple de l'Étoile sur Google Maps"
              src="https://maps.google.com/maps?q=54-56%20Av.%20de%20la%20Grande%20Arm%C3%A9e%2C%2075017%20Paris&t=&z=15&ie=UTF8&iwloc=&output=embed"
              width={FEATURED_MEDIA_DIMENSIONS.width}
              height={FEATURED_MEDIA_DIMENSIONS.height}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <footer className="bg-[#f6e4d4] py-10 text-center text-xs uppercase tracking-[0.32em] text-neutral-500">
        Concerto © {new Date().getFullYear()} · Saison Sous la voûte de l&apos;Étoile
      </footer>
    </main>
  );
}
