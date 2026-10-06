// Encurtador do Y2Player: guarda o mix e devolve um código de 5 letras.
// Também faz a busca de músicas no YouTube (a chave da API fica só aqui).
// O site em si são arquivos estáticos servidos pela Cloudflare sem passar por aqui;
// este Worker só roda em /api/*.
//
// Tudo no plano grátis, sem cartão: se a cota do dia acabar, a Cloudflare recusa
// a requisição (não cobra). O app então cai no link longo, que abre sem servidor.

interface Env {
  DB: D1Database;
  // chave da YouTube Data API (secret: npx wrangler secret put YOUTUBE_KEY)
  YOUTUBE_KEY?: string;
}

// sem 0/O, 1/l/I: o código pode ser lido em voz alta ou digitado sem confusão
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LEN = 5;
const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LEN}}$`);
// o mesmo formato do link longo (#…): base64url, com "~" quando comprimido
const PAYLOAD_RE = /^~?[A-Za-z0-9_-]{8,1500}$/;

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const text = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...headers } });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

// os títulos do YouTube vêm com entidades HTML (&amp;, &#39;…)
function unescapeHtml(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// só o próprio site usa a busca (o navegador manda de qual página veio a chamada)
const SEARCH_FROM = new Set(['y2player.com', 'www.y2player.com', 'localhost', '127.0.0.1']);
// buscas novas por pessoa por dia: um mix tem até 5 músicas, sobra folga pra errar o nome.
// As sugestões (abaixo) não contam: elas não gastam a cota do YouTube.
const SEARCH_PER_DAY = 50;

// vem de uma página do próprio site?
function fromSite(req: Request) {
  try {
    return SEARCH_FROM.has(new URL(req.headers.get('referer') ?? '').hostname);
  } catch {
    return false;
  }
}

// Sugestões enquanto a pessoa digita, as mesmas da caixa de busca do YouTube
// (corrigem erro de digitação). Endpoint público do Google, sem chave e sem cota;
// não é uma API oficial, então se um dia parar, a busca normal continua funcionando.
async function suggest(req: Request, ctx: ExecutionContext) {
  const url = new URL(req.url);
  if (!fromSite(req)) return json({ error: 'forbidden' }, 403);
  const q = (url.searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!q || q.length > 100) return json({ suggestions: [] });
  const cache = caches.default;
  const key = new Request(`${url.origin}/api/suggest?q=${encodeURIComponent(q)}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const api = new URL('https://suggestqueries.google.com/complete/search');
  api.search = new URLSearchParams({ client: 'firefox', ds: 'yt', hl: 'pt-BR', gl: 'BR', q }).toString();
  try {
    const r = await fetch(api);
    const data = (await r.json()) as [string, string[]];
    const suggestions = (Array.isArray(data?.[1]) ? data[1] : []).filter((x) => typeof x === 'string').slice(0, 6);
    const res = json({ suggestions }, 200, { 'cache-control': 'public, max-age=86400' });
    ctx.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch {
    return json({ suggestions: [] });
  }
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Conta as buscas de cada pessoa no dia sem guardar o endereço dela: fica só um resumo
// (hash) do IP com o dia, que não volta a ser IP. Linhas de dias anteriores são apagadas.
async function overLimit(req: Request, env: Env, ctx: ExecutionContext) {
  const day = new Date().toISOString().slice(0, 10);
  const who = await sha256(`${req.headers.get('cf-connecting-ip') ?? ''}|${day}`);
  const n = await env.DB.prepare(
    'INSERT INTO search_hits (who, day, n) VALUES (?, ?, 1) ON CONFLICT(who) DO UPDATE SET n = n + 1 RETURNING n',
  )
    .bind(who, day)
    .first<number>('n');
  ctx.waitUntil(env.DB.prepare('DELETE FROM search_hits WHERE day < ?').bind(day).run());
  return (n ?? 0) > SEARCH_PER_DAY;
}

// Busca no YouTube: a cota grátis é de 100 buscas por dia para o site todo, então a mesma
// busca fica guardada no cache da Cloudflare por uma semana e não gasta cota de novo.
// Só vídeos que tocam fora do YouTube (os que o player consegue tocar), com o Brasil como região.
async function search(req: Request, env: Env, ctx: ExecutionContext) {
  const url = new URL(req.url);
  if (!fromSite(req)) return json({ error: 'forbidden' }, 403);
  const q = (url.searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!q || q.length > 100) return json({ error: 'query' }, 400);
  if (!env.YOUTUBE_KEY) return json({ error: 'off' }, 503);

  const cache = caches.default;
  const key = new Request(`${url.origin}/api/search?q=${encodeURIComponent(q)}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  // busca repetida (acima) não gasta cota; só a nova conta no limite da pessoa
  if (await overLimit(req, env, ctx)) return json({ error: 'quota' }, 429);

  const api = new URL('https://www.googleapis.com/youtube/v3/search');
  api.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    regionCode: 'BR',
    maxResults: '6',
    q,
    key: env.YOUTUBE_KEY,
  }).toString();
  const r = await fetch(api);
  if (!r.ok) {
    const body = await r.text();
    // cota do dia acabou: o app avisa e a pessoa cola o link
    if (r.status === 403 && body.includes('quota')) return json({ error: 'quota' }, 429);
    return json({ error: 'youtube' }, 502);
  }
  const data = (await r.json()) as {
    items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }[];
  };
  const results = (data.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      id: it.id!.videoId!,
      title: unescapeHtml(it.snippet?.title ?? ''),
      author: unescapeHtml(it.snippet?.channelTitle ?? ''),
    }));
  const res = json({ results }, 200, { 'cache-control': 'public, max-age=604800' });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function save(env: Env, payload: string) {
  // o mesmo mix compartilhado de novo ganha o mesmo código
  const found = await env.DB.prepare('SELECT code FROM mixes WHERE payload = ?').bind(payload).first<string>('code');
  if (found) return found;
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const r = await env.DB.prepare('INSERT OR IGNORE INTO mixes (code, payload, created_at) VALUES (?, ?, ?)')
      .bind(code, payload, Date.now())
      .run();
    if (r.meta.changes === 1) return code;
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/api/search' && req.method === 'GET') return search(req, env, ctx);
    if (url.pathname === '/api/suggest' && req.method === 'GET') return suggest(req, ctx);

    if (url.pathname === '/api/mix' && req.method === 'POST') {
      const payload = (await req.text()).trim();
      if (!PAYLOAD_RE.test(payload)) return text('mix inválido', 400);
      const code = await save(env, payload);
      return code ? text(code, 201) : text('sem código livre', 503);
    }

    const m = url.pathname.match(/^\/api\/mix\/([^/]+)$/);
    if (m && req.method === 'GET') {
      if (!CODE_RE.test(m[1])) return text('não encontrado', 404);
      const payload = await env.DB.prepare('SELECT payload FROM mixes WHERE code = ?').bind(m[1]).first<string>('payload');
      if (!payload) return text('não encontrado', 404);
      // um mix nunca muda depois de criado
      return text(payload, 200, { 'cache-control': 'public, max-age=31536000, immutable' });
    }

    return text('não encontrado', 404);
  },
};
