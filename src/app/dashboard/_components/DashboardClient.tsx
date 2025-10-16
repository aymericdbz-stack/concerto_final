"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/supabase";
import { useAuth } from "@/components/AuthContext";
import { DEFAULT_PROMPT } from "@/lib/constants";

type Project = Database["public"]["Tables"]["projects"]["Row"];

interface DashboardClientProps {
  initialProjects: Project[];
}

export function DashboardClient({ initialProjects }: DashboardClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  function formatPaymentStatus(status?: string | null) {
    if (!status) {
      return "inconnu";
    }
    switch (status) {
      case "paid":
        return "payé";
      case "pending":
        return "en attente";
      default:
        return status;
    }
  }

  function formatProjectStatus(status?: string | null) {
    if (!status) {
      return "en attente";
    }
    switch (status) {
      case "completed":
        return "terminée";
      case "processing":
        return "en cours";
      case "pending":
        return "en attente";
      default:
        return status;
    }
  }

  const greeting = useMemo(() => {
    const email = user?.email ?? "Artiste";
    return email.split("@")[0] ?? email;
  }, [user?.email]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!isGenerating) {
      setProgress(0);
      return;
    }

    const interval = window.setInterval(() => {
      setProgress((previous) => {
        if (previous >= 90) {
          return previous;
        }

        const next = previous + Math.random() * 12 + 4;
        return Math.min(90, Math.round(next));
      });
    }, 500);

    return () => window.clearInterval(interval);
  }, [isGenerating]);

  async function handleCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Merci de choisir un portrait avant de lancer la génération.");
      return;
    }

    setIsCreatingCheckout(true);
    setStatusMessage("Création de la session de paiement…");
    setErrorMessage(null);
    let createdProject: Project | null = null;

    const projectId = crypto.randomUUID();
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("image", selectedFile);
    formData.append("prompt", DEFAULT_PROMPT);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        sessionId?: string;
        sessionUrl?: string;
        project?: Project;
        error?: string;
      };

      if (!response.ok || !payload.sessionUrl) {
        throw new Error(payload.error ?? "Impossible de créer la session de paiement.");
      }

      if (payload.project) {
        createdProject = payload.project as Project;
        setProjects((previous) => [payload.project as Project, ...previous]);
      }

      setStatusMessage("Redirection vers la page de paiement…");
      window.location.href = payload.sessionUrl;
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erreur inattendue lors de la préparation du paiement."
      );
      setStatusMessage(null);

      if (createdProject) {
        setProjects((previous) => previous.filter((project) => project.id !== createdProject?.id));
        await fetch(`/api/projects/${createdProject.id}`, { method: "DELETE" }).catch(() => {
          // Ignorer l'erreur de nettoyage côté client.
        });
      }
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  async function handleDelete(projectId: string) {
    setIsDeleting((previous) => ({ ...previous, [projectId]: true }));
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const { error } = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Suppression impossible.");
      }

      setProjects((previous) => previous.filter((project) => project.id !== projectId));
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erreur inattendue lors de la suppression du projet."
      );
    } finally {
      setIsDeleting((previous) => ({ ...previous, [projectId]: false }));
    }
  }

  async function handleLaunchGeneration(projectId: string) {
    setIsGenerating(true);
    setActiveProjectId(projectId);
    setStatusMessage("Génération en cours, cela peut prendre quelques secondes…");
    setErrorMessage(null);
    setProgress(10);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        imageUrl?: string;
        project?: Project;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "La génération a échoué.");
      }

      if (payload.project) {
        setProjects((previous) =>
          previous.map((project) => (project.id === projectId ? (payload.project as Project) : project))
        );
      } else {
        router.refresh();
      }

      setStatusMessage("Image générée avec succès !");
      setProgress(100);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Erreur inattendue lors de la génération."
      );
      setStatusMessage(null);
      setProgress(0);
    } finally {
      setIsGenerating(false);
      setActiveProjectId(null);
    }
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-black via-[#0f0615] to-[#180b25] pb-24">
      <div className="absolute inset-0 -z-10 bg-[url('/Piano%20concert.jpg')] bg-cover bg-center opacity-10" />
      <section className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pt-16 text-white">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-[0.2em] uppercase">
            Bienvenue, {greeting}
          </h1>
          <p className="text-base text-white/70">
            Transforme ton portrait en musicien de scène. Téléverse un fichier PNG, JPG ou WEBP
            (max 10 Mo).
          </p>
        </div>

        <form
          onSubmit={handleCheckout}
          className="grid gap-6 rounded-2xl border border-white/10 bg-black/60 p-6 shadow-xl backdrop-blur md:grid-cols-[1fr_280px]"
        >
          <div className="space-y-4">
            <label className="block text-xs uppercase tracking-[0.3em] text-white/60">
              Portrait
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--accent)] focus:bg-black/50"
                disabled={isGenerating || isCreatingCheckout}
              />
            </label>

            <p className="text-xs text-white/60">
              Ta photo reste privée. Tu peux la supprimer quand tu veux depuis ta galerie.
            </p>

            {previewUrl ? (
              <div className="overflow-hidden rounded-xl border border-white/10">
                <img
                  src={previewUrl}
                  alt="Prévisualisation du portrait"
                  className="max-h-64 w-full object-cover"
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <p>
              Prompt utilisé :
              <span className="mt-2 block font-medium text-white/90">{DEFAULT_PROMPT}</span>
            </p>

            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreatingCheckout || !selectedFile}
            >
              {isCreatingCheckout ? "Redirection…" : "Générer (2€)"}
            </button>

            <div className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
              <span>Prix : 2€ par génération via Stripe Checkout</span>
              {isGenerating ? <span>Progression : {progress}%</span> : null}
              {statusMessage ? <span className="text-emerald-400">{statusMessage}</span> : null}
              {errorMessage ? <span className="text-red-400">{errorMessage}</span> : null}
            </div>
          </div>
        </form>
      </section>

      <section className="mx-auto mt-12 max-w-5xl px-6 text-white">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold uppercase tracking-[0.25em]">Mes projets</h2>
          <button
            type="button"
            className="text-xs uppercase tracking-[0.3em] text-white/60 underline transition hover:text-white"
            onClick={() => router.refresh()}
          >
            Actualiser
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/20 bg-black/50 px-6 py-10 text-center text-white/60">
            Aucune création pour le moment. Lance une génération pour remplir ta galerie.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-lg"
              >
                <div className="relative">
                  {project.output_image_url ? (
                    <img
                      src={project.output_image_url}
                      alt="Portrait généré"
                      className="h-72 w-full object-cover transition group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-72 w-full items-center justify-center bg-black/60 text-center text-xs uppercase tracking-[0.3em] text-white/50">
                      {project.payment_status === "paid"
                        ? "Paiement validé — lancer la génération"
                        : "Paiement Stripe en attente"}
                    </div>
                  )}
                  <div className="absolute right-4 top-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(project.id)}
                      disabled={
                        isDeleting[project.id] || (isGenerating && activeProjectId === project.id)
                      }
                      className="rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white transition hover:bg-red-500/80 disabled:opacity-60"
                    >
                      {isDeleting[project.id] ? "Suppression…" : "Supprimer"}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 px-5 py-4 text-sm text-white/70">
                  <p className="font-medium text-white/90">
                    Créé le {new Date(project.created_at).toLocaleString("fr-FR")}
                  </p>
                  <div className="flex flex-col gap-1 text-xs uppercase tracking-[0.25em] text-white/40">
                    <span>Paiement : {formatPaymentStatus(project.payment_status)}</span>
                    <span>Génération : {formatProjectStatus(project.status)}</span>
                  </div>
                  {project.payment_status === "paid" && project.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={() => handleLaunchGeneration(project.id)}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white transition hover:bg-[var(--accent)] hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isGenerating || project.status === "processing"}
                    >
                      {isGenerating && activeProjectId === project.id
                        ? "Génération…"
                        : "Lancer la génération"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
