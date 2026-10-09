import { Ranked } from '@/types/kpis';

// Compare deux classements Spotify de la même nature (ex. top artistes sur ~1 an vs sur 4 semaines)
// pour montrer comment les goûts évoluent. Fonctions pures.
// Rappel (docs/kpis.md) : ce sont des classements glissants, pas des compteurs. Un écart de
// rang est un indice d'évolution, pas une mesure exacte.

export interface Movement<T> {
  item: T;
  // Rang dans le classement de référence (plus ancien), null si absent
  before: number | null;
  // Rang dans le classement récent, null si absent
  after: number | null;
  // Places gagnées (> 0 = monte). null si présent dans un seul classement.
  delta: number | null;
}

export interface TrendComparison<T> {
  // Présents maintenant, absents avant
  newcomers: Movement<T>[];
  // Présents dans les deux, en progression d'au moins `minShift` places
  risers: Movement<T>[];
  // Présents dans les deux, en recul d'au moins `minShift` places
  fallers: Movement<T>[];
  // Présents avant, absents maintenant
  dropped: Movement<T>[];
  // Part du classement récent déjà présente dans le classement de référence, entre 0 et 1
  loyalty: number;
}

export function compareRankings<T extends { id: string }>(
  before: Ranked<T>[],
  after: Ranked<T>[],
  { minShift = 5 }: { minShift?: number } = {}
): TrendComparison<T> {
  const beforeRanks = new Map(before.map(({ rank, item }) => [item.id, rank]));
  const afterRanks = new Map(after.map(({ rank, item }) => [item.id, rank]));

  const newcomers: Movement<T>[] = [];
  const risers: Movement<T>[] = [];
  const fallers: Movement<T>[] = [];

  for (const { rank, item } of after) {
    const previous = beforeRanks.get(item.id);
    if (previous === undefined) {
      newcomers.push({ item, before: null, after: rank, delta: null });
      continue;
    }
    const delta = previous - rank;
    const movement = { item, before: previous, after: rank, delta };
    if (delta >= minShift) risers.push(movement);
    else if (delta <= -minShift) fallers.push(movement);
  }

  const dropped: Movement<T>[] = before
    .filter(({ item }) => !afterRanks.has(item.id))
    .map(({ rank, item }) => ({ item, before: rank, after: null, delta: null }));

  return {
    newcomers,
    // Les plus fortes variations d'abord
    risers: risers.sort((a, b) => b.delta! - a.delta!),
    fallers: fallers.sort((a, b) => a.delta! - b.delta!),
    dropped,
    loyalty: after.length > 0 ? (after.length - newcomers.length) / after.length : 0,
  };
}
