'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Filet de sécurité : une erreur de rendu n'affiche plus une page blanche
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error('[error boundary]', error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-bold tracking-tight">Oups, quelque chose a cassé</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Une erreur inattendue est survenue. Tes données Spotify ne sont pas touchées.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => retry()}
          className="rounded-full bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400"
        >
          Réessayer
        </button>
        <Link href="/" className="rounded-full border px-6 py-3 hover:bg-black/5 dark:hover:bg-white/10">
          Accueil
        </Link>
      </div>
    </main>
  );
}
