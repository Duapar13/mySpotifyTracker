import { groupBy } from '@/lib/aggregations';
import { GenreStat, PeriodKpis, PeriodStats, Ranked } from '@/types/kpis';
import { Artist, Track } from '@/types/models';
import { TimeRange } from '@/types/spotify';

// Fonctions pures : aucun appel API, testables avec des données fictives.
// Les entrées sont les listes déjà classées par Spotify (index 0 = n°1).

// Fenêtres approximatives, définies par Spotify (pas de dates exactes)
export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  short_term: '4 dernières semaines',
  medium_term: '6 derniers mois',
  long_term: 'Depuis environ 1 an',
};

export interface PeriodKpisOptions {
  topTracksCount?: number;
  topArtistsCount?: number;
  topGenresCount?: number;
}

export function rank<T>(items: T[], count: number): Ranked<T>[] {
  return items.slice(0, count).map((item, index) => ({ rank: index + 1, item }));
}

// Spotify ne donne pas de genre aux titres, seulement aux artistes : les top genres sont
// déduits des top artistes. Classement : nombre d'artistes portant le genre, puis, à égalité,
// le genre dont l'artiste le mieux classé est le plus haut.
export function computeTopGenres(artists: Artist[], count: number): GenreStat[] {
  const artistsWithGenres = artists.filter((artist) => artist.genres.length > 0);
  if (artistsWithGenres.length === 0) return [];

  // Une entrée par couple (genre, artiste), en gardant le rang de l'artiste dans le top
  const entries = artists.flatMap((artist, index) =>
    artist.genres.map((genre) => ({ genre, artist, artistRank: index + 1 }))
  );

  return [...groupBy(entries, (entry) => entry.genre)]
    .map(([genre, group]) => ({
      genre,
      artistCount: group.length,
      share: group.length / artistsWithGenres.length,
      bestRank: Math.min(...group.map((entry) => entry.artistRank)),
      topArtistNames: group.slice(0, 3).map((entry) => entry.artist.name),
    }))
    .sort((a, b) => b.artistCount - a.artistCount || a.bestRank - b.bestRank)
    .slice(0, count)
    .map(({ genre, artistCount, share, topArtistNames }) => ({
      genre,
      artistCount,
      share,
      topArtistNames,
    }));
}

export function computePeriodStats(tracks: Track[], artists: Artist[]): PeriodStats {
  // popularity null = inconnue : exclue de la moyenne (ne compte pas comme 0)
  const popularities = artists
    .map((artist) => artist.popularity)
    .filter((popularity): popularity is number => popularity !== null);

  return {
    mainstreamScore:
      popularities.length > 0
        ? Math.round(popularities.reduce((sum, value) => sum + value, 0) / popularities.length)
        : null,
    distinctGenres: new Set(artists.flatMap((artist) => artist.genres)).size,
    genreCoverage:
      artists.length > 0
        ? artists.filter((artist) => artist.genres.length > 0).length / artists.length
        : 0,
    // Tous les artistes crédités comptent, featurings compris
    distinctArtistsInTopTracks: new Set(
      tracks.flatMap((track) => track.artists.map((artist) => artist.id))
    ).size,
  };
}

// Les stats et les genres sont calculés sur toutes les données reçues (jusqu'à 50),
// seuls les tops affichés sont tronqués : un top 5 de genres sur 10 artistes serait peu fiable.
export function computePeriodKpis(
  timeRange: TimeRange,
  tracks: Track[],
  artists: Artist[],
  { topTracksCount = 10, topArtistsCount = 10, topGenresCount = 5 }: PeriodKpisOptions = {}
): PeriodKpis {
  const topGenres = computeTopGenres(artists, topGenresCount);

  return {
    timeRange,
    label: TIME_RANGE_LABELS[timeRange],
    topTracks: rank(tracks, topTracksCount),
    topArtists: rank(artists, topArtistsCount),
    topGenres,
    genresAvailable: topGenres.length > 0,
    stats: computePeriodStats(tracks, artists),
  };
}
