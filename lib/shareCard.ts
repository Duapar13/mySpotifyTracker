import { PeriodKpis } from '@/types/kpis';

// Dessine la carte « Mon Wrapped » (format story 9:16) dans un canvas.
// Texte uniquement : charger les pochettes Spotify dans un canvas demande du CORS, et un canvas
// « contaminé » ne peut plus être exporté en image.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

const MARGIN = 90;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Coupe le texte avec « … » pour qu'il tienne dans maxWidth
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}

function drawList(
  ctx: CanvasRenderingContext2D,
  title: string,
  rows: string[],
  y: number
): number {
  ctx.fillStyle = '#4ade80';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(title.toUpperCase(), MARGIN, y);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 52px ${FONT}`;
  rows.forEach((row, index) => {
    const rowY = y + 80 + index * 80;
    ctx.fillStyle = '#4ade80';
    ctx.fillText(String(index + 1), MARGIN, rowY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fit(ctx, row, CARD_WIDTH - MARGIN * 2 - 70), MARGIN + 70, rowY);
  });
  return y + 80 + rows.length * 80 + 50;
}

export function drawShareCard(
  ctx: CanvasRenderingContext2D,
  period: PeriodKpis,
  userName: string
): void {
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, '#052e16');
  gradient.addColorStop(0.55, '#0a0a0a');
  gradient.addColorStop(1, '#14532d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 110px ${FONT}`;
  ctx.fillText('Mon Wrapped', MARGIN, 230);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText(fit(ctx, `${userName} · ${period.label}`, CARD_WIDTH - MARGIN * 2), MARGIN, 310);

  let y = 450;
  y = drawList(
    ctx,
    'Top artistes',
    period.topArtists.slice(0, 5).map(({ item }) => item.name),
    y
  );
  y = drawList(
    ctx,
    'Top titres',
    period.topTracks.slice(0, 5).map(({ item }) => item.name),
    y
  );
  if (period.genresAvailable) {
    drawList(
      ctx,
      'Top genres',
      period.topGenres.slice(0, 3).map(({ genre }) => genre),
      y
    );
  }

  // Score mainstream en pied de carte
  if (period.stats.mainstreamScore !== null) {
    ctx.fillStyle = '#4ade80';
    ctx.font = `800 120px ${FONT}`;
    ctx.fillText(String(period.stats.mainstreamScore), MARGIN, CARD_HEIGHT - 170);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = `500 40px ${FONT}`;
    ctx.fillText('score mainstream', MARGIN + 190, CARD_HEIGHT - 185);
  }

  ctx.fillStyle = '#71717a';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText('My Spotify Tracker', MARGIN, CARD_HEIGHT - 80);
}
