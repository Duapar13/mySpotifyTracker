'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import SpotifyLoginButton from '@/components/SpotifyLoginButton';
import { CARD_HEIGHT, CARD_WIDTH, drawShareCard } from '@/lib/shareCard';
import { getStoredSession } from '@/services/spotifySession';
import { getWrappedKpis } from '@/services/wrapped';
import { WrappedKpis } from '@/types/kpis';
import { TIME_RANGES, TimeRange } from '@/types/spotify';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; kpis: WrappedKpis };

export default function SharePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [timeRange, setTimeRange] = useState<TimeRange>('short_term');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    getWrappedKpis()
      .then((kpis) => setState({ status: 'ready', kpis }))
      .catch((err) => setState({ status: 'error', message: err.message }));
  }, []);

  // Web Share avec fichiers : surtout mobile. Détecté après le montage (pas de window au SSR).
  useEffect(() => {
    const probe = new File([], 'probe.png', { type: 'image/png' });
    Promise.resolve().then(() => setCanShare(!!navigator.canShare?.({ files: [probe] })));
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (state.status !== 'ready' || !ctx) return;
    const userName = getStoredSession()?.user.displayName ?? '';
    drawShareCard(ctx, state.kpis.periods[timeRange], userName);
  }, [state, timeRange]);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, 'image/png'));

  const download = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mon-wrapped-${timeRange}.png`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const share = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], `mon-wrapped-${timeRange}.png`, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: 'Mon Wrapped' });
    } catch {
      // Partage annulé par l'utilisateur : rien à faire
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-4 mb-2 text-4xl font-bold tracking-tight">Partager mon Wrapped</h1>
      <p className="mb-8 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Une image au format story, prête à poster. Elle est générée dans ton navigateur : rien
        n’est envoyé ailleurs.
      </p>

      {state.status === 'loading' && <p className="text-zinc-500">Préparation de la carte...</p>}

      {state.status === 'error' && (
        <div className="space-y-4">
          <p className="text-red-500">{state.message}</p>
          <SpotifyLoginButton />
        </div>
      )}

      {state.status === 'ready' && (
        <div className="flex flex-col items-start gap-8 md:flex-row">
          <canvas
            ref={canvasRef}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            role="img"
            aria-label="Aperçu de la carte Wrapped"
            className="w-full max-w-xs rounded-2xl shadow-lg"
          />
          <div className="space-y-6">
            <div role="tablist" className="flex flex-wrap gap-2">
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
                  {state.kpis.periods[range].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={download}
                className="rounded-full bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400"
              >
                Télécharger l’image
              </button>
              {canShare && (
                <button
                  onClick={share}
                  className="rounded-full border px-6 py-3 font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Partager
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
