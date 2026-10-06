// Motor de pixel do visor LCD.
// Sprites são mapas de texto empilhados em camadas:
//   '#' tinta cheia · '+' meio-tom · 'x' apaga (oclui camadas de trás)
//   ':' pontilhado (dither) · '.' transparente
import type { MoodId } from '../tokens';

export interface Grid {
  w: number;
  h: number;
  px: Uint8Array; // 0 apagado · 1 cheio · 2 meio-tom
}

export function makeGrid(w: number, h: number): Grid {
  return { w, h, px: new Uint8Array(w * h) };
}

export function stamp(g: Grid, map: string[], x0: number, y0: number, flipX = false) {
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let i = 0; i < row.length; i++) {
      const c = flipX ? row[row.length - 1 - i] : row[i];
      if (c === '.') continue;
      const x = x0 + i;
      const yy = y0 + y;
      if (x < 0 || yy < 0 || x >= g.w || yy >= g.h) continue;
      const idx = yy * g.w + x;
      if (c === '#') g.px[idx] = 1;
      else if (c === '+') g.px[idx] = 2;
      else if (c === 'x') g.px[idx] = 0;
      else if (c === ':') g.px[idx] = (x + yy) % 2 === 0 ? 1 : 0;
    }
  }
}

function dot(g: Grid, x: number, y: number, v = 1) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.px[y * g.w + x] = v;
}

// ─── Sprites ────────────────────────────────────────────────────────────────
// Caixa do personagem: 20×18. Corpo em (2,3).

const BODY = [
  '.....######.....',
  '...##xxxxxx##...',
  '..#xxxxxxxxxx#..',
  '.#xxxxxxxxxxxx#.',
  '.#xxxxxxxxxxxx#.',
  '#xxxxxxxxxxxxxx#',
  '#xxxxxxxxxxxxxx#',
  '#xxxxxxxxxxxxxx#',
  '#xxxxxxxxxxxxxx#',
  '#xxxxxxxxxxxxxx#',
  '.#xxxxxxxxxxxx#.',
  '.#xxxxxxxxxxxx#.',
  '..##xxxxxxxx##..',
  '....########....',
];

const PHONES = [
  '......########......',
  '....##xxxxxxxx##....',
  '...#xxx......xxx#...',
  '..#xx..........xx#..',
  '..#x............x#..',
  '..#..............#..',
  '.##..............##.',
  '###..............###',
  '###..............###',
  '###..............###',
  '.##..............##.',
];

// concha grande (lo-fi): 4×6, desenhada por cima do fone padrão
const CUP_BIG = ['.###', '####', '####', '####', '####', '.###'];

const VIBE = ['.#', '#.', '#.', '.#'];

const EYE = {
  open: ['##', '##'],
  blink: ['xx', '##'],
  half: ['++', '##'],
  look: ['#x', '#x'],
};
const EYE4 = {
  happy: ['.##.', '#..#'],
  calm: ['#..#', '.##.'],
};

const MOUTH = {
  smile: ['#..#', '.##.'],
  sing: ['.##.', '#..#', '.##.'],
  flat: ['.##.'],
  small: ['.#.'],
  smirk: ['...#', '###.'],
  kiss: ['.#.', '..#', '.#.'],
  o: ['.#.', '#.#', '.#.'],
};

const GLASSES = [
  '####..####',
  '#xx####xx#',
  '#xx#..#xx#',
  '####..####',
];

// óculos escuros: lente cheia, ponte vazada
const SHADES = ['##########', '####..####', '.##....##.'];

const BROW = ['###'];

const BLANKET = [
  '..################..',
  '.#++++++++#+++++++#.',
  '#++++++++++#+++++++#',
  '#+++++++++++#++++++#',
  '#++++++++++++++++++#',
  '.##################.',
];

const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];
const HEART_S = ['#.#', '###', '.#.'];
const HEART_HUG = ['##.##', '#####', '.###.', '..#..'];
const NOTE = ['.#..', '.##.', '.#.#', '.#..', '##..', '##..'];
const NOTES = ['.#####', '.#...#', '.#...#', '.#...#', '##..##', '##..##'];
const SPARK = ['.#.', '###', '.#.'];
const SPARK_X = ['#.#', '.#.', '#.#'];
const STAR = ['..#..', '..#..', '##.##', '..#..', '..#..'];
const ZED = ['####', '..#.', '.#..', '####'];
const ZED_S = ['###', '.#.', '###'];

// ─── Composição ─────────────────────────────────────────────────────────────

export interface SceneOpts {
  mood: MoodId;
  tick: number;
  playing: boolean;
  w?: number;
  h?: number;
  charX?: number;
  charY?: number;
  vu?: number[] | null;
  sleep?: boolean;
  celebrate?: boolean;
}

export function moodFrame(mood: MoodId, tick: number): number {
  switch (mood) {
    case 'groovy':
      return Math.floor(tick / 2) % 4;
    case 'romantic':
      return Math.floor(tick / 4) % 4;
    case 'melancholy':
      return Math.floor(tick / 6) % 2;
    case 'focus':
      return Math.floor(tick / 4) % 4;
    case 'flirty':
      return Math.floor(tick / 3) % 4;
    case 'swagger':
      return Math.floor(tick / 3) % 4;
  }
}

export function composeScene(o: SceneOpts): Grid {
  const W = o.w ?? 44;
  const H = o.h ?? 22;
  const g = makeGrid(W, H);
  const baseX = o.charX ?? 6;
  const baseY = o.charY ?? H - 19;
  const t = o.tick;
  const f = moodFrame(o.mood, t);
  const idle = !o.playing;
  // no modo pausado o bichinho respira devagar e pisca de vez em quando
  const idleBreath = Math.floor(t / 10) % 2;
  const idleBlink = t % 32 === 0 || t % 32 === 1;

  let dx = 0;
  let dy = 0;
  let feet: 'stand' | 'L' | 'R' = 'stand';
  let eyes: keyof typeof EYE | keyof typeof EYE4 | 'glasses' | 'shades' | 'wink' = 'open';
  let mouth: keyof typeof MOUTH | null = 'smile';
  let phones: 'std' | 'big' = 'std';
  let blush = false;

  // ── camada de fundo (FX atrás do personagem)
  if (o.mood === 'melancholy' && !idle) {
    for (let i = 0; i < 14; i++) {
      const x = o.vu ? 7 + ((i * 7 + 3 + Math.floor(i / 3)) % (W - 14)) : (i * 7 + 3 + Math.floor(i / 3)) % W;
      const y = (((i * 5 + t) % (H + 2)) + H + 2) % (H + 2) - 2;
      stamp(g, ['+', '+'], x, y);
    }
  }

  if (o.mood === 'swagger' && !o.sleep) {
    // holofote: cone pontilhado descendo do alto, só pra ele
    const c = baseX + 10;
    for (let y = 0; y < H; y++) {
      const r = Math.floor(4 + y * 0.55);
      if (y % 2 === 0) {
        dot(g, c - r, y, 2);
        dot(g, c + r, y, 2);
      }
      for (let x = c - r + 1; x < c + r; x++) if ((x * 3 + y * 5) % 11 === 0) dot(g, x, y, 2);
    }
  }

  if (o.sleep) {
    eyes = 'blink';
    mouth = 'small';
    dy = idleBreath;
    const zt = Math.floor(t / 4) % 3;
    stamp(g, ZED_S, baseX + 21, baseY + 4 - zt);
    if (zt > 0) stamp(g, ZED, baseX + 25, baseY - zt);
  } else if (o.celebrate) {
    dy = t % 4 < 2 ? -2 : 0;
    eyes = 'happy';
    mouth = 'sing';
    feet = t % 4 < 2 ? 'L' : 'R';
    stamp(g, (t >> 1) % 2 ? STAR : SPARK_X, baseX - 3, baseY + 2 + ((t >> 1) % 2));
    stamp(g, (t >> 1) % 2 ? SPARK_X : STAR, baseX + 20, baseY + 4 - ((t >> 1) % 2));
    stamp(g, NOTES, baseX + 22, baseY - 1 - ((t >> 2) % 3));
  } else if (idle) {
    dy = idleBreath;
    eyes = idleBlink ? 'blink' : 'open';
    mouth = 'flat';
  } else {
    switch (o.mood) {
      case 'groovy': {
        dy = f % 2 === 1 ? -1 : 0;
        dx = f < 2 ? -1 : 1;
        feet = f === 1 ? 'L' : f === 3 ? 'R' : 'stand';
        eyes = f % 2 === 1 ? 'happy' : 'open';
        mouth = f % 2 === 1 ? 'sing' : 'smile';
        break;
      }
      case 'romantic': {
        dx = f === 1 || f === 2 ? 1 : 0;
        eyes = 'calm';
        mouth = 'smile';
        blush = true;
        break;
      }
      case 'melancholy': {
        dy = -f;
        eyes = 'half';
        mouth = 'flat';
        phones = 'big';
        break;
      }
      case 'focus': {
        eyes = 'glasses';
        mouth = 'flat';
        break;
      }
      case 'swagger': {
        // a cabeça desce no 2 e no 4, junto com o estalo
        dy = f % 2;
        mouth = 'smirk';
        break;
      }
      case 'flirty': {
        dx = f % 2;
        eyes = f === 1 || f === 2 ? 'wink' : 'open';
        mouth = f === 2 ? 'kiss' : 'smirk';
        blush = true;
        break;
      }
    }
  }

  // acessórios fixos do mood (mesmo pausado)
  if (o.mood === 'melancholy') phones = 'big';
  if (o.mood === 'focus' && !o.sleep) eyes = 'glasses';
  if (o.mood === 'swagger' && !o.sleep) eyes = 'shades';
  if (o.mood === 'romantic' || o.mood === 'flirty') blush = true;

  const cx = baseX + dx;
  const cy = baseY + dy;

  // ── personagem
  stamp(g, BODY, cx + 2, cy + 3);
  stamp(g, PHONES, cx, cy + 1);
  if (phones === 'big') {
    stamp(g, CUP_BIG, cx - 1, cy + 7);
    stamp(g, CUP_BIG, cx + 17, cy + 7, true);
  }

  // pés
  if (o.mood !== 'melancholy') {
    if (feet === 'stand') stamp(g, ['....##....##....'], cx + 2, cy + 17);
    if (feet === 'L') {
      stamp(g, ['..........##....'], cx + 2, cy + 17);
      stamp(g, ['##'], cx + 4, cy + 16);
    }
    if (feet === 'R') {
      stamp(g, ['....##..........'], cx + 2, cy + 17);
      stamp(g, ['##'], cx + 14, cy + 16);
    }
  }

  // olhos
  const eyeY = cy + 9;
  if (eyes === 'glasses') {
    stamp(g, GLASSES, cx + 5, eyeY - 1);
    // pupilas: olham pro osciloscópio e voltam; piscam às vezes
    const look = idle ? 0 : [0, 0, 1, 1][f];
    const blink = idle ? idleBlink : t % 40 < 2;
    if (!blink) {
      dot(g, cx + 6 + look, eyeY);
      dot(g, cx + 6 + look, eyeY + 1);
      dot(g, cx + 12 + look, eyeY);
      dot(g, cx + 12 + look, eyeY + 1);
    } else {
      stamp(g, ['##'], cx + 6, eyeY + 1);
      stamp(g, ['##'], cx + 12, eyeY + 1);
    }
  } else if (eyes === 'shades') {
    stamp(g, SHADES, cx + 5, eyeY - 1);
    // brilho atravessando a lente de vez em quando
    const k = t % 22;
    if (!idle && k < 10 && k !== 4 && k !== 5) dot(g, cx + 5 + k, eyeY, 0);
  } else if (eyes === 'happy' || eyes === 'calm') {
    stamp(g, EYE4[eyes], cx + 5, eyeY);
    stamp(g, EYE4[eyes], cx + 11, eyeY);
  } else if (eyes === 'wink') {
    stamp(g, EYE.open, cx + 6, eyeY);
    stamp(g, BROW, cx + 5, eyeY - 2 - (f === 1 ? 1 : 0));
    stamp(g, EYE4.happy, cx + 11, eyeY);
  } else {
    stamp(g, EYE[eyes], cx + 6, eyeY);
    stamp(g, EYE[eyes], cx + 12, eyeY);
    if (o.mood === 'flirty' && !o.sleep) stamp(g, BROW, cx + 5, eyeY - 2);
  }

  if (blush) {
    stamp(g, ['++'], cx + 4, eyeY + 2);
    stamp(g, ['++'], cx + 14, eyeY + 2);
  }

  // boca
  if (mouth) {
    const m = MOUTH[mouth];
    const mw = m[0].length;
    const my = cy + 12;
    stamp(g, m, cx + 10 - Math.ceil(mw / 2), my);
  }

  // ── acessórios / FX por mood
  if (o.mood === 'melancholy') {
    stamp(g, BLANKET, cx, cy + 13);
    if (!idle && t % 24 < 12) {
      // lágrima escorrendo
      dot(g, cx + 6, eyeY + 2 + Math.floor((t % 12) / 6), 2);
    }
  }

  if (o.mood === 'romantic' && !o.sleep) {
    // abraçando um coração
    stamp(g, HEART_HUG, cx + 8, cy + 13);
    dot(g, cx + 6, cy + 14);
    dot(g, cx + 14, cy + 14);
    if (!idle) {
      // três corações sobem por fora da silhueta, defasados
      const lanes = [
        { x: -4, y0: 10, big: false },
        { x: 21, y0: 8, big: true },
        { x: 9, y0: -1, big: false },
      ];
      lanes.forEach((l, i) => {
        const period = 16;
        const p = (t + i * 5) % period;
        const rise = Math.floor(p / 2);
        const sway = Math.floor(p / 4) % 2;
        if (l.y0 - rise < -4) return;
        stamp(g, l.big ? HEART : HEART_S, baseX + l.x + sway, baseY + l.y0 - rise);
      });
    }
  }

  if (o.mood === 'groovy' && !idle && !o.sleep) {
    // fones vibrando
    if (f % 2 === 1) {
      stamp(g, VIBE, cx - 2, cy + 7);
      stamp(g, VIBE, cx + 20, cy + 7, true);
    }
    const n1 = Math.floor(t / 2) % 6;
    stamp(g, NOTE, baseX - 6, baseY + 8 - n1);
    stamp(g, NOTES, baseX + 21, baseY + 5 - ((n1 + 3) % 6));
  }

  if (o.mood === 'focus' && !o.sleep) {
    // osciloscópio zen dos dois lados, espelhado; se não couber à esquerda, fica só à direita
    const right = baseX + 22;
    const wr = o.vu ? 0 : Math.min(14, W - right - 1);
    const wl = Math.min(wr, baseX - 3);
    const both = wl > 4;
    const ow = both ? wl : wr;
    const scope = (ox: number, mirror: boolean) => {
      stamp(g, ['#' + '+'.repeat(ow - 2) + '#'], ox, baseY + 4);
      stamp(g, ['#' + '+'.repeat(ow - 2) + '#'], ox, baseY + 14);
      for (let x = 1; x < ow - 1; x++) {
        const ph = idle ? 0 : t * 0.7;
        const y = Math.round(Math.sin((x + ph) / 1.6) * 3);
        dot(g, mirror ? ox + ow - 1 - x : ox + x, baseY + 9 + y);
      }
    };
    if (ow > 4) {
      scope(right, false);
      if (both) scope(baseX - 2 - ow, true);
    }
    if (o.vu) {
      // onda embaixo quando o VU ocupa as laterais
      for (let x = 7; x < W - 7; x += 1) {
        const ph = idle ? 0 : t * 0.6;
        const y = Math.round(Math.sin((x + ph) / 2.2) * 1.2);
        dot(g, x, H - 2 + y, 2);
      }
    }
  }

  if (o.mood === 'swagger' && !idle && !o.sleep) {
    // estala os dedos no contratempo, alternando a mão
    if (f === 1) {
      stamp(g, ['##', '##'], cx + 19, cy + 13);
      stamp(g, SPARK_X, cx + 22, cy + 10);
    }
    if (f === 3) {
      stamp(g, ['##', '##'], cx - 1, cy + 13);
      stamp(g, SPARK_X, cx - 4, cy + 10);
    }
    stamp(g, NOTE, baseX + 23, baseY + 7 - Math.floor((t % 18) / 3));
  }

  if (o.mood === 'flirty' && !idle && !o.sleep) {
    const s = Math.floor(t / 3) % 2;
    stamp(g, s ? SPARK : SPARK_X, baseX - 2, baseY + 3);
    stamp(g, s ? SPARK_X : SPARK, baseX + 19, baseY + 1);
    stamp(g, s ? STAR : SPARK, baseX + 21, baseY + 9);
    if (f >= 2) {
      // beijinho voando
      const k = (t % 12) / 12;
      stamp(g, HEART_S, cx + 13 + Math.floor(k * 10), cy + 11 - Math.floor(k * 6));
    }
  }

  // ── VU meter: metade das barras de cada lado, espelhadas em volta do bichinho
  if (o.vu) {
    const bars = o.vu.length;
    const half = Math.ceil(bars / 2);
    for (let b = 0; b < bars; b++) {
      const x = b < half ? 1 + b * 3 : W - 3 - (bars - 1 - b) * 3;
      const lvl = Math.max(0, Math.min(1, o.vu[b]));
      const segs = 9;
      const on = Math.round(lvl * segs);
      for (let s = 0; s < segs; s++) {
        const y = H - 2 - s * 2;
        const v = s < on ? 1 : 2;
        if (s < on || s % 2 === 0) {
          dot(g, x, y, s < on ? v : 2);
          dot(g, x + 1, y, s < on ? v : 2);
        }
      }
    }
  }

  return g;
}

// Níveis simulados de VU (o embed do YouTube não expõe o áudio).
export function fakeVu(tick: number, playing: boolean, n = 4): number[] {
  return Array.from({ length: n }, (_, i) => {
    if (!playing) return 0;
    const a = Math.abs(Math.sin(tick * 0.83 + i * 1.9));
    const b = Math.abs(Math.sin(tick * 0.37 + i * 0.7));
    const kick = tick % 4 === 0 ? 0.25 : 0;
    return Math.min(1, 0.15 + a * 0.45 + b * 0.25 + kick - i * 0.04);
  });
}

// Texto em pixel 3×5 para o logotipo do boot.
const FONT3: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  ' ': ['...', '...', '...', '...', '...'],
};

export function stampText(g: Grid, text: string, x: number, y: number) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const m = FONT3[ch] ?? FONT3[' '];
    stamp(g, m, cx, y);
    cx += 4;
  }
}
