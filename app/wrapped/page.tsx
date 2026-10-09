'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SpotifyLoginButton from '@/components/SpotifyLoginButton';
import { SpotifyApiError } from '@/services/spotifyClient';
import { getWrappedKpis } from '@/services/wrapped';
import { PeriodKpis, WrappedKpis } from '@/types/kpis';
import { TIME_RANGES, TimeRange } from '@/types/spotify';

type Result = { kpis: WrappedKpis } | { error: string; needsLogin: boolean };

// Image distante Spotify : pas besoin d'optimisation Next
function Cover({ url, className }: { url: string | null; className: string }) {
  if (!url) return <div className={`${className} bg-zinc-200 dark:bg-zinc-800`} />;
  // eslint-disable-next-line @next/next/no-img-element -- image distante Spotify
  return <img src={url} alt="" className={className} loading="lazy" />;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
      <dd className="text-3xl font-bold text-green-600 dark:text-green-400">{value}</dd>
      <dt className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
    </div>
  );
}

function PeriodView({ period }: { period: PeriodKpis }) {
  return (
    <div className="space-y-10">
      <dl className="grid grid-cols-3 gap-3">
        <StatCard label="Score mainstream" value={period.stats.mainstreamScore ?? 'n/a'} />
        <StatCard label="Genres différents" value={period.stats.distinctGenres} />
        <StatCard label="Artistes dans tes titres" value={period.stats.distinctArtistsInTopTracks} />
      </dl>

      {period.genresAvailable && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Top genres</h2>
          <ol className="space-y-3">
            {period.topGenres.map((genre) => (
              <li key={genre.genre}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{genre.genre}</span>
                  <span className="text-zinc-500">{Math.round(genre.share * 100)} %</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${Math.round(genre.share * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">{genre.topArtistNames.join(', ')}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xl font-semibold">Top artistes</h2>
          <ol className="space-y-3">
            {period.topArtists.map(({ rank, item }) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="w-6 text-right font-mono text-sm text-zinc-500">{rank}</span>
                <Cover url={item.imageUrl} className="h-12 w-12 rounded-full object-cover" />
                <span className="font-medium">{item.name}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Top titres</h2>
          <ol className="space-y-3">
            {period.topTracks.map(({ rank, item }) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="w-6 text-right font-mono text-sm text-zinc-500">{rank}</span>
                <Cover url={item.album.imageUrl} className="h-12 w-12 rounded object-cover" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {item.artists.map((artist) => artist.name).join(', ')}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

export default function WrappedPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('short_term');

  useEffect(() => {
    getWrappedKpis()
      .then((kpis) => setResult({ kpis }))
      .catch((err) =>
        setResult({
          error: err.message,
          needsLogin: err instanceof SpotifyApiError && err.status === 401,
        })
      );
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 mb-6 text-4xl font-bold tracking-tight">Ton Wrapped</h1>

      {!result && <p className="text-zinc-500">Calcul de tes stats...</p>}

      {result && 'error' in result && (
        <div className="space-y-4">
          <p className="text-red-500">{result.error}</p>
          {result.needsLogin && <SpotifyLoginButton />}
        </div>
      )}

      {result && 'kpis' in result && (
        <>
          <div role="tablist" className="mb-8 flex gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range}
                role="tab"
                aria-selected={range === timeRange}
                onClick={() => setTimeRange(range)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  range === timeRange
                    ? 'bg-green-500 text-black'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                }`}
              >
                {result.kpis.periods[range].label}
              </button>
            ))}
          </div>
          <PeriodView period={result.kpis.periods[timeRange]} />
          <p className="mt-10 text-xs text-zinc-500">
            Périodes glissantes définies par Spotify, calculées le{' '}
            {new Date(result.kpis.generatedAt).toLocaleString('fr-FR')}.
          </p>
        </>
      )}
    </main>
  );
}
