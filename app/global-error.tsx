'use client';

// Erreur dans le layout racine : remplace tout le document, donc <html>/<body> et un style
// minimal (les styles globaux et la police ne sont pas chargés ici). Suit le thème de l'OS.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  console.error('[global error]', error);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          colorScheme: 'light dark',
        }}
      >
        <div style={{ maxWidth: 420, padding: 24 }}>
          <h1>Oups, quelque chose a cassé</h1>
          <p>Une erreur inattendue est survenue.</p>
          <button
            onClick={() => retry()}
            style={{
              padding: '12px 24px',
              borderRadius: 999,
              border: 0,
              background: '#22c55e',
              color: '#000',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
