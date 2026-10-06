# My Spotify Tracker

Application Next.js (TypeScript, Tailwind) qui se connecte à Spotify et calcule un « Wrapped » à la demande : top titres, top artistes, top genres et quelques statistiques, sur les 3 périodes natives de Spotify. Les écoutes récentes sont aussi accumulées dans le navigateur pour construire un historique plus long que celui de l'API.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner NEXT_PUBLIC_SPOTIFY_CLIENT_ID
npm run dev
```

Ouvrir l'app sur `http://[::1]:3000` (Spotify refuse `localhost`). Détails de l'app Spotify et des redirect URIs : [docs/spotify-app.md](docs/spotify-app.md).

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `development`, `preview` ou `production` (active les logs de debug en dev) |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Client ID de l'app Spotify (pas de client secret : flow PKCE) |
| `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` | Doit être déclarée dans le dashboard Spotify |

### Scripts

- `npm run dev` : serveur de développement
- `npm run build` / `npm start` : build et serveur de production
- `npm run lint` : ESLint

## Architecture

```
API Spotify ──► services/ ──► mappers/ ──► types/models.ts ──► lib/ (KPI, agrégations) ──► components/, app/
```

| Dossier | Contenu |
|---|---|
| `services/` | Appels à l'API Spotify (client centralisé, auth PKCE, session, historique) |
| `mappers/` | Validation des réponses brutes et conversion vers les modèles internes |
| `types/` | Types de l'API brute, modèles internes, KPI |
| `lib/` | Logique pure : agrégations, timeline, calcul des KPI |
| `components/`, `app/` | Interface et routes |

L'authentification est entièrement côté navigateur (PKCE) : la session est stockée dans le `localStorage`.

## Pages de vérification

Pages `/dev/*` pour contrôler chaque brique sans UI finale : `/dev/top-tracks`, `/dev/top-artists`, `/dev/recently-played`, `/dev/liked-tracks`, `/dev/wrapped`.

## Documentation

- [docs/data-models.md](docs/data-models.md) : modèles internes et règles d'architecture
- [docs/kpis.md](docs/kpis.md) : KPI Wrapped V1 et contraintes métier
- [docs/spotify-app.md](docs/spotify-app.md) : configuration de l'app Spotify
