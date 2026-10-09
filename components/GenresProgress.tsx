import { GenresProgress as Progress } from '@/services/wrapped';

// Bandeau affiché tant que les genres sont recherchés : le reste du Wrapped est déjà complet
export default function GenresProgress({ progress }: { progress: Progress }) {
  if (progress.remaining === 0) return null;
  const done = progress.total - progress.remaining;

  return (
    <div role="status" className="rounded-2xl bg-zinc-100 p-4 text-sm dark:bg-zinc-900">
      <p>
        Recherche des genres de tes artistes : {done} / {progress.total}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-1.5 rounded-full bg-green-500 transition-all"
          style={{ width: `${(done / Math.max(1, progress.total)) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Le reste est déjà à jour. Les genres trouvés sont gardés 30 jours : cette étape n’a lieu
        qu’une fois.
      </p>
    </div>
  );
}
