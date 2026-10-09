'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SpotifyLoginButton from '@/components/SpotifyLoginButton';
import {
  likesPerDecade,
  likesPerMonth,
  topLikedArtists,
  totalHours,
} from '@/lib/libraryStats';
import { getLikedTracks } from '@/services/spotifyLikedTracks';
import { LikedTrack } from '@/types/models';

type State =
  | { status: 'loading'; loaded: number; total: number }
  | { status: 'error'; message: string }
  | { status: 'ready'; likes: LikedTrack[] };

const MONTHS_SHOWN = 24;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
      <dd className="text-2xl font-bold text-green-600 dark:text-green-400">{value}</dd>
      <dt className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
    </div>
  );
}

function Bars({ rows }: { rows: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="flex h-32 items-end gap-0.5" role="img" aria-label="Histogramme">
      {rows.map((row) => (
        <div
          key={row.key}
          title={`${row.label} : ${row.count}`}
          className={`flex-1 rounded-t ${row.count > 0 ? 'bg-green-500' : 'bg-zinc-200 dark:bg-zinc-800'}`}
          style={{ height: `${Math.max(4, (row.count / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const [state, setState] = useState<State>({ status: 'loading', loaded: 0, total: 0 });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    getLikedTracks({
      onProgress: (loaded, total) =>
        setState((prev) => (prev.status === 'loading' ? { status: 'loading', loaded, total } : prev)),
    })
      .then((likes) => setState({ status: 'ready', likes }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, []);

  const likes = state.status === 'ready' ? state.likes : null;

  const stats = useMemo(() => {
    if (!likes) return null;
    const monthly = likesPerMonth(likes, MONTHS_SHOWN);
    return {
      monthly,
      decades: likesPerDecade(likes),
      artists: topLikedArtists(likes),
      hours: totalHours(likes),
      explicitShare: likes.filter(({ track }) => track.explicit).length / (likes.length || 1),
      bestMonth: monthly.reduce((best, month) => (month.count > best.count ? month : best), monthly[0]),
    };
  }, [likes]);

  const results = useMemo(() => {
    if (!likes) return [];
    const needle = deferredQuery.trim().toLowerCase();
    const matches = needle
      ? likes.filter(({ track }) =>
          `${track.name} ${track.artists.map((a) => a.name).join(' ')} ${track.album.name}`
            .toLowerCase()
            .includes(needle)
        )
      : likes;
    return matches.slice(0, 100);
  }, [likes, deferredQuery]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 mb-8 text-4xl font-bold tracking-tight">Ma bibliothèque</h1>

      {state.status === 'loading' && (
        <div className="space-y-2" role="status">
          <p className="text-zinc-500">
            Chargement de tes titres likés
            {state.total > 0 && ` : ${state.loaded} / ${state.total}`}
          </p>
          <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-2 rounded-full bg-green-500 transition-all"
              style={{ width: `${state.total ? (state.loaded / state.total) * 100 : 5}%` }}
            />
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-4">
          <p className="text-red-500">{state.message}</p>
          <SpotifyLoginButton />
        </div>
      )}

      {likes && stats && likes.length === 0 && (
        <p className="text-zinc-500">Aucun titre liké pour l’instant.</p>
      )}

      {likes && stats && likes.length > 0 && (
        <div className="space-y-10">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Titres likés" value={likes.length.toLocaleString('fr-FR')} />
            <Stat label="Heures de musique" value={Math.round(stats.hours).toLocaleString('fr-FR')} />
            <Stat label="Titres explicites" value={`${Math.round(stats.explicitShare * 100)} %`} />
            <Stat
              label="Premier like"
              value={dateFormat.format(likes[likes.length - 1].addedAtMs)}
            />
          </dl>

          <section>
            <h2 className="mb-1 text-xl font-semibold">Likes par mois</h2>
            <p className="mb-3 text-sm text-zinc-500">
              {MONTHS_SHOWN} derniers mois · record : {stats.bestMonth.count} likes en{' '}
              {stats.bestMonth.month}
            </p>
            <Bars
              rows={stats.monthly.map(({ month, count }) => ({ key: month, label: month, count }))}
            />
            <div className="mt-2 flex justify-between text-xs text-zinc-500">
              <span>{stats.monthly[0].month}</span>
              <span>{stats.monthly[stats.monthly.length - 1].month}</span>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Par décennie de sortie</h2>
            <ul className="space-y-2">
              {stats.decades.map(([decade, count]) => (
                <li key={decade} className="flex items-center gap-3 text-sm">
                  <span className="w-14 font-mono text-zinc-500">{decade}s</span>
                  <div className="h-3 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-3 rounded-full bg-green-500"
                      style={{ width: `${(count / likes.length) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-zinc-500">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Artistes les plus présents</h2>
            <ol className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
              {stats.artists.map((artist, index) => (
                <li key={artist.id} className="flex justify-between gap-4">
                  <span className="truncate">
                    <span className="mr-2 font-mono text-zinc-500">{index + 1}</span>
                    {artist.name}
                  </span>
                  <span className="shrink-0 text-zinc-500">{artist.count} titres</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Retrouver un titre</h2>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Titre, artiste ou album"
              aria-label="Rechercher dans mes titres likés"
              className="mb-4 w-full rounded-full border bg-transparent px-5 py-3 outline-none focus:border-green-500"
            />
            <ul className="space-y-2">
              {results.map(({ track, addedAtMs }) => (
                <li key={track.id} className="flex items-center gap-3">
                  {track.album.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image distante Spotify
                    <img
                      src={track.album.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{track.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {track.artists.map((artist) => artist.name).join(', ')} · {track.album.name}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-zinc-500">
                    {dateFormat.format(addedAtMs)}
                  </time>
                </li>
              ))}
              {results.length === 0 && (
                <li className="text-sm text-zinc-500">Aucun résultat pour « {deferredQuery} ».</li>
              )}
            </ul>
            {results.length === 100 && (
              <p className="mt-3 text-xs text-zinc-500">
                100 premiers résultats affichés, affine ta recherche.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
