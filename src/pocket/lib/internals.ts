// Miolo do aparelho: placa, bateria, cabo do visor, chips e parafusos,
// visto através da carcaça transparente. Medidas em "u" (1u = 1% da largura
// do corpo, como o cqw), na mesma grade do aparelho: visor em (5.5, 5.5) com
// 89×73, roda centrada em (50, 116.5) com raio 31. Só as bordas, a faixa entre
// visor e roda e as laterais da roda ficam à mostra.
// Plástico colorido funciona como filtro (multiply sobre placa clara);
// plástico escuro deixa passar só o que brilha (screen sobre placa escura).
// Cada peça é um path SVG, então o mesmo desenho serve pro DOM e pro canvas (Path2D).

export const INTERNALS_W = 100;
export const INTERNALS_H = 154.5;

export interface Part {
  d: string;
  board?: boolean; // pinta com a cor da placa do acabamento
  fill?: string;
  stroke?: string;
  sw?: number;
}

const rect = (x: number, y: number, w: number, h: number, r = 0) =>
  r
    ? `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`
    : `M${x} ${y}h${w}v${h}h-${w}z`;
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 -${r * 2} 0z`;

const CU = '#D4AA5C';
const SILK = 'rgba(235,242,236,.55)';
const CHIP = '#141619';
const STEEL = '#C4C8CC';

function screw(x: number, y: number): Part[] {
  return [
    { d: circle(x, y, 2.1), fill: STEEL },
    { d: circle(x, y, 2.1), stroke: 'rgba(0,0,0,.35)', sw: 0.3 },
    { d: `M${x - 1.2} ${y}h2.4M${x} ${y - 1.2}v2.4`, stroke: '#6E747A', sw: 0.5 },
  ];
}

function qfp(x: number, y: number, s: number): Part[] {
  // chip quadrado com perninhas nos quatro lados
  let pins = '';
  for (let i = 1; i < 5; i++) {
    const p = (s / 5) * i;
    pins += `M${x + p} ${y - 0.8}v0.8M${x + p} ${y + s}v0.8M${x - 0.8} ${y + p}h0.8M${x + s} ${y + p}h0.8`;
  }
  return [
    { d: pins, stroke: STEEL, sw: 0.35 },
    { d: rect(x, y, s, s, 0.4), fill: CHIP },
    { d: circle(x + 1.2, y + 1.2, 0.4), fill: '#3A3D42' },
  ];
}

export const INTERNALS: Part[] = [
  // placa
  { d: rect(1.6, 1.6, 96.8, 151.3, 5.6), board: true },

  // trilhas: pelas bordas do visor e contornando a roda
  { d: 'M3.4 8V76M3.4 30h1.6M3.4 56h1.6M96.6 8V76M96.6 40h-1.6M96.6 64h-1.6', stroke: CU, sw: 0.45 },
  {
    d: 'M8 88V136q0 6 6 6H30M10.2 88V134q0 6 6 6H30M12.4 92V132q0 6 6 6H22M92 88V136q0 6 -6 6H70M89.8 88V134q0 6 -6 6H70',
    stroke: CU,
    sw: 0.45,
  },
  { d: 'M30 150.6H70M34 152H66', stroke: CU, sw: 0.4 },
  { d: circle(30, 142, 0.7) + circle(30, 140, 0.7) + circle(70, 142, 0.7) + circle(70, 140, 0.7) + circle(22, 138, 0.7), fill: CU },

  // contatos atrás das teclas laterais
  { d: rect(0.9, 20.5, 1.6, 11, 0.6) + rect(0.9, 35, 1.6, 11, 0.6) + rect(97.5, 19.5, 1.6, 14, 0.6), fill: CU },

  // bateria atrás da roda (só os cantos escapam)
  { d: rect(21, 87, 58, 60, 2.2), fill: '#8C96A0' },
  { d: rect(24, 90, 52, 54, 1.4), fill: '#A9B3BC' },
  { d: rect(21, 87, 58, 60, 2.2), stroke: SILK, sw: 0.3 },

  // cabo flat saindo do visor
  { d: rect(42, 76, 16, 14), fill: '#E08A2E' },
  { d: 'M44.5 76v14M47.5 76v14M50.5 76v14M53.5 76v14M56 76v14', stroke: '#A85E16', sw: 0.3 },
  { d: rect(41, 88.5, 18, 2.6, 0.5), fill: '#E9E4D6' },

  // chips, cristal e capacitores
  ...qfp(84.5, 85.5, 8),
  { d: rect(84.5, 85.5, 8, 8, 0.4), stroke: SILK, sw: 0.25 },
  { d: rect(2.6, 95, 4.6, 9), fill: CHIP },
  { d: 'M2 96.5h0.6M2 98.5h0.6M2 100.5h0.6M2 102.5h0.6M7.2 96.5h0.6M7.2 98.5h0.6M7.2 100.5h0.6M7.2 102.5h0.6', stroke: STEEL, sw: 0.4 },
  { d: rect(86, 131, 8.4, 3.6, 1.8), fill: STEEL },
  { d: circle(15.5, 92.5, 2.4), fill: '#2F5FA8' },
  { d: circle(15.5, 92.5, 0.9), fill: '#CFD8E3' },
  { d: circle(89.5, 104, 2.4), fill: '#2F5FA8' },
  { d: circle(89.5, 104, 0.9), fill: '#CFD8E3' },
  { d: rect(36, 81, 1.8, 1) + rect(62, 81, 1.8, 1) + rect(64.6, 81, 1.8, 1) + rect(34, 148.5, 1.8, 1) + rect(64, 148.5, 1.8, 1), fill: '#C9A27A' },

  // parafusos
  ...screw(6.2, 82),
  ...screw(93.8, 82),
  ...screw(7.5, 147.5),
  ...screw(92.5, 147.5),
];
