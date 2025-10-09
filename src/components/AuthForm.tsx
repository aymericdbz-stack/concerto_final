"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  initialMode?: AuthMode;
}

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
  global?: string;
}

const MIN_PASSWORD_LENGTH = 6;

export function AuthForm({ initialMode = "login" }: AuthFormProps) {
  const router = useRouter();
  const { signIn, signUp, session, loading } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSignup = mode === "signup";

  useEffect(() => {
    if (session) {
      router.replace("/dashboard");
    }
  }, [router, session]);

  useEffect(() => {
    setErrors({});
    setSuccessMessage(null);
  }, [mode]);

  const validators = useMemo(
    () => ({
      email(value: string) {
        if (!value.trim()) {
          return "L'email est requis.";
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())) {
          return "Adresse email invalide.";
        }
        return null;
      },
      password(value: string) {
        if (!value) {
          return "Le mot de passe est requis.";
        }
        if (value.length < MIN_PASSWORD_LENGTH) {
          return `Minimum ${MIN_PASSWORD_LENGTH} caractères.`;
        }
        return null;
      },
      confirm(value: string) {
        if (!isSignup) {
          return null;
        }
        if (value !== password) {
          return "Les mots de passe ne correspondent pas.";
        }
        return null;
      },
    }),
    [isSignup, password]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailError = validators.email(email);
    const passwordError = validators.password(password);
    const confirmError = validators.confirm(confirmPassword);

    if (emailError || passwordError || confirmError) {
      setErrors({
        email: emailError ?? undefined,
        password: passwordError ?? undefined,
        confirm: confirmError ?? undefined,
      });
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage(null);

    const action = mode === "login" ? signIn : signUp;
    const { error } = await action({ email, password });

    if (error) {
      setErrors({ global: error });
      setIsSubmitting(false);
      return;
    }

    if (mode === "signup") {
      setSuccessMessage(
        "Compte créé. Vérifie ta boîte mail ou connecte-toi directement."
      );
    } else {
      router.replace("/dashboard");
    }

    setIsSubmitting(false);
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/60 p-8 text-white shadow-2xl backdrop-blur">
      <div className="mb-6 flex items-center justify-between text-sm uppercase tracking-[0.3em] text-white/70">
        <button
          type="button"
          className={`pb-2 transition ${
            mode === "login"
              ? "border-b-2 border-[var(--accent)] text-white"
              : "hover:text-white"
          }`}
          onClick={() => setMode("login")}
          disabled={isSubmitting}
        >
          Connexion
        </button>
        <button
          type="button"
          className={`pb-2 transition ${
            mode === "signup"
              ? "border-b-2 border-[var(--accent)] text-white"
              : "hover:text-white"
          }`}
          onClick={() => setMode("signup")}
          disabled={isSubmitting}
        >
          Inscription
        </button>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-white/60">
            Email
          </label>
          <input
            type="email"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition focus:border-[var(--accent)] focus:bg-black/50"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            disabled={isSubmitting || loading}
          />
          {errors.email ? <p className="text-sm text-red-400">{errors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-white/60">
            Mot de passe
          </label>
          <input
            type="password"
            className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition focus:border-[var(--accent)] focus:bg-black/50"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            disabled={isSubmitting || loading}
          />
          {errors.password ? (
            <p className="text-sm text-red-400">{errors.password}</p>
          ) : null}
        </div>

        {isSignup ? (
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-white/60">
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-base text-white outline-none transition focus:border-[var(--accent)] focus:bg-black/50"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting || loading}
            />
            {errors.confirm ? (
              <p className="text-sm text-red-400">{errors.confirm}</p>
            ) : null}
          </div>
        ) : null}

        {errors.global ? (
          <p className="text-sm text-red-400">{errors.global}</p>
        ) : null}

        {successMessage ? (
          <p className="text-sm text-emerald-400">{successMessage}</p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--accent)] py-3 text-sm font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || loading}
        >
          {isSubmitting ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : "Créer un compte"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/70">
        {mode === "login" ? (
          <>
            Pas de compte ?{" "}
            <button
              type="button"
              className="text-[var(--accent)] underline"
              onClick={() => setMode("signup")}
              disabled={isSubmitting}
            >
              Inscris-toi
            </button>
          </>
        ) : (
          <>
            Déjà inscrit ?{" "}
            <button
              type="button"
              className="text-[var(--accent)] underline"
              onClick={() => setMode("login")}
              disabled={isSubmitting}
            >
              Connecte-toi
            </button>
          </>
        )}
      </p>

      {mode === "login" ? (
        <p className="mt-4 text-center text-xs uppercase tracking-[0.3em] text-white/40">
          Nouveau ici ? <Link href="/signup" className="text-[var(--accent)]">Créer un compte</Link>
        </p>
      ) : (
        <p className="mt-4 text-center text-xs uppercase tracking-[0.3em] text-white/40">
          Tu as déjà un compte ?{" "}
          <Link href="/login" className="text-[var(--accent)]">
            Connecte-toi
          </Link>
        </p>
      )}
    </div>
  );
}
