# Axion Interventions

Application SaaS de gestion d’interventions terrain pour artisans et équipes de maintenance.

## Stack

- Bun 1.3+
- Next.js 16 avec App Router et Turbopack
- TypeScript et design system CSS sur mesure
- Drizzle ORM avec libSQL : SQLite local et Turso en production
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
bun run db:migrate   # appliquer les migrations SQLite/libSQL
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

La base locale est créée dans `data/axion.sqlite`. En production, les variables
`TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN` remplacent automatiquement ce fichier.
`APP_URL` doit contenir
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

## Organisation du frontend

`app/AxionApp.tsx` assemble la navigation, les écrans et les modales des trois
profils. Les exemples de démonstration restent disponibles pour explorer les
parcours responsable, technicien et client.

- `app/axion/views/` : un fichier par écran ; `views.tsx` centralise leurs exports.
- `use-axion-data.ts` : chargement des données, exemples, synchronisation et connexion.
- `use-intervention-actions.ts` : création et changements de statut des interventions.
- `use-commerce-actions.ts` : création des clients et gestion des documents commerciaux.
- `use-report-editor.ts` : saisie, signature, photos et finalisation des rapports.
- `report-drafts.ts` et `report-pdf.ts` : brouillons locaux et export PDF.
- `model.ts` et `primitives.tsx` : types métier, données de démonstration et composants partagés.

Les tests de parcours dans `tests/axion-product.test.ts` suivent cette structure ;
les tests API continuent de vérifier les validations, la persistance et les accès.

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
limitées à 2 Mo chacune, conservées dans libSQL et consultables depuis la fiche.
Leur empreinte SHA-256 est journalisée. Un plafond applicatif de 25 Mo de photos
par organisation protège le quota gratuit de la base.

## Déploiement Vercel + Turso à 0 €

1. Créez une base sur l’offre gratuite Turso, sans activer les dépassements payants.
2. Importez ce dépôt dans un projet personnel Vercel utilisant l’offre Hobby.
3. Ajoutez ces variables aux environnements Production et Preview :

```dotenv
TURSO_DATABASE_URL=libsql://votre-base.turso.io
TURSO_AUTH_TOKEN=votre-jeton
BETTER_AUTH_SECRET=un-secret-aleatoire-unique-de-32-caracteres-minimum
SEED_DEMO_DATA=true
DEMO_AUTH_PASSWORD=un-mot-de-passe-de-demo-fort
```

`APP_URL` est facultatif sur Vercel : l’application utilise automatiquement le
domaine du déploiement. Le build applique les migrations Drizzle et l’amorçage
idempotent. Pour un portfolio, gardez `SEED_DEMO_DATA=true`. Pour une vraie
utilisation, mettez-le à `false` après avoir créé les comptes nécessaires.

Le projet n’utilise aucun service de stockage payant séparé. Vercel et Turso
bloquent les usages lorsque leurs quotas gratuits sont atteints si aucun
dépassement payant n’est activé. Les invitations et réinitialisations par e-mail
ne sont volontairement pas branchées afin de ne pas ajouter de coût externe.
