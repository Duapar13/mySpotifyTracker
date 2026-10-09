'use client';

import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce';
import { buildSpotifyAuthorizeUrl } from '@/services/spotifyAuth';

export default function SpotifyLoginButton() {
  const handleLogin = async () => {
    // Le verifier est stocké dans le localStorage, qui est propre à chaque origine :
    // le flow doit démarrer sur la même origine que le redirect URI.
    const redirectOrigin = new URL(process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI!).origin;
    if (window.location.origin !== redirectOrigin) {
      window.location.href = redirectOrigin + window.location.pathname;
      return;
    }

    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    // Le state est vérifié au retour du callback : protège contre une redirection forgée (CSRF)
    const state = generateCodeVerifier(32);

    localStorage.setItem('spotify_code_verifier', verifier);
    localStorage.setItem('spotify_auth_state', state);

    window.location.href = buildSpotifyAuthorizeUrl(challenge, state);
  };

  return (
    <button
      onClick={handleLogin}
      className="rounded-full bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400"
    >
      Connect with Spotify
    </button>
  );
}
