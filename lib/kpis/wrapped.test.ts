import { describe, expect, it } from 'vitest';
import {
  computePeriodKpis,
  computePeriodStats,
  computeTopGenres,
  rank,
  TIME_RANGE_LABELS,
} from '@/lib/kpis/wrapped';
import { Artist, Track } from '@/types/models';

const artist = (id: string, genres: string[], popularity: number | null = 50): Artist => ({
  id,
  name: `Artist ${id}`,
  genres,
  imageUrl: null,
  popularity,
  spotifyUrl: null,
});

const track = (id: string, artistIds: string[]): Track => ({
  id,
  name: `Track ${id}`,
  artists: artistIds.map((artistId) => ({ id: artistId, name: `Artist ${artistId}` })),
  album: { id: `album-${id}`, name: 'Album', imageUrl: null, releaseDate: null },
  durationMs: 180_000,
  popularity: null,
  explicit: false,
  spotifyUrl: null,
});

describe('rank', () => {
  it('numérote à partir de 1 et tronque', () => {
    expect(rank(['a', 'b', 'c'], 2)).toEqual([
      { rank: 1, item: 'a' },
      { rank: 2, item: 'b' },
    ]);
  });
});

describe('computeTopGenres', () => {
  it('renvoie [] si aucun artiste n\'a de genre', () => {
    expect(computeTopGenres([artist('1', []), artist('2', [])], 5)).toEqual([]);
  });

  it('classe par nombre d\'artistes puis par meilleur rang', () => {
    const artists = [
      artist('1', ['rock']),
      artist('2', ['pop', 'rap']),
      artist('3', ['pop']),
      artist('4', ['rap']),
    ];
    const result = computeTopGenres(artists, 5);
    // pop et rap : 2 artistes chacun ; pop a son meilleur artiste au rang 2, rap aussi
    // (égalité totale -> ordre stable d'apparition) ; rock : 1 artiste
    expect(result.map((g) => g.genre)).toEqual(['pop', 'rap', 'rock']);
    expect(result[0]).toMatchObject({ artistCount: 2, topArtistNames: ['Artist 2', 'Artist 3'] });
  });

  it('départage les égalités par l\'artiste le mieux classé', () => {
    const artists = [artist('1', ['rock']), artist('2', ['jazz'])];
    expect(computeTopGenres(artists, 5).map((g) => g.genre)).toEqual(['rock', 'jazz']);
  });

  it('calcule la part sur les artistes ayant au moins un genre', () => {
    const artists = [artist('1', ['pop']), artist('2', []), artist('3', ['pop'])];
    expect(computeTopGenres(artists, 5)[0].share).toBe(1);
  });

  it('respecte la taille demandée', () => {
    const artists = [artist('1', ['a', 'b', 'c'])];
    expect(computeTopGenres(artists, 2)).toHaveLength(2);
  });
});

describe('computePeriodStats', () => {
  it('ignore les popularités inconnues dans la moyenne', () => {
    const artists = [artist('1', [], 80), artist('2', [], null), artist('3', [], 61)];
    // (80 + 61) / 2 = 70.5 -> 71
    expect(computePeriodStats([], artists).mainstreamScore).toBe(71);
  });

  it('renvoie null si aucune popularité n\'est connue', () => {
    expect(computePeriodStats([], [artist('1', [], null)]).mainstreamScore).toBeNull();
  });

  it('compte les genres et artistes distincts, featurings compris', () => {
    const artists = [artist('1', ['pop', 'rock']), artist('2', ['pop'])];
    const tracks = [track('a', ['1', '2']), track('b', ['1']), track('c', ['3'])];
    expect(computePeriodStats(tracks, artists)).toMatchObject({
      distinctGenres: 2,
      distinctArtistsInTopTracks: 3,
    });
  });
});

describe('computePeriodKpis', () => {
  const tracks = Array.from({ length: 15 }, (_, i) => track(String(i), ['1']));
  const artists = Array.from({ length: 15 }, (_, i) => artist(String(i), ['pop']));

  it('applique les tailles par défaut (10 / 10 / 5)', () => {
    const kpis = computePeriodKpis('short_term', tracks, artists);
    expect(kpis.topTracks).toHaveLength(10);
    expect(kpis.topArtists).toHaveLength(10);
    expect(kpis.label).toBe(TIME_RANGE_LABELS.short_term);
  });

  it('calcule les stats sur toutes les données, pas seulement le top affiché', () => {
    const kpis = computePeriodKpis('long_term', tracks, artists, { topArtistsCount: 3 });
    expect(kpis.topArtists).toHaveLength(3);
    expect(kpis.topGenres[0].artistCount).toBe(15);
  });

  it('masque les genres quand Spotify n\'en fournit pas', () => {
    const kpis = computePeriodKpis('medium_term', tracks, [artist('1', [])]);
    expect(kpis.genresAvailable).toBe(false);
    expect(kpis.topGenres).toEqual([]);
  });
});
