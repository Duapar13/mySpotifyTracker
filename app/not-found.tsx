import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <p className="font-mono text-green-500">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Cette page n’existe pas</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Le lien est peut-être cassé, ou la page a été déplacée.
      </p>
      <Link
        href="/"
        className="w-fit rounded-full bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400"
      >
        Retour à l’accueil
      </Link>
    </main>
  );
}
