# Concerto Studio – Éditeur d'images IA

Application Next.js (App Router + TypeScript) pour téléverser une image, décrire la transformation attendue et récupérer le rendu généré par le modèle Replicate `google/nano-banana`. Les images sources et générées ainsi que l'historique des projets sont stockés dans Supabase.

## Configuration rapide

1. **Installer les dépendances**
   ```bash
   npm install
   ```
2. **Variables d'environnement** – créer un fichier `.env.local` à la racine :
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_INPUT_BUCKET=input-images
   SUPABASE_OUTPUT_BUCKET=output-images
   REPLICATE_API_TOKEN=...
   # REPLICATE_MODEL est facultatif, la valeur "google/nano-banana" est utilisée par défaut
   REPLICATE_MODEL=google/nano-banana
   ```
   > Les valeurs de production sont déjà fournies dans l'énoncé. Conservez la clé `SUPABASE_SERVICE_ROLE_KEY` côté serveur uniquement.
3. **Lancer le serveur de développement**
   ```bash
   npm run dev
   ```
   Ouvrez ensuite http://localhost:3000 pour accéder à l'interface.

## Fonctionnalités principales

- Formulaire moderne pour téléverser une image, saisir le prompt et lancer la génération.
- Aperçu instantané du fichier sélectionné et état de chargement pendant l'inférence.
- Intégration Replicate pour appeler le modèle `google/nano-banana` avec l'image téléversée.
- Upload des visuels vers Supabase Storage (`input-images` et `output-images`).
- Traçabilité dans la table `projects` (`input_image_url`, `output_image_url`, `prompt`, `status`).

## Structure API

- `POST /api/generate`
  - Reçoit `FormData` (`image`, `prompt`).
  - Dépose l'image source dans Supabase, récupère l'URL publique.
  - Lance Replicate et télécharge l'output retourné.
  - Sauvegarde l'image générée + métadonnées dans Supabase.
  - Retourne `{ imageUrl: string }` côté frontend.

## Aller plus loin

- Ajouter une galerie des projets passés en lisant la table `projects`.
- Mettre en place une gestion d'authentification Supabase si l'éditeur doit être restreint.
- Déployer sur Vercel avec les variables d'environnement correspondantes (onglet *Project Settings* > *Environment Variables*).
# concerto_final
