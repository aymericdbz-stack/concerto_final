"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <Card className="w-full max-w-md rounded-[28px] border border-[#eadacf] bg-white/90 shadow-2xl shadow-[#7a1c1a]/10">
      <CardHeader className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMode("login")}
            disabled={isSubmitting}
            className={`text-xs font-semibold uppercase tracking-[0.32em] ${
              mode === "login" ? "text-[#7a1c1a]" : "text-neutral-400"
            }`}
          >
            Connexion
          </button>
          <div className="h-4 w-px bg-neutral-200" />
          <button
            type="button"
            onClick={() => setMode("signup")}
            disabled={isSubmitting}
            className={`text-xs font-semibold uppercase tracking-[0.32em] ${
              mode === "signup" ? "text-[#7a1c1a]" : "text-neutral-400"
            }`}
          >
            Inscription
          </button>
        </div>
        <CardTitle className="text-3xl text-[#4b2a1d]">
          {isSignup ? "Rejoins la saison Concerto" : "Ravie de te retrouver"}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={isSubmitting || loading}
              placeholder="ton.email@email.com"
            />
            {errors.email ? <p className="text-sm text-red-500">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              disabled={isSubmitting || loading}
              placeholder="••••••••"
            />
            {errors.password ? <p className="text-sm text-red-500">{errors.password}</p> : null}
          </div>

          {isSignup ? (
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting || loading}
                placeholder="••••••••"
              />
              {errors.confirm ? <p className="text-sm text-red-500">{errors.confirm}</p> : null}
            </div>
          ) : null}

          {errors.global ? <p className="text-sm text-red-500">{errors.global}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}

          <Button type="submit" disabled={isSubmitting || loading} className="w-full">
            {isSubmitting ? "Veuillez patienter…" : isSignup ? "Créer mon compte" : "Se connecter"}
          </Button>
        </form>

        <div className="text-center text-sm text-neutral-500">
          {mode === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <button
                type="button"
                className="font-semibold text-[#7a1c1a] underline-offset-4 hover:underline"
                onClick={() => setMode("signup")}
                disabled={isSubmitting}
              >
                Inscris-toi
              </button>
            </>
          ) : (
            <>
              Tu as déjà un compte ?{" "}
              <button
                type="button"
                className="font-semibold text-[#7a1c1a] underline-offset-4 hover:underline"
                onClick={() => setMode("login")}
                disabled={isSubmitting}
              >
                Connecte-toi
              </button>
            </>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
