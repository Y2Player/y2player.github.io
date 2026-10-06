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
function blend(a: string, b: string, t: number, al = 1) {
  const A = rgb(a);
  const B = rgb(b);
  const m = A.map((v, i) => Math.round(v * t + B[i] * (1 - t))).join(',');
  return al === 1 ? `rgb(${m})` : `rgba(${m},${al})`;
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

// cor com transparência (o color-mix(X n%, transparent) do CSS)
function alpha(hex: string, a: number) {
  return `rgba(${rgb(hex).join(',')},${a})`;
}

// Sombra interna do CSS (box-shadow inset), com a mesma conta: a forma vazada
// é desenhada longe da tela e só a sombra dela cai no lugar, presa dentro da forma.
// `shape(grow)` traça o contorno crescido (ou encolhido, se negativo) sem beginPath.
type Shape = (grow: number) => void;
function insetShadow(c: CanvasRenderingContext2D, shape: Shape, ox: number, oy: number, blur: number, spread: number, color: string) {
  // a forma vai pra x+D (fora da tela) dentro de um retângulo de ±M; a sombra volta -D
  const D = 20000;
  const M = 10000;
  c.save();
  c.beginPath();
  shape(0);
  c.clip();
  c.translate(D, 0);
  c.beginPath();
  c.rect(-M, -M, 2 * M, 2 * M);
  shape(-spread);
  c.shadowColor = color;
  c.shadowBlur = blur;
  c.shadowOffsetX = ox - D;
  c.shadowOffsetY = oy;
  c.fillStyle = '#000';
  c.fill('evenodd');
  c.restore();
}
const roundShape = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): Shape => (g) =>
  c.roundRect(x - g, y - g, w + 2 * g, h + 2 * g, Math.max(0, r + g));
const circleShape = (c: CanvasRenderingContext2D, cx: number, cy: number, r: number): Shape => (g) => {
  c.moveTo(cx + r + g, cy);
  c.arc(cx, cy, r + g, 0, Math.PI * 2);
};

// radial-gradient(rx ry at cx cy, …) do CSS: degradê elíptico pintando o retângulo todo
function ellipseGradient(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  stops: [number, string][],
) {
  c.save();
  c.translate(cx, cy);
  c.scale(rx, ry);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g;
  c.fillRect((x - cx) / rx, (y - cy) / ry, w / rx, h / ry);
  c.restore();
}

// Reflexo molhado (.pp-shine): a borda de um retângulo arredondado em branco,
// que some ao longo da altura e da largura (as duas máscaras do CSS, multiplicadas).
// fromTop/fromLeft dizem de que lado o brilho nasce; cada máscara vai de opaco em a até zero em b.
function shineBand(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  lw: number,
  al: number,
  v: { fromTop: boolean; a: number; b: number },
  hz: { fromLeft: boolean; a: number; b: number },
) {
  const off = document.createElement('canvas');
  off.width = Math.ceil(w);
  off.height = Math.ceil(h);
  const o = off.getContext('2d')!;
  o.beginPath();
  o.roundRect(lw / 2, lw / 2, w - lw, h - lw, Math.max(0, r - lw / 2));
  o.strokeStyle = `rgba(255,255,255,${al})`;
  o.lineWidth = lw;
  o.stroke();
  o.globalCompositeOperation = 'destination-in';
  const gv = v.fromTop ? o.createLinearGradient(0, 0, 0, h) : o.createLinearGradient(0, h, 0, 0);
  gv.addColorStop(v.a, '#000');
  gv.addColorStop(v.b, 'rgba(0,0,0,0)');
  o.fillStyle = gv;
  o.fillRect(0, 0, w, h);
  const gh = hz.fromLeft ? o.createLinearGradient(0, 0, w, 0) : o.createLinearGradient(w, 0, 0, 0);
  gh.addColorStop(hz.a, '#000');
  gh.addColorStop(hz.b, 'rgba(0,0,0,0)');
  o.fillStyle = gh;
  o.fillRect(0, 0, w, h);
  c.drawImage(off, x, y);
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
// fundo neutro, quase branco: um cinza claro liso que escurece de leve até embaixo (bem Apple)
function background(c: CanvasRenderingContext2D): string {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#F5F5F7');
  g.addColorStop(1, '#E8E8ED');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // tinta do logo do rodapé
  return '#6E6E73';
}

// ─── imagem ────────────────────────────────────────────────────────────────
// Com fundo: o story pronto (1080×1920, fundo furta-cor e logo embaixo).
// Sem fundo: só o aparelho em PNG vazado, pra virar adesivo em cima de outra foto.
export async function renderStory(mix: Mixtape, { transparent = false } = {}): Promise<Blob> {
  await Promise.all([document.fonts.load(`20px ${PX}`), document.fonts.load(`500 20px ${UI}`)]).catch(() => {});
  const f = FINISHES[MOODS[mix.mood].finish];
  // medidas do aparelho em "u" (1u = 1% da largura, como o cqw da tela)
  const DW = transparent ? 1000 : 780;
  const u = DW / 100;
  const lcdW = 89 * u;
  const lcdH = lcdW * 0.82;
  const wheelD = 62 * u;
  const DH = 5.5 * u + lcdH + 7 * u + wheelD + 7 * u;
  // sem fundo, o canvas é só o aparelho; a folga cobre as teclas laterais
  const pad = 3 * u;
  const cv = document.createElement('canvas');
  cv.width = transparent ? Math.ceil(DW + pad * 2) : W;
  cv.height = transparent ? Math.ceil(DH + pad * 2) : H;
  const c = cv.getContext('2d')!;

  const footInk = transparent ? '' : background(c);
  const x0 = transparent ? pad : (W - DW) / 2;
  const y0 = transparent ? pad : (H - DH) / 2 - 40;

  // teclas laterais (saem de baixo da casca): cilindro de gel, mesmo .pp-sidekey
  const key = (side: 'l' | 'r', top: number, h: number) => {
    const kx = side === 'l' ? x0 - 1.3 * u : x0 + DW - 1.3 * u;
    const ky = y0 + top * u;
    const kw = 2.6 * u;
    const kh = h * u;
    const g = side === 'l' ? c.createLinearGradient(kx, 0, kx + kw, 0) : c.createLinearGradient(kx + kw, 0, kx, 0);
    g.addColorStop(0, f.accentLo);
    g.addColorStop(0.2, blend(f.accent, '#ffffff', 0.45));
    g.addColorStop(0.38, f.accent);
    g.addColorStop(1, f.accent);
    const e = { x: 1.3 * u, y: 2.6 * u };
    const radii = side === 'l' ? [e, 0, 0, e] : [0, e, e, 0];
    const shape: Shape = (gr) => c.roundRect(kx - gr, ky - gr, kw + 2 * gr, kh + 2 * gr, radii);
    c.beginPath();
    shape(0);
    c.fillStyle = g;
    c.fill();
    insetShadow(c, shape, 0, -0.9 * u, 0.8 * u, -0.5 * u, alpha(f.accentLo, 0.7));
    insetShadow(c, shape, 0, 0.9 * u, 0.8 * u, -0.5 * u, 'rgba(255,255,255,0.45)');
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
  // gel: miolo visto através da carcaça (tingido e borrado) + espessura e brilho da casca.
  // Mesmas camadas do .pp-internals e do .pp-gel na tela.
  if (f.internals > 0) {
    const a = (hex: string, al: number) => `rgba(${rgb(hex).join(',')},${al})`;
    const R = 7 * u;

    // miolo desenhado à parte e colado com o filtro do gel
    const inner = document.createElement('canvas');
    inner.width = Math.ceil(DW);
    inner.height = Math.ceil(DH);
    const ic = inner.getContext('2d')!;
    ic.scale(u, u);
    for (const p of INTERNALS) {
      const path = new Path2D(p.d);
      if (p.fill || p.board) {
        ic.fillStyle = p.board ? f.pcb : p.fill!;
        ic.fill(path);
      }
      if (p.stroke) {
        ic.strokeStyle = p.stroke;
        ic.lineWidth = p.sw ?? 0.3;
        ic.stroke(path);
      }
    }
    c.save();
    rr(c, x0, y0, DW, DH, R);
    c.clip();
    c.globalAlpha = f.internals;
    c.globalCompositeOperation = f.see;
    const warm = f.see === 'screen' ? 0.6 : 0;
    c.filter = `grayscale(1) sepia(${warm}) contrast(0.7) brightness(1.12) blur(${0.22 * u}px)`;
    c.drawImage(inner, x0, y0);
    c.filter = 'none';
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // .pp-gel: luz atravessando o gel (atrás da roda e no meio)
    ellipseGradient(c, x0, y0, DW, DH, x0 + DW / 2, y0 + DH * 0.72, DW * 0.75, DH * 0.4, [
      [0, a(f.bodyHi, 0.45)],
      [0.7, a(f.bodyHi, 0)],
    ]);
    ellipseGradient(c, x0, y0, DW, DH, x0 + DW / 2, y0 + DH * 0.38, DW * 0.6, DH * 0.3, [
      [0, a(f.bodyHi, 0.22)],
      [0.7, a(f.bodyHi, 0)],
    ]);
    // sombras internas do gel, de baixo pra cima: faixa saturada, luz saindo embaixo, fio na aresta
    const body = roundShape(c, x0, y0, DW, DH, R);
    insetShadow(c, body, 0, 0, 4 * u, 2.4 * u, a(f.bodyLo, 0.38));
    insetShadow(c, body, 0, -2.6 * u, 2.2 * u, -1.4 * u, blend(f.bodyHi, '#ffffff', 0.85));
    insetShadow(c, body, 0, 0, 0, 0.5 * u, a(f.bodyHi, 0.7));
    // parede interna da casca: degrau nítido com sombra pra dentro
    c.save();
    c.globalAlpha = 0.85;
    const wi = 2.4 * u;
    const bw = 0.3 * u;
    rr(c, x0 + wi + bw / 2, y0 + wi + bw / 2, DW - 2 * wi - bw, DH - 2 * wi - bw, 5 * u - bw / 2);
    c.strokeStyle = a(f.bodyHi, 0.75);
    c.lineWidth = bw;
    c.stroke();
    insetShadow(c, roundShape(c, x0 + wi + bw, y0 + wi + bw, DW - 2 * (wi + bw), DH - 2 * (wi + bw), 5 * u - bw), 0.2 * u, 0.35 * u, 0.9 * u, 0, a(f.bodyLo, 0.45));
    c.restore();
    // ombro arredondado: a borda que encara a luz clareia, a oposta afunda
    c.save();
    c.beginPath();
    c.roundRect(x0, y0, DW, DH, R);
    c.roundRect(x0 + wi, y0 + wi, DW - 2 * wi, DH - 2 * wi, R - wi);
    c.clip('evenodd');
    const sh = cssGradient(c, x0, y0, DW, DH, 150);
    sh.addColorStop(0, a(f.bodyHi, 0.7));
    sh.addColorStop(0.3, a(f.bodyHi, 0.3));
    sh.addColorStop(0.55, a(f.bodyHi, 0));
    sh.addColorStop(0.55, a(f.bodyLo, 0));
    sh.addColorStop(1, a(f.bodyLo, 0.4));
    c.fillStyle = sh;
    c.fillRect(x0, y0, DW, DH);
    c.restore();
    // reflexo molhado: faixa nítida no ombro de cima à esquerda e outra menor embaixo à direita
    const si = 1.05 * u;
    shineBand(c, x0 + si, y0 + si, DW - 2 * si, DH - 2 * si, 6 * u, 1.15 * u, 0.62, { fromTop: true, a: 0.06, b: 0.58 }, { fromLeft: true, a: 0.08, b: 0.62 });
    shineBand(c, x0 + si, y0 + si, DW - 2 * si, DH - 2 * si, 6 * u, 0.7 * u, 0.5, { fromTop: false, a: 0.04, b: 0.3 }, { fromLeft: false, a: 0.06, b: 0.4 });
    c.restore();
  }
  rim(c, x0, y0, DW, DH, 7 * u, 0.28 * u, 0.55);

  // visor
  const lx = x0 + 5.5 * u;
  const ly = y0 + 5.5 * u;
  const lr = 5 * u;
  // rebaixo do plástico em volta do visor e da roda (box-shadow de fora: só o anel, nunca por baixo da peça)
  const seat = (sx: number, sy: number, sw: number, sh: number, r: number, round: boolean) => {
    const path = (g: number) => {
      if (round) {
        c.moveTo(sx + sw + g, sy + sh / 2);
        c.arc(sx + sw / 2, sy + sh / 2, sw / 2 + g, 0, Math.PI * 2);
      } else c.roundRect(sx - g, sy - g, sw + 2 * g, sh + 2 * g, r + g);
    };
    for (const [g, col] of [
      [1.15 * u, alpha(f.bodyHi, 0.8)],
      [0.8 * u, alpha(f.bodyLo, 0.42)],
    ] as const) {
      c.beginPath();
      path(g);
      path(0);
      c.fillStyle = col;
      c.fill('evenodd');
    }
  };
  seat(lx, ly, lcdW, lcdH, lr, false);
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
  const faixas = `${String(mix.tracks.length).padStart(2, '0')} FAIXAS`;
  c.fillText(faixas, px0 + iconH * 1.3, cy + 0.1 * u);
  // de onde veio: o endereço no canto direito da barra, no lugar da bateria
  c.textAlign = 'right';
  c.fillText('Y2PLAYER.COM', px0 + pw, cy + 0.1 * u);
  c.textAlign = 'left';
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
  seat(wcx - R, wcy - R, wheelD, wheelD, R, true);
  // plástico leitoso: deixa passar um pouco da cor e do miolo do aparelho
  const disc = circleShape(c, wcx, wcy, R);
  c.save();
  c.beginPath();
  disc(0);
  c.clip();
  ellipseGradient(c, wcx - R, wcy - R, wheelD, wheelD, wcx - R + 0.3 * wheelD, wcy - R + 0.2 * wheelD, 1.2 * wheelD, 1.2 * wheelD, [
    [0, blend(f.keyHi, f.wheel, 0.7, 0.88)],
    [0.46, alpha(f.wheel, 0.8)],
    [1, blend(f.keyLo, f.wheel, 0.38, 0.76)],
  ]);
  c.restore();
  insetShadow(c, disc, 0, -1.2 * u, 2.4 * u, 0, alpha(f.keyLo, 0.45));
  insetShadow(c, disc, 0, 0.9 * u, 1.4 * u, 0, 'rgba(255,255,255,0.55)');
  insetShadow(c, disc, 0, 0, 0, 0.35 * u, alpha(f.body, 0.22));
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

  // botão central, numa bacia rasa (sombra em cima, luz embaixo)
  const cr = 11 * u;
  const br = cr + 1.3 * u;
  const bowl = c.createLinearGradient(0, wcy - br, 0, wcy + br);
  bowl.addColorStop(0, alpha(f.keyLo, 0.7));
  bowl.addColorStop(0.85, alpha(f.keyHi, 0.9));
  c.beginPath();
  c.arc(wcx, wcy, br, 0, Math.PI * 2);
  c.fillStyle = bowl;
  c.fill();
  insetShadow(c, circleShape(c, wcx, wcy, br), 0, 0.35 * u, 0.7 * u, 0, alpha(f.keyLo, 0.6));
  c.beginPath();
  c.arc(wcx, wcy + 0.45 * u, cr, 0, Math.PI * 2);
  c.fillStyle = f.accentLo;
  c.fill();
  // bala de goma: mesmas camadas do .pp-center
  c.save();
  c.beginPath();
  c.arc(wcx, wcy, cr, 0, Math.PI * 2);
  c.clip();
  const gum = c.createRadialGradient(wcx, wcy - 0.16 * cr, 0, wcx, wcy - 0.16 * cr, 1.53 * cr);
  gum.addColorStop(0.5, f.accent);
  gum.addColorStop(1, f.accentLo);
  c.fillStyle = gum;
  c.fillRect(wcx - cr, wcy - cr, cr * 2, cr * 2);
  // luz atravessando por baixo
  c.save();
  c.translate(wcx, wcy + 0.84 * cr);
  c.scale(1.4 * cr, 0.9 * cr);
  const thru = c.createRadialGradient(0, 0, 0, 0, 0, 1);
  thru.addColorStop(0, blend(f.accent, '#ffffff', 0.75));
  thru.addColorStop(0.7, `rgba(${rgb(f.accent).join(',')},0)`);
  c.fillStyle = thru;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
  // sombra interna embaixo e luz interna em cima
  c.filter = `blur(${0.9 * u}px)`;
  c.beginPath();
  c.arc(wcx, wcy - 1.4 * u, cr + 3 * u, 0, Math.PI * 2);
  c.lineWidth = 6 * u;
  c.strokeStyle = `rgba(${rgb(f.accentLo).join(',')},0.75)`;
  c.stroke();
  c.filter = `blur(${0.4 * u}px)`;
  c.beginPath();
  c.arc(wcx, wcy + 0.5 * u, cr + 3 * u, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(255,255,255,0.2)';
  c.stroke();
  c.filter = 'none';
  // reflexo em meia-lua
  const hy = wcy - 0.58 * cr;
  const shine = c.createLinearGradient(0, hy - 0.28 * cr, 0, hy + 0.28 * cr);
  shine.addColorStop(0, 'rgba(255,255,255,0.42)');
  shine.addColorStop(0.9, 'rgba(255,255,255,0)');
  c.beginPath();
  c.ellipse(wcx, hy, 0.56 * cr, 0.28 * cr, 0, 0, Math.PI * 2);
  c.fillStyle = shine;
  c.fill();
  c.restore();
  rim(c, wcx - cr, wcy - cr, cr * 2, cr * 2, cr, 0.4 * u);
  // pausa (está tocando)
  c.fillStyle = f.accentInk;
  const ps = 6.4 * u;
  rr(c, wcx - ps * 0.25 - ps * 0.0875, wcy - ps * 0.29, ps * 0.175, ps * 0.58, ps * 0.03);
  c.fill();
  rr(c, wcx + ps * 0.25 - ps * 0.0875, wcy - ps * 0.29, ps * 0.175, ps * 0.58, ps * 0.03);
  c.fill();

  // rodapé: o logo, centrado onde antes ficava o nome escrito (só na versão com fundo)
  if (transparent) return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
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
