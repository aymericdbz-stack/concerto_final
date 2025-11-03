# Concerto — Réservation de concerts intimistes

Application Next.js (App Router + TypeScript) pensée pour gérer un unique concert acoustique : **« Sous la voûte de l'Étoile »** au Temple de l'Étoile (Paris). Le site propose une refonte claire et lumineuse basée sur les composants *shadcn/ui* et permet :

- la création d’un espace abonné via Supabase Auth ;
- la réservation d’un concert avec un **montant de participation libre** réglé sur Stripe ;
- l’envoi automatique d’un email de confirmation avec QR code (via Resend) une fois le paiement confirmé ;
- la consultation et le téléchargement du QR code directement depuis le tableau de bord de l’abonné.

## Installation rapide

1. **Dépendances**
   ```bash
   npm install
   ```
2. **Variables d’environnement** – créer un fichier `.env.local` à la racine :
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   STRIPE_SECRET_KEY=...
   STRIPE_WEBHOOK_SECRET=...
   NEXT_PUBLIC_URL=http://localhost:3000
   RESEND_API_KEY=...
   RESEND_FROM_EMAIL=concerto@example.com
   ```
   > `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` et `RESEND_API_KEY` doivent rester côté serveur.  
   > `NEXT_PUBLIC_URL` doit pointer vers l’URL publique du site (sans slash final).

3. **Lancement**
   ```bash
   npm run dev
   ```
   Puis ouvrir http://localhost:3000.

## Modèle de données

La table Supabase `registrations` (cf. `src/types/supabase.ts`) contient :

| Colonne | Type | Description |
| --- | --- | --- |
| `id` | UUID | Identifiant unique |
| `user_id` | UUID | Référence à l’utilisateur Supabase |
| `event_id` | text | Identifiant du concert (`sous-la-voute-de-l-etoile-20250116`) |
| `first_name` / `last_name` / `email` / `phone` | text | Coordonnées participant |
| `amount` / `currency` | numeric / text | Don libre choisi par l’abonné |
| `status` | enum | `pending`, `paid`, `cancelled` |
| `stripe_checkout_session_id` / `stripe_payment_intent_id` | text | Références Stripe |
| `qr_code_data_url` | text | QR code généré (PNG encodé en Data URL) |
| `created_at` | timestamptz | Date de création |

## Webhooks & emails

- Le webhook `POST /api/webhooks/stripe` vérifie la signature Stripe, marque la réservation comme payée et génère un QR code via `qrcode`.
- L’email de confirmation est envoyé avec Resend (`RESEND_FROM_EMAIL` doit être un domaine vérifié). Le QR code base64 est intégré directement dans le message.

## Développement

- Couleurs et typographies sont centralisées dans `src/app/globals.css`.
- Les composants *shadcn/ui* utilisés (Button, Input, Card, Label…) se trouvent dans `src/components/ui`.
- L’événement affiché est défini dans `src/lib/constants.ts`. Pour ajouter de nouveaux concerts, étendre `CONCERT_EVENTS` et adapter le tableau de bord.

## Scripts utiles

- `npm run dev` — lancement en mode développement
- `npm run build` — compilation production
- `npm start` — serveur de production
- `npm run lint` — linting avec ESLint

## Remarques

- Veiller à configurer Stripe Checkout avec l’URL de retour (`NEXT_PUBLIC_URL`) et à exposer le webhook Stripe à `/api/webhooks/stripe`.
- Les tests de paiement peuvent s’effectuer avec une carte de test Stripe (`4242 4242 4242 4242`).
- Pour un déploiement sur Vercel, déclarer l’ensemble des variables d’environnement ci-dessus dans *Project Settings → Environment Variables*.
