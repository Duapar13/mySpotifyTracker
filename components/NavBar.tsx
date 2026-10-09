'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/wrapped', label: 'Wrapped' },
  { href: '/history', label: 'Historique' },
  { href: '/library', label: 'Bibliothèque' },
  { href: '/trends', label: 'Tendances' },
  { href: '/share', label: 'Partager' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-3"
      >
        <Link href="/" className="font-bold tracking-tight">
          <span className="text-green-500">●</span> My Spotify Tracker
        </Link>
        <ul className="ml-auto flex flex-wrap justify-end gap-1 text-sm">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3 py-1.5 transition-colors ${
                    active
                      ? 'bg-green-500 font-medium text-black'
                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
