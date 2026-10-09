import { countBy } from '@/lib/aggregations';
import { toMonthKey } from '@/lib/timeline';
import { LikedTrack } from '@/types/models';

// Statistiques de la bibliothèque (titres likés). Fonctions pures.

export interface MonthCount {
  // Clé locale "YYYY-MM"
  month: string;
  count: number;
}

// Likes par mois sur les `months` derniers mois (mois courant inclus), du plus ancien au plus
// récent, mois vides compris.
export function likesPerMonth(likes: LikedTrack[], months: number, now = Date.now()): MonthCount[] {
  const counts = new Map(countBy(likes, (like) => toMonthKey(like.addedAtMs)));
  const today = new Date(now);

  return Array.from({ length: months }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (months - 1 - index), 1, 12);
    const month = toMonthKey(date.getTime());
    return { month, count: counts.get(month) ?? 0 };
  });
}

// Décennie de sortie de l'album ("1990", "2020"…). releaseDate peut valoir "2024",
// "2024-03" ou "2024-03-15" : seule l'année compte. Les dates absentes sont ignorées.
export function likesPerDecade(likes: LikedTrack[]): [decade: string, count: number][] {
  const decades = likes.flatMap(({ track }) => {
    const year = Number(track.album.releaseDate?.slice(0, 4));
    return Number.isInteger(year) && year > 0 ? [`${Math.floor(year / 10) * 10}`] : [];
  });
  return countBy(decades, (decade) => decade).sort((a, b) => Number(a[0]) - Number(b[0]));
}

// Artistes principaux les plus présents dans la bibliothèque
export function topLikedArtists(
  likes: LikedTrack[],
  limit = 10
): { id: string; name: string; count: number }[] {
  const names = new Map(likes.map(({ track }) => [track.artists[0].id, track.artists[0].name]));
  return countBy(likes, ({ track }) => track.artists[0].id)
    .slice(0, limit)
    .map(([id, count]) => ({ id, name: names.get(id) ?? id, count }));
}

export function totalHours(likes: LikedTrack[]): number {
  return likes.reduce((sum, { track }) => sum + track.durationMs, 0) / 3_600_000;
}
