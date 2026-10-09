import { computePeriodKpis, PeriodKpisOptions } from '@/lib/kpis/wrapped';
import { enrichArtistGenres, EnrichmentReport } from '@/services/artistGenres';
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

async function getPeriodData(timeRange: TimeRange): Promise<PeriodData> {
  const [tracks, artists] = await Promise.all([
    getTopTracks({ timeRange, limit: FETCH_LIMIT }),
    getTopArtists({ timeRange, limit: FETCH_LIMIT }),
  ]);
  return { timeRange, tracks, artists };
}

// 1. 6 appels Spotify en parallèle (2 endpoints × 3 périodes). Si un seul échoue, tout échoue :
//    un Wrapped partiel serait trompeur.
// 2. Enrichissement des genres, une seule fois pour les artistes des 3 périodes dédupliqués
//    (un même artiste apparaît souvent dans plusieurs périodes). Ne fait jamais échouer le Wrapped.
// 3. Calcul des KPIs par période.
export async function getWrappedKpis(
  options?: PeriodKpisOptions
): Promise<WrappedKpis & { genresReport: EnrichmentReport }> {
  const periodsData = await Promise.all(TIME_RANGES.map(getPeriodData));

  const uniqueArtists = [
    ...new Map(
      periodsData.flatMap((period) => period.artists).map((artist) => [artist.id, artist])
    ).values(),
  ];
  const { artists: enriched, report } = await enrichArtistGenres(uniqueArtists);
  const enrichedById = new Map(enriched.map((artist) => [artist.id, artist]));

  const periods = periodsData.map(({ timeRange, tracks, artists }) =>
    computePeriodKpis(
      timeRange,
      tracks,
      artists.map((artist) => enrichedById.get(artist.id) ?? artist),
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
