// Encurtador do Y2Player: guarda o mix e devolve um código de 5 letras.
// O site em si são arquivos estáticos servidos pela Cloudflare sem passar por aqui;
// este Worker só roda em /api/*.
//
// Tudo no plano grátis, sem cartão: se a cota do dia acabar, a Cloudflare recusa
// a requisição (não cobra). O app então cai no link longo, que abre sem servidor.

interface Env {
  DB: D1Database;
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
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

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
