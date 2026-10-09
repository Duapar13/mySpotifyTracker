# KPIs Wrapped V1

Calculés pour chacune des 3 périodes natives de Spotify, à partir des modèles internes (voir [data-models.md](data-models.md)).

- Calcul : `lib/kpis/wrapped.ts`. Ce sont des fonctions pures, testables sans API.
- Récupération des données : `services/wrapped.ts` (`getWrappedKpis()`).
- Structure de sortie : `types/kpis.ts`.
- Page de vérification : `/dev/wrapped`.

## Liste des KPI V1

| KPI | Champ | Source | Calcul |
|---|---|---|---|
| Top titres | `topTracks` | `/me/top/tracks` | Classement Spotify, 10 premiers |
| Top artistes | `topArtists` | `/me/top/artists` | Classement Spotify, 10 premiers |
| Top genres | `topGenres` | genres des top artistes | Nombre d'artistes portant le genre, puis rang du meilleur artiste en cas d'égalité ; 5 premiers |
| Score mainstream | `stats.mainstreamScore` | popularité des top artistes | Moyenne arrondie (0–100), `null` ignorés |
| Diversité des genres | `stats.distinctGenres` | genres des top artistes | Nombre de genres différents |
| Artistes différents | `stats.distinctArtistsInTopTracks` | artistes des top titres | Nombre d'artistes différents, featurings compris |

Les tailles de top (10 / 10 / 5) sont configurables via `PeriodKpisOptions`. Les genres et les stats sont toujours calculés sur les 50 éléments récupérés, pas seulement sur le top affiché.

## Périodes

| `timeRange` | Libellé | Fenêtre réelle |
|---|---|---|
| `short_term` | 4 dernières semaines | environ 4 semaines |
| `medium_term` | 6 derniers mois | environ 6 mois |
| `long_term` | Depuis environ 1 an | environ 1 an (défini par Spotify, non documenté précisément) |

## Contraintes métier connues

1. **Les périodes sont natives de Spotify et approximatives.** Il n'y a pas de dates de début ou de fin exactes, et les fenêtres sont glissantes : le même appel ne donne pas le même résultat d'un jour à l'autre. `generatedAt` indique la date du calcul.
2. **Ce sont des classements, pas des compteurs.** Spotify ne fournit ni nombre d'écoutes ni temps d'écoute par titre ou par artiste. On peut dire « n°1 », mais pas « écouté 142 fois ». Les compteurs viendront de l'historique accumulé (`PlayEvent`), qui ne couvre que la période depuis la première synchronisation.
3. **Les genres viennent des artistes uniquement.** Spotify n'attribue pas de genre aux titres. Un artiste peut avoir plusieurs genres, qui sont tous comptés. La somme des `share` peut donc dépasser 100 %.
4. **Les genres ne viennent pas de Spotify.** En Development mode, l'API ne renvoie ni `genres` ni `popularity`. Les genres sont donc enrichis depuis des bases ouvertes (voir « Sources des genres » ci-dessous). Si aucun artiste d'une période n'a de genre, `topGenres` vaut `[]` et `genresAvailable` vaut `false` : l'UI masque alors le bloc. `stats.genreCoverage` indique la fiabilité des top genres.
5. **La popularité n'est pas propre à l'utilisateur.** C'est un score global Spotify (0–100) qui évolue dans le temps. Le score mainstream compare donc tes goûts à l'ensemble de Spotify.
6. **Un top est limité à 50 éléments** par période : c'est le maximum de l'API.
7. **Tout ou rien pour Spotify.** Si l'un des 6 appels Spotify échoue, `getWrappedKpis` échoue : un Wrapped partiel serait trompeur. L'enrichissement des genres, lui, ne fait jamais échouer le Wrapped.
8. **Le score mainstream n'est pas disponible** tant que Spotify ne renvoie pas `popularity` : il vaut `null` et doit être masqué côté UI.
9. **Pas de snapshots en V1.** Les périodes mensuelles personnalisées (« mon mois de mars ») demanderont de sauvegarder régulièrement ces résultats. C'est hors périmètre, et la décision est de livrer la V1 sans.

## Sources des genres

Implémentation : `services/artistGenres.ts` (`enrichArtistGenres`), avec la normalisation dans `mappers/genre.ts`.

| Ordre | Source | Correspondance | Coût | Licence |
|---|---|---|---|---|
| 1 | Spotify | — | — | — |
| 2 | Cache `localStorage` (`artist_genres_cache`) | ID Spotify | aucun appel | — |
| 3 | [Wikidata](https://query.wikidata.org/) | propriété `P1902` (Spotify artist ID), genres via `P136` | **1 requête SPARQL** pour tous les artistes | CC0 |
| 4 | [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) | relation URL `open.spotify.com/artist/{id}` | 2 requêtes par artiste, **1 requête/s maximum** | données de base en CC0 ; tags a priori sous licence non commerciale |

- **Jamais de correspondance par nom.** Chercher « Yoshiko » par nom sur MusicBrainz renvoie plus de 7 artistes différents. Sans ID Spotify dans la base, l'artiste reste sans genre.
- **MusicBrainz, genres puis tags.** On prend d'abord les `genres` (une liste contrôlée par MusicBrainz). À défaut, on garde les 3 `tags` les plus votés, qui sont libres et donc plus bruités.
- **Normalisation.** Les libellés sont passés en minuscules, les tirets remplacés par des espaces, et le suffixe « music » supprimé. Par exemple, « Pop-punk » devient « pop punk » et « Heavy metal music » devient « heavy metal ». Conséquence : les libellés s'affichent sans tiret (« post hardcore »).
- **Cache.**
  - Durée : 30 jours par artiste. Le résultat « rien trouvé » est aussi mis en cache.
  - Une panne d'une source n'est **pas** mise en cache : l'artiste est re-tenté au chargement suivant.
- **Durée du premier chargement.** Elle dépend du nombre d'artistes absents de Wikidata : environ 2 s par artiste sur MusicBrainz. Les chargements suivants sont instantanés grâce au cache. Si Wikidata est en panne, tous les artistes passent par MusicBrainz, ce qui peut prendre plusieurs minutes.
- **Mesure de couverture** sur 15 artistes du compte de test : Wikidata a des genres pour 11 artistes. MusicBrainz en trouve pour 3 des 4 restants. Seul Willburd n'a été trouvé nulle part.
