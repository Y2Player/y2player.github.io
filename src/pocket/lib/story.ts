// Imagem para os stories (1080×1920): o aparelho na cor do humor, desenhado
// direto no canvas a partir dos mesmos tokens e proporções do aparelho real.
// Canvas em vez de "foto da tela" porque a captura de DOM falha no Safari.
import { INTERNALS } from './internals';
import { LOGO_BOX, LOGO_PATHS } from './logo';
import { composeScene, makeGrid, stamp, type Grid } from './pixels';
import { lcdText, type Mixtape } from './mixtape';
import { FINISHES, MOODS } from '../tokens';

const W = 1080;
const H = 1920;
const UI = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const PX = "'Press Start 2P', monospace";

// ─── cores ─────────────────────────────────────────────────────────────────
function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function blend(a: string, b: string, t: number) {
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v * t + B[i] * (1 - t))).join(',')})`;
}

// ─── formas ────────────────────────────────────────────────────────────────
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

// gradiente linear no ângulo CSS (0deg = para cima, sentido horário)
function cssGradient(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return c.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
}

// aro "liquid glass": fio branco que acende no alto à esquerda e embaixo à direita
function rim(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, lw: number, alpha = 1) {
  const g = cssGradient(c, x, y, w, h, 145);
  g.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`);
  g.addColorStop(0.2, `rgba(255,255,255,${0.4 * alpha})`);
  g.addColorStop(0.48, `rgba(255,255,255,${0.06 * alpha})`);
  g.addColorStop(0.78, `rgba(255,255,255,${0.28 * alpha})`);
  g.addColorStop(1, `rgba(255,255,255,${0.8 * alpha})`);
  c.save();
  rr(c, x + lw / 2, y + lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2));
  c.strokeStyle = g;
  c.lineWidth = lw;
  c.stroke();
  c.restore();
}

// ─── pixels (mesmo desenho do PixelGrid do visor) ─────────────────────────
function drawGrid(c: CanvasRenderingContext2D, g: Grid, x: number, y: number, cell: number, ink: string, oled: boolean, ghost = 0.075) {
  const s = cell * 0.84;
  const o = cell * 0.08;
  c.fillStyle = ink;
  c.globalAlpha = ghost;
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) c.fillRect(x + i * cell + o, y + j * cell + o, s, s);
  const each = (v: number, dx: number, dy: number, alpha: number) => {
    c.globalAlpha = alpha;
    for (let j = 0; j < g.h; j++)
      for (let i = 0; i < g.w; i++) if (g.px[j * g.w + i] === v) c.fillRect(x + i * cell + o + dx, y + j * cell + o + dy, s, s);
  };
  if (!oled) each(1, cell * 0.22, cell * 0.26, 0.16); // sombra no cristal
  each(2, 0, 0, 0.42);
  if (oled) {
    c.shadowColor = ink;
    c.shadowBlur = cell * 0.6;
  }
  each(1, 0, 0, 1);
  c.shadowBlur = 0;
  c.globalAlpha = 1;
}

const NOTE = ['..###', '..#.#', '..#.#', '###.#', '##.##'];
const BATT = ['######.', '#:::::#', '#:::::#', '######.'];
function icon(map: string[]) {
  const g = makeGrid(Math.max(...map.map((r) => r.length)), map.length);
  stamp(g, map, 0, 0);
  return g;
}

function spaced(c: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number, align: 'left' | 'center' | 'right') {
  // letterSpacing do canvas não existe em todo Safari: desenha letra a letra
  const widths = [...text].map((ch) => c.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  c.textAlign = 'left';
  [...text].forEach((ch, i) => {
    c.fillText(ch, cx, y);
    cx += widths[i] + tracking;
  });
  return total;
}

// encolhe a fonte até o texto caber na largura
function fit(c: CanvasRenderingContext2D, text: string, family: string, size: number, max: number) {
  let s = size;
  c.font = `${s}px ${family}`;
  while (c.measureText(text).width > max && s > 8) {
    s -= 1;
    c.font = `${s}px ${family}`;
  }
  return s;
}

// ─── ícones gravados da roda ───────────────────────────────────────────────
function wheelIcons(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, u: number, ink: string) {
  const ic = 4.2 * u;
  c.fillStyle = ink;
  c.strokeStyle = ink;
  const tri = (x: number, y: number, dir: 1 | -1) => {
    const s = ic / 24;
    c.save();
    c.translate(x - ic / 2, y - ic / 2);
    c.scale(s, s);
    if (dir === 1) {
      c.fillRect(17.6, 6, 2.4, 12);
      c.beginPath();
      c.moveTo(5, 6.6);
      c.lineTo(5, 17.4);
      c.lineTo(14.7, 12);
      c.closePath();
      c.fill();
    } else {
      c.fillRect(4, 6, 2.4, 12);
      c.beginPath();
      c.moveTo(19, 6.6);
      c.lineTo(19, 17.4);
      c.lineTo(9.3, 12);
      c.closePath();
      c.fill();
    }
    c.restore();
  };
  tri(cx - R * 0.72, cy, -1);
  tri(cx + R * 0.72, cy, 1);
  // voltar
  c.save();
  const s = ic / 24;
  c.translate(cx - ic / 2, cy + R * 0.72 - ic / 2);
  c.scale(s, s);
  c.lineWidth = 2.4;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(9, 7);
  c.lineTo(4.5, 11.5);
  c.lineTo(9, 16);
  c.moveTo(5, 11.5);
  c.lineTo(14.5, 11.5);
  c.arc(14.5, 16, 4.5, -Math.PI / 2, Math.PI / 2);
  c.lineTo(12, 20.5);
  c.stroke();
  c.restore();
  // MENU
  c.font = `500 ${2.4 * u}px ${UI}`;
  c.textBaseline = 'middle';
  spaced(c, 'MENU', cx, cy - R * 0.72, 2.4 * u * 0.16, 'center');
}

// ─── fundo Y2K: holográfico nas cores complementares ao aparelho ───────────

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;

// brilho de 4 pontas (o "✦" dos anos 2000)
function sparkle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  c.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  c.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  c.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  c.fill();
  c.restore();
}

function blob(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}

// Furta-cor em volta da cor oposta à do aparelho (matiz + 180°), para o
// aparelho saltar do fundo. Aparelho sem cor própria (Cristal) usa o botão.
function background(c: CanvasRenderingContext2D, f: (typeof FINISHES)[keyof typeof FINISHES]): string {
  const [bh, bs] = toHsl(f.body);
  const base = bs < 0.15 ? toHsl(f.accent)[0] : bh;
  const h = base + 180;
  const g = cssGradient(c, 0, 0, W, H, 155);
  [
    [h - 45, 90, 90],
    [h - 15, 95, 85],
    [h, 100, 88],
    [h + 25, 95, 90],
    [h + 55, 90, 89],
    [h - 30, 90, 86],
  ].forEach(([hh, ss, ll], i, a) => g.addColorStop(i / (a.length - 1), hsl(hh, ss, ll)));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  blob(c, 160, 260, 520, '#ffffff', 0.7);
  blob(c, 980, 1500, 600, '#ffffff', 0.55);
  blob(c, 900, 420, 380, hsl(h + 20, 100, 72), 0.4);
  blob(c, 140, 1600, 420, hsl(h - 40, 100, 74), 0.35);
  // reflexo cromado diagonal
  const sh = cssGradient(c, 0, 0, W, H, 120);
  sh.addColorStop(0.38, 'rgba(255,255,255,0)');
  sh.addColorStop(0.46, 'rgba(255,255,255,.55)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  c.fillStyle = sh;
  c.fillRect(0, 0, W, H);
  [[150, 330, 34], [930, 250, 22], [990, 1180, 30], [110, 1330, 20], [880, 1700, 18]].forEach(([x, y, r]) => sparkle(c, x, y, r, '#ffffff', 0.95));
  return hsl(h, 45, 26, 0.75);
}

// ─── imagem ────────────────────────────────────────────────────────────────
export async function renderStory(mix: Mixtape): Promise<Blob> {
  await Promise.all([document.fonts.load(`20px ${PX}`), document.fonts.load(`500 20px ${UI}`)]).catch(() => {});
  const f = FINISHES[MOODS[mix.mood].finish];
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;

  const footInk = background(c, f);

  // medidas do aparelho em "u" (1u = 1% da largura, como o cqw da tela)
  const DW = 780;
  const u = DW / 100;
  const lcdW = 89 * u;
  const lcdH = lcdW * 0.82;
  const wheelD = 62 * u;
  const DH = 5.5 * u + lcdH + 7 * u + wheelD + 7 * u;
  const x0 = (W - DW) / 2;
  const y0 = (H - DH) / 2 - 40;

  // teclas laterais (saem de baixo da casca)
  const key = (side: 'l' | 'r', top: number, h: number) => {
    const kx = side === 'l' ? x0 - 1.3 * u : x0 + DW - 1.3 * u;
    const g = c.createLinearGradient(kx, 0, kx + 2.6 * u, 0);
    const dark = 'rgba(0,0,0,.1)';
    const light = 'rgba(255,255,255,.35)';
    g.addColorStop(0, side === 'l' ? dark : light);
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, side === 'l' ? light : dark);
    rr(c, kx, y0 + top * u, 2.6 * u, h * u, side === 'l' ? [1.2 * u, 0, 0, 1.2 * u] : [0, 1.2 * u, 1.2 * u, 0]);
    c.fillStyle = f.wheel;
    c.fill();
    c.fillStyle = g;
    c.fill();
  };
  key('l', 20, 12);
  key('l', 34.5, 12);
  key('r', 19, 15);

  // corpo com degradê leve
  const body = cssGradient(c, x0, y0, DW, DH, 160);
  body.addColorStop(0, blend(f.bodyHi, f.body, 0.45));
  body.addColorStop(0.48, f.body);
  body.addColorStop(1, blend(f.bodyLo, f.body, 0.3));
  rr(c, x0, y0, DW, DH, 7 * u);
  c.fillStyle = body;
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,.04)';
  c.lineWidth = 1;
  c.stroke();
  // miolo através da carcaça transparente
  if (f.internals > 0) {
    c.save();
    rr(c, x0, y0, DW, DH, 7 * u);
    c.clip();
    c.translate(x0, y0);
    c.scale(u, u);
    c.globalAlpha = f.internals;
    c.globalCompositeOperation = f.see;
    for (const p of INTERNALS) {
      const path = new Path2D(p.d);
      if (p.fill || p.board) {
        c.fillStyle = p.board ? f.pcb : p.fill!;
        c.fill(path);
      }
      if (p.stroke) {
        c.strokeStyle = p.stroke;
        c.lineWidth = p.sw ?? 0.3;
        c.stroke(path);
      }
    }
    c.restore();
  }
  rim(c, x0, y0, DW, DH, 7 * u, 0.28 * u, 0.55);

  // visor
  const lx = x0 + 5.5 * u;
  const ly = y0 + 5.5 * u;
  const lr = 5 * u;
  c.save();
  rr(c, lx, ly, lcdW, lcdH, lr);
  c.fillStyle = f.lcdBg;
  c.fill();
  c.clip();
  const sh = c.createLinearGradient(0, ly, 0, ly + 3 * u);
  sh.addColorStop(0, f.oled ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.14)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh;
  c.fillRect(lx, ly, lcdW, 3 * u);

  // conteúdo do visor
  const ink = f.lcdInk;
  const px0 = lx + 5.4 * u;
  const pw = lcdW - 10.8 * u;
  let cy = ly + 4 * u;
  // barra de status
  const iconH = 1.9 * u;
  drawGrid(c, icon(NOTE), px0, cy, iconH / 5, ink, f.oled, 0);
  c.fillStyle = ink;
  c.font = `${2.1 * u}px ${PX}`;
  c.textBaseline = 'top';
  c.textAlign = 'left';
  c.fillText(`${String(mix.tracks.length).padStart(2, '0')} FAIXAS`, px0 + iconH * 1.3, cy + 0.1 * u);
  drawGrid(c, icon(BATT), px0 + pw - 1.8 * u * 1.75, cy + 0.1 * u, (1.8 * u) / 4, ink, f.oled, 0);
  cy += 3.2 * u + 1.8 * u;
  c.globalAlpha = 0.18;
  c.fillRect(px0, cy, pw, 0.35 * u);
  c.globalAlpha = 1;
  cy += 0.35 * u;

  // bichinho dançando + nome + de/pra, centralizados na altura que sobra do visor
  const grid = composeScene({ mood: mix.mood, tick: 2, playing: true, w: 40, h: 24, charX: 10 });
  const cell = (pw * 0.86) / grid.w;
  const block = cell * grid.h + 3.4 * u + 3.6 * u + 2 * u + 2.2 * u;
  cy += (ly + lcdH - 4.4 * u - cy - block) / 2;
  drawGrid(c, grid, px0 + (pw - cell * grid.w) / 2, cy, cell, ink, f.oled);
  cy += cell * grid.h + 3.4 * u;

  // nome do mix e de/pra
  c.fillStyle = ink;
  c.textAlign = 'center';
  const title = lcdText(mix.title || 'Um mix pra você');
  fit(c, title, PX, 3.6 * u, pw);
  c.fillText(title, lx + lcdW / 2, cy);
  cy += 3.6 * u + 2 * u;
  const who = lcdText(
    mix.from && mix.to ? `De ${mix.from} pra ${mix.to}` : mix.from ? `De ${mix.from}` : mix.to ? `Pra ${mix.to}` : '',
  );
  if (who) {
    c.globalAlpha = 0.62;
    fit(c, who, PX, 2.2 * u, pw);
    c.fillText(who, lx + lcdW / 2, cy);
    c.globalAlpha = 1;
  }

  // vidro: reflexo diagonal só nos visores claros (na tela escura ele pesa demais)
  if (!f.oled) {
    const glass = cssGradient(c, lx, ly, lcdW, lcdH, 118);
    glass.addColorStop(0, 'rgba(255,255,255,.16)');
    glass.addColorStop(0.34, 'rgba(255,255,255,.05)');
    glass.addColorStop(0.342, 'rgba(255,255,255,0)');
    glass.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glass;
    c.fillRect(lx, ly, lcdW, lcdH);
  }
  c.restore();
  rim(c, lx, ly, lcdW, lcdH, lr, 0.5 * u);

  // roda
  const wcx = x0 + DW / 2;
  const wcy = ly + lcdH + 7 * u + wheelD / 2;
  const R = wheelD / 2;
  c.beginPath();
  c.arc(wcx, wcy, R, 0, Math.PI * 2);
  c.fillStyle = f.wheel;
  c.fill();
  // ticks do anel
  c.save();
  c.strokeStyle = f.keyInk;
  c.globalAlpha = 0.16;
  c.lineWidth = Math.max(1, R * 0.012);
  for (let a = 0; a < 360; a += 7.5) {
    const t = (a * Math.PI) / 180;
    const r0 = (R - 1.6 * u) * 0.905;
    const r1 = (R - 1.6 * u) * 0.95;
    c.beginPath();
    c.moveTo(wcx + Math.cos(t) * r0, wcy + Math.sin(t) * r0);
    c.lineTo(wcx + Math.cos(t) * r1, wcy + Math.sin(t) * r1);
    c.stroke();
  }
  c.restore();
  rim(c, wcx - R, wcy - R, wheelD, wheelD, R, 0.5 * u);
  wheelIcons(c, wcx, wcy, R, u, f.keyInk);

  // botão central
  const cr = 11 * u;
  c.beginPath();
  c.arc(wcx, wcy + 0.45 * u, cr, 0, Math.PI * 2);
  c.fillStyle = f.accentLo;
  c.fill();
  c.beginPath();
  c.arc(wcx, wcy, cr, 0, Math.PI * 2);
  c.fillStyle = f.accent;
  c.fill();
  rim(c, wcx - cr, wcy - cr, cr * 2, cr * 2, cr, 0.4 * u);
  // pausa (está tocando)
  c.fillStyle = f.accentInk;
  const ps = 6.4 * u;
  rr(c, wcx - ps * 0.25 - ps * 0.0875, wcy - ps * 0.29, ps * 0.175, ps * 0.58, ps * 0.03);
  c.fill();
  rr(c, wcx + ps * 0.25 - ps * 0.0875, wcy - ps * 0.29, ps * 0.175, ps * 0.58, ps * 0.03);
  c.fill();

  // rodapé: o logo, centrado onde antes ficava o nome escrito
  const lh = 44;
  const ls = lh / LOGO_BOX.h;
  c.save();
  c.translate(W / 2 - (LOGO_BOX.w * ls) / 2, H - 131 - lh / 2);
  c.scale(ls, ls);
  c.translate(-LOGO_BOX.x, -LOGO_BOX.y);
  c.fillStyle = footInk;
  for (const d of LOGO_PATHS) c.fill(new Path2D(d));
  c.restore();

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
}
