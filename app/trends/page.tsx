'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SpotifyLoginButton from '@/components/SpotifyLoginButton';
import { compareRankings, Movement } from '@/lib/trends';
import { getWrappedKpis } from '@/services/wrapped';
import { WrappedKpis } from '@/types/kpis';
import { TimeRange } from '@/types/spotify';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kpis: WrappedKpis };

type Kind = 'artists' | 'tracks';
type Baseline = Extract<TimeRange, 'medium_term' | 'long_term'>;

const KINDS: { value: Kind; label: string }[] = [
  { value: 'artists', label: 'Artistes' },
  { value: 'tracks', label: 'Titres' },
];
const BASELINES: { value: Baseline; label: string }[] = [
  { value: 'long_term', label: 'vs il y a ~1 an' },
  { value: 'medium_term', label: 'vs 6 derniers mois' },
];

// Récupère tout le top de 50 : plus le classement est large, plus la comparaison est fiable
const FULL_TOP = { topArtistsCount: 50, topTracksCount: 50 };

interface Entry {
  id: string;
  name: string;
  subtitle: string;
  imageUrl: string | null;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-green-500 text-black'
          : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  );
}

function Group({
  title,
  hint,
  movements,
  badge,
}: {
  title: string;
  hint: string;
  movements: Movement<Entry>[];
  badge: (movement: Movement<Entry>) => React.ReactNode;
}) {
  if (movements.length === 0) return null;
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-zinc-500">{hint}</p>
      <ul className="space-y-2">
        {movements.slice(0, 10).map((movement) => (
          <li key={movement.item.id} className="flex items-center gap-3">
            {movement.item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- image distante Spotify
              <img
                src={movement.item.imageUrl}
                alt=""
                loading="lazy"
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{movement.item.name}</p>
              {movement.item.subtitle && (
                <p className="truncate text-xs text-zinc-500">{movement.item.subtitle}</p>
              )}
            </div>
            <span className="shrink-0 text-sm font-medium">{badge(movement)}</span>
          </li>
        ))}
      </ul>
      {movements.length > 10 && (
        <p className="mt-2 text-xs text-zinc-500">+ {movements.length - 10} autres</p>
      )}
    </section>
  );
}

export default function TrendsPage() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [kind, setKind] = useState<Kind>('artists');
  const [baseline, setBaseline] = useState<Baseline>('long_term');

  useEffect(() => {
    getWrappedKpis(FULL_TOP)
      .then((kpis) => setState({ status: 'ready', kpis }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, []);

  const comparison = useMemo(() => {
    if (state.status !== 'ready') return null;
    const { periods } = state.kpis;
    const toEntries = (period: (typeof periods)[TimeRange]) =>
      kind === 'artists'
        ? period.topArtists.map(({ rank, item }) => ({
            rank,
            item: {
              id: item.id,
              name: item.name,
              subtitle: item.genres.slice(0, 2).join(', '),
              imageUrl: item.imageUrl,
            } satisfies Entry,
          }))
        : period.topTracks.map(({ rank, item }) => ({
            rank,
            item: {
              id: item.id,
              name: item.name,
              subtitle: item.artists.map((artist) => artist.name).join(', '),
              imageUrl: item.album.imageUrl,
            } satisfies Entry,
          }));
    return compareRankings(toEntries(periods[baseline]), toEntries(periods.short_term));
  }, [state, kind, baseline]);

  const noun = kind === 'artists' ? 'artistes' : 'titres';

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 mb-2 text-4xl font-bold tracking-tight">Tes tendances</h1>
      <p className="mb-8 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Ce que tu écoutes ces 4 dernières semaines comparé à avant : nouveautés, coups de cœur
        qui montent, et ceux que tu as laissés de côté.
      </p>

      {state.status === 'loading' && <p className="text-zinc-500">Comparaison en cours...</p>}

      {state.status === 'error' && (
        <div className="space-y-4">
          <p className="text-red-500">{state.message}</p>
          <SpotifyLoginButton />
        </div>
      )}

      {comparison && (
        <div className="space-y-10">
          <div className="flex flex-wrap gap-6">
            <div role="tablist" className="flex gap-2">
              {KINDS.map(({ value, label }) => (
                <Pill key={value} active={value === kind} onClick={() => setKind(value)}>
                  {label}
                </Pill>
              ))}
            </div>
            <div role="tablist" className="flex gap-2">
              {BASELINES.map(({ value, label }) => (
                <Pill key={value} active={value === baseline} onClick={() => setBaseline(value)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-100 p-5 dark:bg-zinc-900">
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">
              {Math.round(comparison.loyalty * 100)} %
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              de tes {noun} du moment étaient déjà dans ton top avant.{' '}
              {comparison.loyalty >= 0.7
                ? 'Tu es fidèle à tes classiques.'
                : comparison.loyalty >= 0.4
                  ? 'Un bon mélange de valeurs sûres et de nouveautés.'
                  : 'Tu explores beaucoup en ce moment.'}
            </p>
          </div>

          <Group
            title="Nouveautés"
            hint={`Dans ton top actuel, absents avant`}
            movements={comparison.newcomers}
            badge={(m) => <span className="text-green-500">n°{m.after}</span>}
          />
          <Group
            title="En hausse"
            hint="Au moins 5 places gagnées"
            movements={comparison.risers}
            badge={(m) => <span className="text-green-500">▲ {m.delta} · n°{m.after}</span>}
          />
          <Group
            title="En baisse"
            hint="Au moins 5 places perdues"
            movements={comparison.fallers}
            badge={(m) => <span className="text-amber-500">▼ {Math.abs(m.delta!)} · n°{m.after}</span>}
          />
          <Group
            title="Mis de côté"
            hint="Dans ton top avant, absents maintenant"
            movements={comparison.dropped}
            badge={(m) => <span className="text-zinc-500">était n°{m.before}</span>}
          />

          <p className="text-xs text-zinc-500">
            Spotify fournit des classements glissants, pas des compteurs d’écoutes : les écarts
            donnent une tendance, pas une mesure exacte.
          </p>
        </div>
      )}
    </main>
  );
}
