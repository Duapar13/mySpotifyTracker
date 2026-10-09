import { normalizeGenres } from '@/mappers/genre';
import { Artist } from '@/types/models';

// L'API Spotify ne renvoie pas les genres en Development mode : on les récupère depuis
// des bases ouvertes, en faisant toujours la correspondance par ID Spotify (jamais par nom,
// Sources, licences et limites : docs/kpis.md

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2';
// Limite imposée par MusicBrainz : 1 requête/seconde (marge de 100 ms)
const MUSICBRAINZ_DELAY_MS = 1_100;
// Tags MusicBrainz conservés quand l'artiste n'a pas de genre "officiel"
const MAX_MUSICBRAINZ_TAGS = 3;

const CACHE_KEY = 'artist_genres_cache';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const isDev = process.env.NEXT_PUBLIC_APP_ENV === 'development';

type GenreSource = 'spotify' | 'wikidata' | 'musicbrainz';

interface CacheEntry {
  genres: string[];
  // null = cherché partout, rien trouvé (mis en cache aussi, pour ne pas re-chercher à chaque fois)
  source: GenreSource | null;
  fetchedAt: number;
}

type GenreCache = Record<string, CacheEntry>;

function debugLog(...args: unknown[]) {
  if (isDev) console.debug('[artistGenres]', ...args);
}

// --- Cache -----------------------------------------------------------------

function readCache(): GenreCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: GenreCache): void {
  const now = Date.now();
  // Purge des entrées expirées à chaque écriture, pour que le cache ne grossisse pas indéfiniment
  const fresh = Object.fromEntries(
    Object.entries(cache).filter(([, entry]) => now - entry.fetchedAt < CACHE_TTL_MS)
  );
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
  } catch (err) {
    console.warn('[artistGenres] sauvegarde du cache impossible', err);
  }
}

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry !== undefined && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

// --- Wikidata --------------------------------------------------------------

interface SparqlResponse {
  results: {
    bindings: { spotifyId: { value: string }; genreLabel?: { value: string } }[];
  };
}

// Une seule requête pour tous les artistes.
// P1902 = "Spotify artist ID", P136 = "genre"
async function fetchWikidataGenres(spotifyIds: string[]): Promise<Map<string, string[]>> {
  // Les IDs sont insérés dans la requête : on n'accepte que le format Spotify (base62)
  const values = spotifyIds
    .filter((id) => /^[A-Za-z0-9]+$/.test(id))
    .map((id) => `"${id}"`)
    .join(' ');
  const query = `
    SELECT ?spotifyId ?genreLabel WHERE {
      VALUES ?spotifyId { ${values} }
      ?artist wdt:P1902 ?spotifyId .
      OPTIONAL {
        ?artist wdt:P136 ?genre .
        ?genre rdfs:label ?genreLabel .
        FILTER(LANG(?genreLabel) = "en")
      }
    }`;

  // POST plutôt que GET : la liste d'IDs peut dépasser la longueur maximale d'une URL
  const response = await fetch(WIKIDATA_SPARQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/sparql-results+json',
    },
    body: new URLSearchParams({ query }).toString(),
  });
  if (!response.ok) throw new Error(`Wikidata ${response.status}`);

  const data: SparqlResponse = await response.json();
  const genresById = new Map<string, string[]>();
  for (const { spotifyId, genreLabel } of data.results.bindings) {
    const genres = genresById.get(spotifyId.value) ?? [];
    if (genreLabel) genres.push(genreLabel.value);
    genresById.set(spotifyId.value, genres);
  }
  return genresById;
}

// --- MusicBrainz -----------------------------------------------------------

interface MusicBrainzUrlResponse {
  relations?: { artist?: { id: string } }[];
}

interface MusicBrainzArtistResponse {
  genres?: { name: string; count: number }[];
  tags?: { name: string; count: number }[];
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Toutes les requêtes MusicBrainz passent par cette file, qui les espace d'au moins 1,1 s.
// Les appels sont chaînés : deux enrichissements simultanés (StrictMode en dev, plusieurs pages)
// ne peuvent pas envoyer de requêtes en parallèle et dépasser la limite.
let lastMusicBrainzCall = 0;
let musicBrainzQueue: Promise<unknown> = Promise.resolve();

function musicBrainzFetch<T>(path: string): Promise<T | null> {
  const run = async (): Promise<T | null> => {
    const elapsed = Date.now() - lastMusicBrainzCall;
    if (elapsed < MUSICBRAINZ_DELAY_MS) await wait(MUSICBRAINZ_DELAY_MS - elapsed);
    lastMusicBrainzCall = Date.now();
    return doMusicBrainzFetch<T>(path);
  };
  const result = musicBrainzQueue.then(run, run);
  musicBrainzQueue = result.catch(() => undefined);
  return result;
}

async function doMusicBrainzFetch<T>(path: string): Promise<T | null> {
  const response = await fetch(`${MUSICBRAINZ_API_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  // 404 = inconnu de MusicBrainz : réponse valide, pas une panne
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`MusicBrainz ${response.status}`);
  return response.json();
}

// 2 requêtes : URL Spotify → ID MusicBrainz, puis ID → genres
async function fetchMusicBrainzGenres(spotifyId: string): Promise<string[]> {
  const spotifyUrl = encodeURIComponent(`https://open.spotify.com/artist/${spotifyId}`);
  const urlData = await musicBrainzFetch<MusicBrainzUrlResponse>(
    `/url?resource=${spotifyUrl}&inc=artist-rels&fmt=json`
  );
  const mbid = urlData?.relations?.find((relation) => relation.artist)?.artist?.id;
  if (!mbid) return [];

  const artist = await musicBrainzFetch<MusicBrainzArtistResponse>(
    `/artist/${mbid}?inc=genres+tags&fmt=json`
  );
  // Les "genres" sont une liste contrôlée par MusicBrainz ; les "tags" sont libres (plus bruités),
  // utilisés seulement en dernier recours et limités aux plus votés
  if (artist?.genres?.length) return artist.genres.map((genre) => genre.name);
  return (artist?.tags ?? [])
    .filter((tag) => tag.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MUSICBRAINZ_TAGS)
    .map((tag) => tag.name);
}

// --- Point d'entrée --------------------------------------------------------

export interface EnrichmentReport {
  total: number;
  fromCache: number;
  fromWikidata: number;
  fromMusicBrainz: number;
  notFound: number;
  // Artistes non enrichis à cause d'une source en panne (non mis en cache, re-tentés la prochaine fois)
  failed: number;
}

export interface EnrichmentProgress {
  report: EnrichmentReport;
  // Genres connus à cet instant (Spotify, cache, ou déjà trouvés)
  genresById: Map<string, string[]>;
  // Artistes dont la recherche n'est pas terminée
  remaining: number;
}

interface EnrichOptions {
  // Appelé dès que de nouveaux genres sont connus : permet d'afficher le Wrapped sans attendre
  onProgress?: (progress: EnrichmentProgress) => void;
}

// Genres déjà connus sans aucun appel réseau (fournis par Spotify ou en cache) : instantané,
// pour afficher un premier résultat pendant que le reste est recherché.
export function getKnownGenres(artists: Artist[]): Map<string, string[]> {
  const cache = readCache();
  const known = new Map<string, string[]>();
  for (const artist of artists) {
    if (artist.genres.length > 0) known.set(artist.id, normalizeGenres(artist.genres));
    else if (isFresh(cache[artist.id])) known.set(artist.id, cache[artist.id].genres);
  }
  return known;
}

// Ajoute des entrées au cache sans écraser celles écrites entre-temps par un autre appel
function persistCache(entries: GenreCache): void {
  writeCache({ ...readCache(), ...entries });
}

// Complète Artist.genres pour les artistes qui n'en ont pas. Ne lève jamais d'erreur :
// si une source est en panne, les genres manquants restent vides.
// L'ordre du tableau fixe la priorité de recherche (les premiers sont traités en premier).
export async function enrichArtistGenres(
  artists: Artist[],
  { onProgress }: EnrichOptions = {}
): Promise<{ artists: Artist[]; report: EnrichmentReport }> {
  const cache = readCache();
  const newEntries: GenreCache = {};
  const genresById = new Map<string, string[]>();
  const report: EnrichmentReport = {
    total: artists.length,
    fromCache: 0,
    fromWikidata: 0,
    fromMusicBrainz: 0,
    notFound: 0,
    failed: 0,
  };

  // 1. Genres déjà fournis par Spotify (au cas où l'API les renverrait à nouveau) ou en cache
  let missing: string[] = [];
  for (const artist of artists) {
    if (artist.genres.length > 0) {
      genresById.set(artist.id, normalizeGenres(artist.genres));
    } else if (isFresh(cache[artist.id])) {
      genresById.set(artist.id, cache[artist.id].genres);
      report.fromCache++;
    } else {
      missing.push(artist.id);
    }
  }

  const emit = (remaining: number) =>
    onProgress?.({ report: { ...report }, genresById: new Map(genresById), remaining });
  emit(missing.length);

  // 2. Wikidata, en une requête
  if (missing.length > 0) {
    try {
      const wikidata = await fetchWikidataGenres(missing);
      for (const id of missing) {
        const genres = normalizeGenres(wikidata.get(id) ?? []);
        if (genres.length > 0) {
          genresById.set(id, genres);
          newEntries[id] = { genres, source: 'wikidata', fetchedAt: Date.now() };
          report.fromWikidata++;
        }
      }
      missing = missing.filter((id) => !genresById.has(id));
      persistCache(newEntries);
      emit(missing.length);
    } catch (err) {
      // Wikidata en panne : MusicBrainz prend le relais pour tout le monde
      console.warn('[artistGenres] Wikidata indisponible', err);
    }
  }

  // 3. MusicBrainz, un artiste à la fois (rate limit)
  for (const [index, id] of missing.entries()) {
    // Un autre enrichissement en cours (StrictMode, autre page) a pu trouver cet artiste entre-temps
    const cached = readCache()[id];
    if (isFresh(cached)) {
      if (cached.genres.length > 0) genresById.set(id, cached.genres);
      report.fromCache++;
      continue;
    }
    try {
      const genres = normalizeGenres(await fetchMusicBrainzGenres(id));
      if (genres.length > 0) {
        genresById.set(id, genres);
        report.fromMusicBrainz++;
      } else {
        report.notFound++;
      }
      newEntries[id] = {
        genres,
        source: genres.length > 0 ? 'musicbrainz' : null,
        fetchedAt: Date.now(),
      };
      // Sauvegarde à chaque artiste : quitter la page ne fait pas perdre le travail déjà fait
      persistCache({ [id]: newEntries[id] });
    } catch (err) {
      // Panne : pas de mise en cache, l'artiste sera re-tenté au prochain chargement
      console.warn(`[artistGenres] MusicBrainz indisponible pour ${id}`, err);
      report.failed++;
    }
    emit(missing.length - index - 1);
  }

  debugLog(report);

  return {
    artists: artists.map((artist) => ({ ...artist, genres: genresById.get(artist.id) ?? [] })),
    report,
  };
}
