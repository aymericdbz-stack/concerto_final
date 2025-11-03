"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import type { Database } from "@/types/supabase";
import { useAuth } from "@/components/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_CURRENCY, MAIN_EVENT } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Registration = Database["public"]["Tables"]["registrations"]["Row"];

interface DashboardClientProps {
  initialRegistrations: Registration[];
}

function formatAmount(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function DashboardClient({ initialRegistrations }: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, supabase } = useAuth();

  const [registrations, setRegistrations] = useState<Registration[]>(initialRegistrations);
  const [highlightedRegistration, setHighlightedRegistration] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("25");

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStatusToast, setShowStatusToast] = useState(false);
  const [confirmedRegistrationId, setConfirmedRegistrationId] = useState<string | null>(null);
  const [ticketEmailSentId, setTicketEmailSentId] = useState<string | null>(null);

  useEffect(() => {
    setRegistrations(initialRegistrations);
  }, [initialRegistrations]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    async function refreshRegistrations() {
      try {
        const { data, error } = await supabase
          .from("registrations")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[dashboard] Impossible de rafraîchir les inscriptions:", error.message);
          return;
        }

        if (isMounted && data) {
          setRegistrations(data as Registration[]);
        }
      } catch (error) {
        console.error("[dashboard] Erreur inattendue lors du rafraîchissement des inscriptions:", error);
      }
    }

    refreshRegistrations();

    return () => {
      isMounted = false;
    };
  }, [supabase, user]);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    const statut = searchParams.get("statut");
    const registrationId = searchParams.get("inscription");

    if (statut === "confirmation") {
      setStatusMessage("Merci ! Ta participation est confirmée. Ton QR code est envoyé par email.");
      if (registrationId) {
        setConfirmedRegistrationId(registrationId);
      }
      setErrorMessage(null);
    } else if (statut === "annule") {
      setErrorMessage("Le paiement a été annulé. Tu peux réessayer quand tu veux.");
      setStatusMessage(null);
      setConfirmedRegistrationId(null);
    }

    if (statut) {
      router.replace(pathname, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const registrationId = searchParams.get("inscription");
    if (registrationId) {
      setHighlightedRegistration(registrationId);
    }
  }, [searchParams]);

  const paidRegistrations = useMemo(
    () =>
      registrations.filter(
        (registration) => registration.status === "paid" || registration.id === confirmedRegistrationId
      ),
    [registrations, confirmedRegistrationId]
  );

  useEffect(() => {
    if (!statusMessage) {
      setShowStatusToast(false);
      return;
    }

    setShowStatusToast(true);
    const timeoutId = window.setTimeout(() => {
      setShowStatusToast(false);
      setStatusMessage(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  const handleDismissStatusToast = () => {
    setShowStatusToast(false);
    setStatusMessage(null);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const parsedAmount = Number.parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Merci de renseigner un montant supérieur à 0 €.");
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setErrorMessage("Tous les champs sont obligatoires pour valider ta participation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          amount: parsedAmount,
          eventId: MAIN_EVENT.id,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        sessionUrl?: string;
        error?: string;
        registration?: Registration;
      };

      if (!response.ok || !payload.sessionUrl) {
        throw new Error(payload.error ?? "Impossible de créer la session de paiement Stripe.");
      }

      if (payload.registration) {
        setRegistrations((previous) => [payload.registration as Registration, ...previous]);
      }

      window.location.href = payload.sessionUrl;
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Une erreur inattendue est survenue."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!user || !confirmedRegistrationId || ticketEmailSentId === confirmedRegistrationId) {
      return;
    }

    let isCancelled = false;

    async function refreshUserRegistrations() {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRegistrations(data as Registration[]);
      } else if (error) {
        console.error("[dashboard] Rafraîchissement des inscriptions impossible:", error.message);
      }
    }

    async function sendTicketAndRefresh() {
      try {
        const response = await fetch(`/api/registrations/${confirmedRegistrationId}/send-ticket`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          sent?: boolean;
          qrReady?: boolean;
        };

        if (!isCancelled) {
          if (response.ok) {
            setTicketEmailSentId(confirmedRegistrationId);
            if (payload.sent) {
              setStatusMessage("Ton billet est confirmé. Un email vient de t'être envoyé.");
            } else {
              setStatusMessage("Ton billet est prêt. Télécharge-le ou récupère-le depuis ton espace.");
            }
          } else {
            console.error("[dashboard] Envoi du billet impossible:", payload.error);
            setErrorMessage(
              payload.error ??
                "Envoi automatique indisponible pour le moment. Télécharge ton billet ci-dessous."
            );
          }

          await refreshUserRegistrations();
        }
      } catch (error) {
        console.error("[dashboard] Appel send-ticket impossible:", error);
      }
    }

    (async () => {
      await refreshUserRegistrations();
      await sendTicketAndRefresh();
    })();

    return () => {
      isCancelled = true;
    };
  }, [confirmedRegistrationId, ticketEmailSentId, supabase, user]);

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
      <section className="grid gap-10 md:grid-cols-[1fr_0.95fr] md:items-start">
        <Card className="border-[#eadacf] bg-white/95 shadow-xl shadow-[#7a1c1a]/10">
          <CardHeader className="space-y-4">
            <span className="text-xs font-semibold uppercase tracking-[0.32em] text-[#7a1c1a]">
              Concert
            </span>
            <CardTitle className="text-3xl leading-tight text-[#401f18]">{MAIN_EVENT.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-hidden rounded-[24px] border border-[#eadacf]/70">
              <Image
                src={MAIN_EVENT.heroImage}
                alt={MAIN_EVENT.title}
                width={880}
                height={600}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="grid gap-4 text-sm text-neutral-600 md:grid-cols-2">
              <div>
                <p className="font-semibold text-[#7a1c1a] uppercase tracking-[0.22em] text-xs mb-1">
                  Date
                </p>
                <p>{MAIN_EVENT.date}</p>
                <p>{MAIN_EVENT.time}</p>
              </div>
              <div>
                <p className="font-semibold text-[#7a1c1a] uppercase tracking-[0.22em] text-xs mb-1">
                  Lieu
                </p>
                <p>{MAIN_EVENT.venue}</p>
                <p>{MAIN_EVENT.address}</p>
              </div>
            </div>
            <Button asChild variant="ghost" className="px-0 text-[#7a1c1a] hover:bg-transparent">
              <a href={MAIN_EVENT.googleMapsUrl} target="_blank" rel="noopener noreferrer">
                Voir l&apos;itinéraire sur Google Maps →
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#eadacf] bg-white/95 shadow-xl shadow-[#7a1c1a]/10">
          <CardHeader className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-500">
              Réserver ma place
            </span>
            <CardTitle className="text-2xl text-[#401f18]">
              Choisis ton montant de participation
            </CardTitle>
            <p className="text-sm text-neutral-600">
              Les contributions sont libres et reversées intégralement pour rémunérer les artistes et
              l&apos;équipe de production.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Camille"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Dupont"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ton.email@email.com"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+33 6 12 34 56 78"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Montant de participation (€)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={1}
                  step="0.5"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-neutral-500">
                  Le paiement est sécurisé par Stripe. Le QR code s&apos;affiche dans ta boîte mail après validation.
                </p>
              </div>

              {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Préparation du paiement…" : "Passer au paiement Stripe"}
              </Button>
            </form>

            {paidRegistrations.length > 0 ? (
              <p className="mt-6 rounded-xl bg-[#f6e4d4] px-4 py-3 text-sm text-[#7a1c1a]">
                Merci de soutenir la scène Concerto ! Tu peux retrouver ton QR code ci-dessous à tout moment.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-500">
              Mes réservations
            </p>
            <h2 className="font-display text-2xl text-[#401f18]">QR codes &amp; suivis</h2>
          </div>
          <span className="text-sm text-neutral-500">
            {paidRegistrations.length === 0
              ? "Aucun billet confirmé"
              : `${paidRegistrations.length} billet${paidRegistrations.length > 1 ? "s" : ""} confirmé${paidRegistrations.length > 1 ? "s" : ""}`}
          </span>
        </div>

        {paidRegistrations.length === 0 ? (
          <Card className="border-[#eadacf] bg-white/90 text-neutral-500">
            <CardContent className="py-12 text-center text-sm">
              Aucun paiement finalisé pour le moment. Tes billets confirmés apparaîtront ici.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {paidRegistrations.map((registration) => {
              const isHighlighted = highlightedRegistration === registration.id;
              const amountLabel = formatAmount(registration.amount, registration.currency ?? DEFAULT_CURRENCY);
              const isRecentlyConfirmed = registration.id === confirmedRegistrationId;
              return (
                <Card
                  key={registration.id}
                  className={cn(
                    "border-[#eadacf] bg-white/95 shadow-lg shadow-[#7a1c1a]/10 transition",
                    isHighlighted ? "ring-2 ring-[#7a1c1a]" : "hover:shadow-xl"
                  )}
                >
                  <CardHeader className="space-y-1">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.26em]">
                      <span className="text-neutral-500">{MAIN_EVENT.title}</span>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]",
                          "bg-emerald-200/35 text-emerald-700"
                        )}
                      >
                        Confirmée
                      </span>
                    </div>
                    <CardTitle className="text-lg text-[#401f18]">
                      {registration.first_name} {registration.last_name}
                    </CardTitle>
                    <p className="text-sm text-neutral-500">{registration.email}</p>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-neutral-600">
                    <p>
                      <span className="font-semibold text-[#7a1c1a]">Participation :</span> {amountLabel}
                    </p>
                    <p>
                      <span className="font-semibold text-[#7a1c1a]">Téléphone :</span> {registration.phone}
                    </p>
                    <div className="space-y-4 rounded-2xl border border-[#eadacf] bg-[#fffaf5] p-4 text-center">
                      <p className="text-xs uppercase tracking-[0.28em] text-[#7a1c1a]">
                        QR code à présenter
                      </p>
                      {registration.qr_code_data_url ? (
                        <Image
                          src={registration.qr_code_data_url}
                          alt={`QR code pour ${registration.first_name}`}
                          width={160}
                          height={160}
                          unoptimized
                          className="mx-auto h-40 w-40 rounded-2xl border border-white shadow-md shadow-[#7a1c1a]/15"
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-[#eadacf] bg-white text-xs text-neutral-400">
                          QR code en cours de génération…
                        </div>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {registration.qr_code_data_url ? (
                          <Button
                            asChild
                            variant="ghost"
                            className="px-0 text-[#7a1c1a] hover:bg-transparent"
                          >
                            <a href={registration.qr_code_data_url} download={`concerto-qr-${registration.id}.png`}>
                              Télécharger le QR code
                            </a>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            disabled
                            className="px-0 text-neutral-400"
                          >
                            QR code indisponible
                          </Button>
                        )}
                        <Button
                          asChild
                          className="w-full bg-[#7a1c1a] text-white hover:bg-[#651815]"
                        >
                          <a
                            href={`/api/registrations/${registration.id}/ticket`}
                            download={`concerto-billet-${registration.id}.pdf`}
                          >
                            Télécharger le billet PDF
                          </a>
                        </Button>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {registration.qr_code_data_url
                          ? "Présente ce QR code ou ton billet PDF à l'entrée."
                          : "Ton billet se prépare. Utilise le bouton PDF pour le récupérer immédiatement."}
                      </p>
                      {isRecentlyConfirmed ? (
                        <p className="text-xs text-neutral-400">
                          Un email de confirmation est envoyé à l&apos;adresse {registration.email}.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
    {statusMessage && showStatusToast ? (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 max-w-xs rounded-xl border border-emerald-200 bg-white/95 p-4 shadow-lg shadow-emerald-200/40"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-600">Participation confirmée</p>
            <p className="text-sm text-neutral-700">{statusMessage}</p>
          </div>
          <button
            type="button"
            onClick={handleDismissStatusToast}
            className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Fermer la notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    ) : null}
    </>
  );
}
