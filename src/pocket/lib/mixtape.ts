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

// Busca no YouTube pelo nosso servidor (a chave da API fica lá).
// Erros: 'quota' quando a cota grátis do dia acabou; 'error' para o resto (sem rede, servidor fora).
export async function searchTracks(q: string): Promise<Track[]> {
  let res: Response;
  try {
    res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
  } catch {
    throw new Error('error');
  }
  if (res.status === 429) throw new Error('quota');
  if (!res.ok) throw new Error('error');
  const data = (await res.json()) as { results?: Track[] };
  return data.results ?? [];
}

// Sugestões enquanto digita (as mesmas da caixa de busca do YouTube). Não gastam a cota;
// se falharem, volta lista vazia e a pessoa busca normalmente.
export async function suggestQueries(q: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/suggest?q=${encodeURIComponent(q.trim())}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: string[] };
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

// texto que parece link (e não uma busca por nome). Um código solto de 11 caracteres só conta
// se tiver número, maiúscula, _ ou -: uma palavra de 11 letras minúsculas é busca.
export function looksLikeLink(input: string) {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return /[0-9A-Z_-]/.test(s);
  return /^(https?:\/\/|www\.)|youtu\.?be|\.com\b|\//i.test(s);
}

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

// ─── Link curto (formato 2) ────────────────────────────────────────────────
// Só o essencial viaja no link: humor, textos e os ids do YouTube (11 letras cada).
// Título e canal das faixas são lidos do YouTube na hora de tocar.
// Campos separados por U+0001; comprimido (deflate) só quando fica menor.
// Prefixo "~" marca o comprimido. Links do formato 1 (#/m/…) continuam abrindo.

const SEP = '\u0001';
const MOOD_CODE: Record<MoodId, string> = { groovy: 'g', romantic: 'r', melancholy: 'm', focus: 'f', flirty: 'p', swagger: 's' };
const CODE_MOOD = Object.fromEntries(Object.entries(MOOD_CODE).map(([k, v]) => [v, k])) as Record<string, MoodId>;

function bytesToB64Url(bytes: Uint8Array) {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToBytes(b64: string) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShort(m: Mixtape): Promise<string> {
  const clean = (s: string) => s.split(SEP).join(' ');
  const text = [MOOD_CODE[m.mood], clean(m.title), clean(m.from), clean(m.to), clean(m.note), m.tracks.map((t) => t.id).join('')].join(SEP);
  const bytes = new TextEncoder().encode(text);
  const raw = bytesToB64Url(bytes);
  if (typeof CompressionStream === 'undefined') return raw;
  try {
    const packed = '~' + bytesToB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    return packed.length < raw.length ? packed : raw;
  } catch {
    return raw;
  }
}

export async function decodeShort(hash: string): Promise<Mixtape | null> {
  try {
    const packed = hash.startsWith('~');
    let bytes = b64UrlToBytes(packed ? hash.slice(1) : hash);
    if (packed) bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    const [code, title = '', from = '', to = '', note = '', ids = ''] = new TextDecoder().decode(bytes).split(SEP);
    const mood = CODE_MOOD[code];
    if (!mood) return null;
    const tracks = (ids.match(/[\w-]{11}/g) ?? []).slice(0, MAX_TRACKS).map((id, i) => placeholderTrack(id, i));
    if (!tracks.length) return null;
    return {
      v: 1,
      mood,
      finish: MOODS[mood].finish,
      title: title.slice(0, LIMITS.title),
      from: from.slice(0, LIMITS.from),
      to: to.slice(0, LIMITS.to),
      note: note.slice(0, LIMITS.note),
      tracks,
    };
  } catch {
    return null;
  }
}

// nome provisório até o YouTube responder (o mesmo de quando não há rede)
export function placeholderTrack(id: string, i: number): Track {
  return { id, title: `Faixa ${String(i + 1).padStart(2, '0')}`, author: 'YouTube' };
}

// ─── Link curtíssimo (formato 3) ───────────────────────────────────────────
// O mix fica guardado no y2player.com e o link leva só um código: y2player.com/k7Hq2.
// O que fica guardado é o próprio texto do formato 2. Se o servidor não responder
// (fora do ar, cota do dia esgotada, outro endereço), o link sai no formato 2,
// que abre sem servidor nenhum.

export const SHORT_PATH = /^\/([2-9a-km-zA-HJ-NP-Z]{5})$/;
const cacheKey = (code: string) => `y2p:mix:${code}`;

function remember(code: string, hash: string) {
  try {
    localStorage.setItem(cacheKey(code), hash);
  } catch {
    // sem armazenamento local, o mix só não reabre offline
  }
}

export async function shareUrl(m: Mixtape) {
  const hash = await encodeShort(m);
  const long = `${location.origin}${location.pathname}#${hash}`;
  try {
    const res = await fetch('/api/mix', { method: 'POST', body: hash });
    const code = res.ok ? (await res.text()).trim() : '';
    if (!SHORT_PATH.test(`/${code}`)) return long;
    remember(code, hash);
    return `${location.origin}/${code}`;
  } catch {
    return long;
  }
}

// null: o código não existe. 'unavailable': o servidor não respondeu agora.
export async function loadShortCode(code: string): Promise<Mixtape | null | 'unavailable'> {
  let hash: string | null = null;
  try {
    hash = localStorage.getItem(cacheKey(code));
  } catch {
    // segue para o servidor
  }
  if (!hash) {
    try {
      const res = await fetch(`/api/mix/${code}`);
      if (res.status === 404) return null;
      if (!res.ok) return 'unavailable';
      hash = (await res.text()).trim();
      remember(code, hash);
    } catch {
      return 'unavailable';
    }
  }
  return decodeShort(hash);
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
