import { describe, expect, it } from 'vitest';
import {
  filterLastDays,
  getCoveredRange,
  groupByDay,
  groupByMonth,
  sortByTimeDesc,
  toDayKey,
  toMonthKey,
} from '@/lib/timeline';

const DAY_MS = 24 * 60 * 60 * 1000;
// Midi local : évite tout décalage de jour lié au fuseau horaire
const at = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12).getTime();
const time = (item: { t: number }) => item.t;

describe('toDayKey / toMonthKey', () => {
  it('formatent avec des zéros de remplissage', () => {
    expect(toDayKey(at(2026, 3, 5))).toBe('2026-03-05');
    expect(toMonthKey(at(2026, 3, 5))).toBe('2026-03');
  });
});

describe('sortByTimeDesc', () => {
  it('trie du plus récent au plus ancien sans modifier l\'entrée', () => {
    const items = [{ t: 1 }, { t: 3 }, { t: 2 }];
    expect(sortByTimeDesc(items, time).map(time)).toEqual([3, 2, 1]);
    expect(items.map(time)).toEqual([1, 3, 2]);
  });
});

describe('filterLastDays', () => {
  it('garde uniquement les éléments de la fenêtre', () => {
    const now = at(2026, 3, 10);
    const items = [{ t: now - DAY_MS }, { t: now - 6 * DAY_MS }, { t: now - 8 * DAY_MS }];
    expect(filterLastDays(items, time, 7, now)).toHaveLength(2);
  });

  it('inclut la borne exacte', () => {
    const now = at(2026, 3, 10);
    expect(filterLastDays([{ t: now - 7 * DAY_MS }], time, 7, now)).toHaveLength(1);
  });
});

describe('groupByDay / groupByMonth', () => {
  const items = [
    { t: at(2026, 3, 1) },
    { t: at(2026, 3, 20) },
    { t: at(2026, 3, 20) + 1000 },
    { t: at(2026, 2, 10) },
  ];

  it('groupe par jour, du plus récent au plus ancien', () => {
    const groups = groupByDay(items, time);
    expect([...groups.keys()]).toEqual(['2026-03-20', '2026-03-01', '2026-02-10']);
    expect(groups.get('2026-03-20')).toHaveLength(2);
  });

  it('groupe par mois, sans période vide', () => {
    const groups = groupByMonth(items, time);
    expect([...groups.keys()]).toEqual(['2026-03', '2026-02']);
    expect(groups.get('2026-03')).toHaveLength(3);
  });
});

describe('getCoveredRange', () => {
  it('renvoie null sans données', () => {
    expect(getCoveredRange([], time)).toBeNull();
  });

  it('renvoie la plus ancienne et la plus récente date', () => {
    expect(getCoveredRange([{ t: 5 }, { t: 2 }, { t: 9 }], time)).toEqual({ from: 2, to: 9 });
  });
});
