import { Artist, Track } from '@/types/models';
import { TimeRange } from '@/types/spotify';

// Sortie de la couche KPI, pensée pour être affichée telle quelle par l'UI.
// Liste des KPI V1 et contraintes métier : docs/kpis.md

export interface Ranked<T> {
  // 1 = premier
  rank: number;
  item: T;
}

export interface GenreStat {
  genre: string;
  // Nombre d'artistes du top qui portent ce genre
  artistCount: number;
  // Part des artistes du top (avec au moins un genre) qui portent ce genre, entre 0 et 1
  share: number;
  // Artistes les mieux classés portant ce genre, pour illustrer ("pop : Dua Lipa, The Weeknd…")
  topArtistNames: string[];
}

export interface PeriodStats {
  // Moyenne de popularité (0–100) des top artistes : plus c'est haut, plus les goûts sont mainstream.
  // null si Spotify ne fournit pas la popularité.
  mainstreamScore: number | null;
  // Nombre de genres différents parmi les top artistes
  distinctGenres: number;
  // Part des top artistes (0–1) pour lesquels au moins un genre est connu : fiabilité des top genres
  genreCoverage: number;
  // Nombre d'artistes différents crédités sur les top tracks
  distinctArtistsInTopTracks: number;
}

export interface PeriodKpis {
  timeRange: TimeRange;
  // Libellé prêt à afficher, ex. "4 dernières semaines"
  label: string;
  topTracks: Ranked<Track>[];
  topArtists: Ranked<Artist>[];
  topGenres: GenreStat[];
  // false si Spotify ne renvoie aucun genre (le bloc genres est alors à masquer côté UI)
  genresAvailable: boolean;
  stats: PeriodStats;
}

export interface WrappedKpis {
  // ISO 8601, date de calcul (les périodes Spotify sont glissantes)
  generatedAt: string;
  periods: Record<TimeRange, PeriodKpis>;
}
