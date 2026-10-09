import { computePeriodKpis, PeriodKpisOptions } from '@/lib/kpis/wrapped';
import {
  enrichArtistGenres,
  EnrichmentReport,
  getKnownGenres,
} from '@/services/artistGenres';
import { getTopArtists } from '@/services/spotifyArtists';
import { getTopTracks } from '@/services/spotifyTracks';
import { PeriodKpis, WrappedKpis } from '@/types/kpis';
import { Artist, Track } from '@/types/models';
import { TIME_RANGES, TimeRange } from '@/types/spotify';

// Maximum Spotify : on récupère tout pour que genres et stats soient calculés sur un échantillon large
const FETCH_LIMIT = 50;

interface PeriodData {
  timeRange: TimeRange;
  tracks: Track[];
  artists: Artist[];
}

export type WrappedResult = WrappedKpis & { genresReport: EnrichmentReport };

export interface GenresProgress {
  // Artistes dont les genres sont encore en cours de recherche (0 = terminé)
  remaining: number;
  total: number;
}

interface GetWrappedHooks {
  // Appelé une première fois dès que les données Spotify sont là (avec les genres déjà connus),
  // puis à chaque nouveau genre trouvé. Le résultat final est aussi celui de la promesse.
  onUpdate?: (result: WrappedResult, progress: GenresProgress) => void;
}

async function getPeriodData(timeRange: TimeRange): Promise<PeriodData> {
  const [tracks, artists] = await Promise.all([
    getTopTracks({ timeRange, limit: FETCH_LIMIT }),
    getTopArtists({ timeRange, limit: FETCH_LIMIT }),
  ]);
  return { timeRange, tracks, artists };
}

// Artistes des 3 périodes dédupliqués, les mieux classés en premier : ce sont eux qui comptent
// le plus pour les KPI, donc leurs genres sont cherchés en priorité.
function uniqueArtistsByPriority(periodsData: PeriodData[]): Artist[] {
  const best = new Map<string, { artist: Artist; rank: number }>();
  for (const { artists } of periodsData) {
    artists.forEach((artist, index) => {
      const known = best.get(artist.id);
      if (!known || index < known.rank) best.set(artist.id, { artist, rank: index });
    });
  }
  return [...best.values()].sort((a, b) => a.rank - b.rank).map(({ artist }) => artist);
}

function buildResult(
  periodsData: PeriodData[],
  genresById: Map<string, string[]>,
  report: EnrichmentReport,
  options?: PeriodKpisOptions
): WrappedResult {
  const periods = periodsData.map(({ timeRange, tracks, artists }) =>
    computePeriodKpis(
      timeRange,
      tracks,
      artists.map((artist) => ({ ...artist, genres: genresById.get(artist.id) ?? artist.genres })),
      options
    )
  );

  return {
    generatedAt: new Date().toISOString(),
    periods: Object.fromEntries(
      periods.map((period) => [period.timeRange, period])
    ) as Record<TimeRange, PeriodKpis>,
    genresReport: report,
  };
}

// 1. 6 appels Spotify en parallèle (2 endpoints × 3 périodes). Si un seul échoue, tout échoue :
//    un Wrapped partiel serait trompeur.
// 2. Premier résultat immédiat avec les genres déjà en cache : tops, stats et titres sont
//    complets, seuls les genres peuvent manquer.
// 3. Enrichissement des genres (lent : MusicBrainz limite à 1 requête/seconde), une seule fois
//    pour les artistes dédupliqués. Chaque genre trouvé relance le calcul. Ne fait jamais
//    échouer le Wrapped.
export async function getWrappedKpis(
  kpis?: PeriodKpisOptions,
  { onUpdate }: GetWrappedHooks = {}
): Promise<WrappedResult> {
  const periodsData = await Promise.all(TIME_RANGES.map(getPeriodData));
  const artists = uniqueArtistsByPriority(periodsData);
  const total = artists.length;

  if (onUpdate) {
    const known = getKnownGenres(artists);
    const emptyReport: EnrichmentReport = {
      total,
      fromCache: known.size,
      fromWikidata: 0,
      fromMusicBrainz: 0,
      notFound: 0,
      failed: 0,
    };
    onUpdate(buildResult(periodsData, known, emptyReport, kpis), {
      remaining: total - known.size,
      total,
    });
  }

  const { artists: enriched, report } = await enrichArtistGenres(artists, {
    onProgress: onUpdate
      ? ({ report: partial, genresById, remaining }) =>
          onUpdate(buildResult(periodsData, genresById, partial, kpis), { remaining, total })
      : undefined,
  });
  const finalGenres = new Map(enriched.map((artist) => [artist.id, artist.genres]));
  const result = buildResult(periodsData, finalGenres, report, kpis);
  onUpdate?.(result, { remaining: 0, total });
  return result;
}
