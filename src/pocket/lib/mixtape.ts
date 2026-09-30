import type { FinishId, MoodId } from '../tokens';
import { MOODS } from '../tokens';

export interface Track {
  id: string; // YouTube video id
  title: string;
  author: string;
}

export interface Mixtape {
  v: 1;
  mood: MoodId;
  finish: FinishId;
  title: string;
  from: string;
  to: string;
  note: string;
  tracks: Track[];
}

// uma mixtape tem de 2 a 5 faixas
export const MIN_TRACKS = 2;
export const MAX_TRACKS = 5;

export const LIMITS = { title: 26, from: 20, to: 20, note: 280 };

// ─── YouTube ────────────────────────────────────────────────────────────────

export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([\w-]{11})/,
  );
  return m ? m[1] : null;
}

const infoCache = new Map<string, Promise<Track>>();

export function fetchTrackInfo(id: string): Promise<Track> {
  const hit = infoCache.get(id);
  if (hit) return hit;
  const p = (async () => {
    const url = encodeURIComponent(`https://www.youtube.com/watch?v=${id}`);
    const res = await fetch(`https://noembed.com/embed?url=${url}`);
    if (!res.ok) throw new Error('network');
    const data = await res.json();
    if (data.error || !data.title) throw new Error('not-found');
    return { id, title: String(data.title), author: String(data.author_name ?? 'YouTube') };
  })();
  infoCache.set(id, p);
  p.catch(() => infoCache.delete(id));
  return p;
}

export const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/default.jpg`;

// ─── Link compartilhável (tudo no hash, sem backend) ───────────────────────

function toBase64Url(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeMixtape(m: Mixtape): string {
  const compact = {
    v: 1,
    m: m.mood,
    f: m.finish,
    t: m.title,
    d: m.from,
    p: m.to,
    n: m.note,
    k: m.tracks.map((t) => [t.id, t.title, t.author]),
  };
  return toBase64Url(JSON.stringify(compact));
}

export function decodeMixtape(data: string): Mixtape | null {
  try {
    const c = JSON.parse(fromBase64Url(data));
    if (c.v !== 1 || !Array.isArray(c.k)) return null;
    const mood: MoodId = c.m in MOODS ? c.m : 'groovy';
    // a cor do aparelho é a do humor (links antigos com outro acabamento se ajustam)
    const finish: FinishId = MOODS[mood].finish;
    return {
      v: 1,
      mood,
      finish,
      title: String(c.t ?? '').slice(0, LIMITS.title),
      from: String(c.d ?? '').slice(0, LIMITS.from),
      to: String(c.p ?? '').slice(0, LIMITS.to),
      note: String(c.n ?? '').slice(0, LIMITS.note),
      tracks: c.k
        .filter((k: unknown) => Array.isArray(k) && typeof k[0] === 'string' && /^[\w-]{11}$/.test(k[0]))
        .slice(0, MAX_TRACKS)
        .map((k: string[]) => ({ id: k[0], title: String(k[1] ?? ''), author: String(k[2] ?? '') })),
    };
  } catch {
    return null;
  }
}

export function shareUrl(m: Mixtape) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/m/${encodeMixtape(m)}`;
}

// ─── Demo ──────────────────────────────────────────────────────────────────

export const DEMO_URLS = [
  'https://www.youtube.com/watch?v=OPf0YbXqDm0',
  'https://youtu.be/Zi_XLOBDo_Y',
  'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
  'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
  'https://www.youtube.com/watch?v=ZbZSe6N_BXs',
];

export const DEMO: Mixtape = {
  v: 1,
  mood: 'groovy',
  finish: 'tangerina',
  title: 'Lado A pra você',
  from: 'Leo',
  to: 'Ana',
  note:
    'Fiz essa seleção pra tocar no seu caminho de volta pra casa. A faixa 3 é aquela do karaokê, lembra? Aumenta o volume no refrão.',
  tracks: [
    { id: 'OPf0YbXqDm0', title: 'Mark Ronson - Uptown Funk ft. Bruno Mars', author: 'Mark Ronson' },
    { id: 'Zi_XLOBDo_Y', title: 'Michael Jackson - Billie Jean', author: 'Michael Jackson' },
    { id: 'fJ9rUzIMcZQ', title: 'Queen – Bohemian Rhapsody', author: 'Queen Official' },
    { id: '4NRXx6U8ABQ', title: 'The Weeknd - Blinding Lights', author: 'The Weeknd' },
    { id: 'ZbZSe6N_BXs', title: 'Pharrell Williams - Happy', author: 'Pharrell Williams' },
  ],
};

// Texto de visor: caixa alta, sem acentos (o LCD não tem esses glifos).
export function lcdText(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

// Limpa sufixos comuns de título do YouTube para caber no visor.
export function lcdTitle(title: string) {
  return title
    .replace(/\s*[([](official|oficial|lyric|audio|video|clipe|hd|4k|remaster)[^)\]]*[)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lcdAuthor(author: string) {
  return author.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim();
}

export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
