'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SpotifyLoginButton from '@/components/SpotifyLoginButton';
import {
  estimatedListeningMinutes,
  playsPerDay,
  playsPerHour,
  RankedCount,
  topArtistsByPlays,
  topTracksByPlays,
} from '@/lib/historyStats';
import { filterLastDays, getCoveredRange, groupByDay, playedAt } from '@/lib/timeline';
import { clearPlayHistory, syncPlayHistory } from '@/services/playHistory';
import { getStoredSession } from '@/services/spotifySession';
import { PlayEvent } from '@/types/models';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; plays: PlayEvent[]; hasGap: boolean };

type Period = 7 | 30 | null;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
  { value: null, label: 'Tout' },
];

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormat = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });

function BarChart({
  values,
  labels,
  caption,
}: {
  values: number[];
  labels: string[];
  caption: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <figure>
      <div className="flex h-32 items-end gap-0.5" role="img" aria-label={caption}>
        {values.map((value, index) => (
          <div
            key={labels[index]}
            title={`${labels[index]} : ${value} écoute${value > 1 ? 's' : ''}`}
            className={`flex-1 rounded-t ${value > 0 ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
            style={{ height: `${Math.max(4, (value / max) * 100)}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </figcaption>
    </figure>
  );
}

function Ranking({ title, rows }: { title: string; rows: RankedCount[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Pas encore de données.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.id}>
              <div className="flex justify-between gap-4 text-sm">
                <span className="truncate">
                  <span className="mr-2 font-mono text-zinc-500">{index + 1}</span>
                  {row.label}
                </span>
                <span className="shrink-0 text-zinc-500">{row.count}×</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-1.5 rounded-full bg-green-500"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
      <dd className="text-2xl font-bold text-green-600 dark:text-green-400">{value}</dd>
      <dt className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
    </div>
  );
}

function downloadHistory(plays: PlayEvent[]) {
  const blob = new Blob([JSON.stringify(plays, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `spotify-history-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [period, setPeriod] = useState<Period>(7);

  useEffect(() => {
    syncPlayHistory()
      .then(({ plays, hasGap }) => setState({ status: 'ready', plays, hasGap }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, []);

  const all = state.status === 'ready' ? state.plays : null;
  const plays = useMemo(
    () => (all && period ? filterLastDays(all, playedAt, period) : (all ?? [])),
    [all, period]
  );
  const range = useMemo(() => getCoveredRange(all ?? [], playedAt), [all]);
  const days = useMemo(() => [...groupByDay(plays.slice(0, 100), playedAt)], [plays]);

  const reset = () => {
    const userId = getStoredSession()?.user.id;
    if (!userId || !window.confirm('Effacer tout l’historique stocké dans ce navigateur ?')) return;
    clearPlayHistory(userId);
    setState({ status: 'ready', plays: [], hasGap: false });
  };

  const chartDays = playsPerDay(plays, period ?? 30);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 mb-2 text-4xl font-bold tracking-tight">Historique d’écoute</h1>
      <p className="mb-8 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Spotify ne donne que tes 50 dernières écoutes. L’app les accumule dans ce navigateur à
        chaque visite : plus tu reviens, plus l’historique est complet.
      </p>

      {state.status === 'loading' && <p className="text-zinc-500">Synchronisation...</p>}

      {state.status === 'error' && (
        <div className="space-y-4">
          <p className="text-red-500">{state.message}</p>
          <SpotifyLoginButton />
        </div>
      )}

      {state.status === 'ready' && all && (
        <div className="space-y-10">
          {state.hasGap && (
            <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              Plus de 50 écoutes ont eu lieu depuis ta dernière visite : certaines ont pu être
              manquées.
            </p>
          )}

          {all.length === 0 ? (
            <p className="text-zinc-500">
              Aucune écoute enregistrée pour l’instant. Écoute un titre sur Spotify puis reviens.
            </p>
          ) : (
            <>
              <div role="tablist" className="flex gap-2">
                {PERIODS.map(({ value, label }) => (
                  <button
                    key={label}
                    role="tab"
                    aria-selected={value === period}
                    onClick={() => setPeriod(value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      value === period
                        ? 'bg-green-500 text-black'
                        : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Écoutes" value={plays.length} />
                <Stat
                  label="Titres différents"
                  value={new Set(plays.map((play) => play.track.id)).size}
                />
                <Stat
                  label="Heures écoutées (estim.)"
                  value={(estimatedListeningMinutes(plays) / 60).toFixed(1)}
                />
                <Stat label="Historique depuis" value={range ? dateFormat.format(range.from) : '–'} />
              </dl>

              {period !== null && (
                <section>
                  <h2 className="mb-3 text-xl font-semibold">Écoutes par jour</h2>
                  <BarChart
                    values={chartDays.map((d) => d.count)}
                    labels={chartDays.map((d) => d.day)}
                    caption={`Écoutes par jour sur ${period} jours`}
                  />
                </section>
              )}

              <section>
                <h2 className="mb-3 text-xl font-semibold">À quelle heure tu écoutes</h2>
                <BarChart
                  values={playsPerHour(plays)}
                  labels={Array.from({ length: 24 }, (_, hour) => `${hour} h`)}
                  caption="Écoutes par heure de la journée"
                />
              </section>

              <div className="grid gap-10 md:grid-cols-2">
                <Ranking title="Artistes les plus écoutés" rows={topArtistsByPlays(plays)} />
                <Ranking title="Titres les plus écoutés" rows={topTracksByPlays(plays)} />
              </div>

              <section>
                <h2 className="mb-3 text-xl font-semibold">Dernières écoutes</h2>
                <div className="space-y-6">
                  {days.map(([day, dayPlays]) => (
                    <div key={day}>
                      <h3 className="mb-2 text-sm font-semibold capitalize text-zinc-500">
                        {dayFormat.format(dayPlays[0].playedAtMs)}
                      </h3>
                      <ul className="space-y-2">
                        {dayPlays.map((play) => (
                          <li
                            key={`${play.playedAt}:${play.track.id}`}
                            className="flex items-center gap-3"
                          >
                            {play.track.album.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- image distante Spotify
                              <img
                                src={play.track.album.imageUrl}
                                alt=""
                                loading="lazy"
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{play.track.name}</p>
                              <p className="truncate text-xs text-zinc-500">
                                {play.track.artists.map((artist) => artist.name).join(', ')}
                              </p>
                            </div>
                            <time className="text-xs text-zinc-500">
                              {timeFormat.format(play.playedAtMs)}
                            </time>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex gap-3 border-t pt-6 text-sm">
                <button
                  onClick={() => downloadHistory(all)}
                  className="rounded-full border px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Exporter en JSON
                </button>
                <button
                  onClick={reset}
                  className="rounded-full border border-red-500/50 px-4 py-2 text-red-500 hover:bg-red-500/10"
                >
                  Effacer l’historique
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
