import Link from 'next/link';
import AuthStatus from '@/components/AuthStatus';
import PlayHistorySync from '@/components/PlayHistorySync';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="space-y-3">
        <h1 className="text-5xl font-bold tracking-tight">My Spotify Tracker</h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Connecte ton compte Spotify pour voir tes top titres, artistes et genres sur
          les 4 dernières semaines, 6 mois et 1 an.
        </p>
      </div>

      <AuthStatus />
      <PlayHistorySync />

      <Link
        href="/wrapped"
        className="w-fit rounded-full border px-6 py-3 font-semibold hover:bg-black/5 dark:hover:bg-white/10"
      >
        Voir mon Wrapped →
      </Link>
    </main>
  );
}
