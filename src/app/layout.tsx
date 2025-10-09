import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { SiteHeader } from "@/components/SiteHeader";

const manrope = Manrope({
  variable: "--font-sans-primary",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Concerto Final – Portraits partagés",
  description:
    "Partagez votre portrait pour l'expérience immersive du concert Concerto Final du 18 décembre.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} ${cormorant.variable} antialiased`}>
        <AuthProvider>
          <SiteHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
