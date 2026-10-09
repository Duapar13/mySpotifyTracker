// Harmonise les libellés venant de sources différentes (Spotify, Wikidata, MusicBrainz),
// pour qu'un même genre ne soit pas compté sous deux noms dans les top genres :
// "Heavy metal music" (Wikidata) et "heavy metal" (MusicBrainz) → "heavy metal"
// "pop-punk" (Wikidata) et "pop punk" (MusicBrainz) → "pop punk"
export function normalizeGenre(label: string): string {
  return label
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+music$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalise et dédoublonne, en conservant l'ordre d'origine
export function normalizeGenres(labels: string[]): string[] {
  return [...new Set(labels.map(normalizeGenre).filter((genre) => genre.length > 0))];
}
