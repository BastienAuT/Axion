# Axion Interventions

Application SaaS de gestion d’interventions terrain pour artisans et équipes de maintenance.

## Stack

- Bun 1.3+
- Next.js 16 avec App Router et Turbopack
- TypeScript et design system CSS sur mesure
- Drizzle ORM avec SQLite via `bun:sqlite`
- Better Auth 1.7 avec sessions persistantes et autorisations par organisation
- PWA avec shell de navigation disponible hors connexion

## Démarrage

```bash
bun install
bun run dev
```

La commande de développement applique les migrations puis démarre Next.js sur
`http://localhost:3000`.

## Commandes

```bash
bun run dev          # développement Next.js/Turbopack
bun run build        # build de production
bun run start        # serveur de production avec Bun
bun run check        # types, lint, tests et build
bun run db:generate  # générer une migration Drizzle
bun run auth:schema  # régénérer le schéma Better Auth
bun run db:migrate   # appliquer les migrations SQLite
bun run db:studio    # explorer la base locale
```

Copiez `.env.example` vers `.env.local` avant de personnaliser la configuration :

```dotenv
DATABASE_PATH=./data/axion.sqlite
APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=un-secret-aleatoire-de-32-caracteres-minimum
SEED_DEMO_DATA=true
```

La base locale est créée dans `data/axion.sqlite`. `APP_URL` doit contenir
l’origine publique complète de l’application en production, par exemple
`https://axion.example.com`. Elle sert à générer des métadonnées sociales et
configure l’origine de confiance de Better Auth sans faire confiance à l’en-tête
`Host` de la requête. `BETTER_AUTH_SECRET` est obligatoire en production et doit
être un secret aléatoire d’au moins 32 caractères.

Les migrations sont appliquées automatiquement par `bun run dev`. Cette étape
amorce aussi, de façon idempotente, le tenant de démonstration, ses clients,
leurs sites et ses documents commerciaux. Il n’y a rien à créer manuellement
dans Prisma : le projet utilise Drizzle et le fichier SQLite ci-dessus.

## PWA et cache hors connexion

Le manifeste utilise l’identité indigo d’Axion, une icône SVG et des variantes
PNG 192/512 px, dont une version maskable. Le service worker précharge uniquement
les ressources publiques, purge ses anciennes versions et ne met jamais en cache
les routes `/api` ni les pages HTML authentifiées. En cas de coupure, les données
déjà ouvertes restent visibles, puis une page neutre remplace toute nouvelle
navigation ; les mutations métier nécessitent toujours une connexion.
La carte de partage Open Graph est générée par `app/opengraph-image.tsx` avec la
même identité visuelle.

## Parcours disponibles

- responsable : tableau de bord, planning, interventions, clients, rapports et facturation ;
- technicien : tournée mobile, navigation, statuts et rapport signé ;
- client : suivi de l’intervention et accès aux documents.

## Authentification et mode de démonstration

L’application utilise Better Auth avec identifiant/mot de passe, cookie de
session HTTP-only, limitation de débit persistante et appartenance à une
organisation. Le rôle n’est jamais choisi dans l’interface : il est lu dans la
session et contrôlé à nouveau par chaque route API. Les données sont filtrées par
organisation, puis par technicien affecté ou client associé selon le profil.

En développement, `bun run db:migrate` crée cinq comptes de démonstration. Les
trois raccourcis proposés sur `/login` utilisent le mot de passe
`Axion-Demo-2026!` (personnalisable avec `DEMO_AUTH_PASSWORD`) :

- responsable : `claire@axion.local` ;
- technicien : `nicolas@axion.local` ;
- client : `thomas@atelier-berthier.local`.

Les exemples locaux restent visibles à côté des données SQLite et sont signalés
dans l’interface par l’état « Démo + API ». Les interventions et les rapports
signés créés via l’API sont persistés et
journalisés. Le tracé vectoriel de la signature est conservé avec le rapport,
affiché comme preuve, ajouté au PDF et son empreinte SHA-256 est inscrite dans le
journal d’audit. Les clients, leurs sites, les devis et les factures sont aussi
persistés. La numérotation commerciale est séquentielle par année et par type,
et les transitions de statut d’un devis sont distinctes de celles d’une facture.

Les photos JPEG/PNG jointes à un rapport sont vérifiées d’après leur contenu,
limitées à 2 Mo chacune, conservées dans SQLite et consultables depuis la fiche.
Leur empreinte SHA-256 est journalisée. Ce stockage intégré convient à une
installation locale ou sur serveur persistant ; un déploiement horizontal devra
le remplacer par un stockage objet privé.

## Passage en production

Définissez `SEED_DEMO_DATA=false`, utilisez un secret unique, servez l’application
en HTTPS et conservez la base sur un volume persistant. L’amorçage de démonstration
est désactivé par défaut quand `NODE_ENV=production`. Pour les invitations et la
réinitialisation des mots de passe, il restera à connecter le fournisseur d’e-mail
transactionnel choisi. Un déploiement multi-instance devra aussi migrer SQLite
vers PostgreSQL et les photos vers un stockage objet privé.
