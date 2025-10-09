import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Inscription — Concerto Final",
};

export default function SignupPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-br from-black via-black to-[#1a0b2e] px-6 py-16">
      <div className="absolute inset-0 -z-10 bg-[url('/Piano%20concert.jpg')] bg-cover bg-center opacity-10" />
      <AuthForm initialMode="signup" />
    </main>
  );
}
