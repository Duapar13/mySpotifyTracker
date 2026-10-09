import { describe, expect, it } from 'vitest';
import { countBy, groupBy } from '@/lib/aggregations';

describe('groupBy', () => {
  it('regroupe par clé en conservant l\'ordre d\'insertion', () => {
    const groups = groupBy(['a1', 'b1', 'a2'], (item) => item[0]);
    expect([...groups.keys()]).toEqual(['a', 'b']);
    expect(groups.get('a')).toEqual(['a1', 'a2']);
  });

  it('renvoie une Map vide pour une liste vide', () => {
    expect(groupBy([], () => 'x').size).toBe(0);
  });
});

describe('countBy', () => {
  it('compte par clé, du plus fréquent au moins fréquent', () => {
    const result = countBy(['x', 'y', 'y', 'z', 'y', 'x'], (item) => item);
    expect(result).toEqual([
      ['y', 3],
      ['x', 2],
      ['z', 1],
    ]);
  });
});
