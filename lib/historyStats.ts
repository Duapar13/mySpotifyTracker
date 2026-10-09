import { countBy } from '@/lib/aggregations';
import { toDayKey } from '@/lib/timeline';
import { PlayEvent } from '@/types/models';

// Statistiques calculées sur l'historique d'écoute accumulé (PlayEvent).
// Fonctions pures : l'heure courante est un paramètre pour rester testables.

export interface DayCount {
  // Clé locale "YYYY-MM-DD"
  day: string;
  count: number;
}

export interface RankedCount {
  id: string;
  label: string;
  count: number;
}

// Écoutes par jour sur les `days` derniers jours (aujourd'hui inclus), du plus ancien au plus
// récent. Les jours sans écoute sont inclus avec 0, pour un graphique sans trou.
export function playsPerDay(plays: PlayEvent[], days: number, now = Date.now()): DayCount[] {
  const counts = new Map(countBy(plays, (play) => toDayKey(play.playedAtMs)));
  const today = new Date(now);

  return Array.from({ length: days }, (_, index) => {
    // Midi local : évite les décalages de jour aux changements d'heure
    const offset = days - 1 - index;
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 12);
    const day = toDayKey(date.getTime());
    return { day, count: counts.get(day) ?? 0 };
  });
}

// Écoutes par heure de la journée (0–23), dans le fuseau horaire local
export function playsPerHour(plays: PlayEvent[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const play of plays) hours[new Date(play.playedAtMs).getHours()]++;
  return hours;
}

// Classement des artistes principaux (artists[0]) par nombre d'écoutes
export function topArtistsByPlays(plays: PlayEvent[], limit = 10): RankedCount[] {
  const names = new Map(plays.map(({ track }) => [track.artists[0].id, track.artists[0].name]));
  return countBy(plays, ({ track }) => track.artists[0].id)
    .slice(0, limit)
    .map(([id, count]) => ({ id, label: names.get(id) ?? id, count }));
}

export function topTracksByPlays(plays: PlayEvent[], limit = 10): RankedCount[] {
  const labels = new Map(
    plays.map(({ track }) => [track.id, `${track.name} – ${track.artists[0].name}`])
  );
  return countBy(plays, ({ track }) => track.id)
    .slice(0, limit)
    .map(([id, count]) => ({ id, label: labels.get(id) ?? id, count }));
}

// Durée totale écoutée, estimée : Spotify ne dit pas si un titre a été écouté en entier,
// on compte donc la durée complète de chaque titre.
export function estimatedListeningMinutes(plays: PlayEvent[]): number {
  return Math.round(plays.reduce((sum, play) => sum + play.track.durationMs, 0) / 60_000);
}
