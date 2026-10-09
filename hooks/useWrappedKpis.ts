'use client';

import { useEffect, useState } from 'react';
import { PeriodKpisOptions } from '@/lib/kpis/wrapped';
import { SpotifyApiError } from '@/services/spotifyClient';
import { GenresProgress, getWrappedKpis, WrappedResult } from '@/services/wrapped';

type State =
  | { status: 'loading' }
  // needsLogin : session absente ou expirée (401), l'UI peut proposer de se reconnecter
  | { status: 'error'; message: string; needsLogin: boolean }
  | { status: 'ready'; kpis: WrappedResult; genres: GenresProgress };

// Charge le Wrapped en deux temps : `ready` dès que Spotify a répondu (tops, stats, titres),
// puis `genres.remaining` diminue pendant que les genres sont complétés. Quand il atteint 0,
// tout est à jour.
// `options` doit être stable (constante de module ou useMemo) : il relance le chargement.
export function useWrappedKpis(options?: PeriodKpisOptions): State {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getWrappedKpis(options, {
      onUpdate: (kpis, genres) => {
        if (!cancelled) setState({ status: 'ready', kpis, genres });
      },
    }).catch((err) => {
      if (!cancelled) {
        const needsLogin = err instanceof SpotifyApiError && err.status === 401;
        setState({ status: 'error', message: err.message, needsLogin });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [options]);

  return state;
}
