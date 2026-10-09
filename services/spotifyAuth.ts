import { SpotifySession } from '@/types/spotify';

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const SCOPES = [
  'user-top-read',
  'user-read-recently-played',
  'user-library-read',
].join(' ');

export function buildSpotifyAuthorizeUrl(codeChallenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
    scope: SCOPES,
  });
  return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<Omit<SpotifySession, 'user'>> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!,
    client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
    code_verifier: codeVerifier,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Spotify token exchange failed: ${errorBody}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// Flow PKCE : pas de client secret, le client_id suffit
export async function refreshAccessToken(
  refreshToken: string
): Promise<Omit<SpotifySession, 'user'>> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!,
  });

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Spotify token refresh failed: ${errorBody}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    // Spotify ne renvoie pas toujours un nouveau refresh token : on garde l'ancien
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
