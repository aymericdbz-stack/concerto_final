import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Inscription — Concerto",
};

export default function SignupPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center bg-gradient-to-b from-[#fdf8ee] via-[#f6eadd] to-[#f2d8c4] px-6 py-16">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="h-full w-full bg-[url('/images/concert-evening.jpg')] bg-cover bg-center opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/95 to-[#f2d8c4]/80" />
      </div>
      <AuthForm initialMode="signup" />
    </main>
  );
}
