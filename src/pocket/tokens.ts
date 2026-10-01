import type { CSSProperties } from 'react';
// Mixtape Pocket Player — design tokens
// Materiais (acabamentos do chassi) + moods (bichinhos) + tipografia.

export type FinishId = 'tangerina' | 'chiclete' | 'bondi' | 'cristal' | 'uva' | 'fume';
export type MoodId = 'groovy' | 'romantic' | 'melancholy' | 'focus' | 'flirty' | 'swagger';

export interface Finish {
  id: FinishId;
  name: string;
  material: string;
  // plástico / metal (a tela inteira é o aparelho)
  body: string;
  bodyHi: string;
  bodyLo: string;
  edge: string;
  internals: number; // quanto do miolo (placa, bateria, cabos) aparece através da carcaça transparente
  brush: number; // escovado do metal
  // como o miolo atravessa o plástico: filtro de cor (multiply) ou brilho no escuro (screen)
  see: 'multiply' | 'screen';
  pcb: string;
  // teclas / roda
  key: string;
  keyHi: string;
  keyLo: string;
  wheel: string;
  keyInk: string;
  led: string;
  // gravações e acentos
  engrave: string;
  engraveShadow: string;
  accent: string;
  accentLo: string;
  accentInk: string;
  // visor
  bezel: string;
  lcdBg: string;
  lcdBgLit: string;
  lcdInk: string;
  oled: boolean;
}

export const FINISHES: Record<FinishId, Finish> = {
  tangerina: {
    id: 'tangerina',
    name: 'Tangerina',
    material: 'Policarbonato translúcido',
    body: '#FF8A24',
    bodyHi: '#FFBD6E',
    bodyLo: '#DD5F0B',
    edge: '#B54A05',
    internals: 0.8,
    brush: 0,
    see: 'multiply',
    pcb: '#D9D5CC',
    key: '#FFF6EC',
    keyHi: '#FFFFFF',
    keyLo: '#EFCFAF',
    wheel: '#FFF2E3',
    keyInk: '#D2650F',
    led: '#FFF6C4',
    engrave: '#FFF4E8',
    engraveShadow: 'rgba(120,40,0,.3)',
    accent: '#FF6A0D',
    accentLo: '#C94F00',
    accentInk: '#FFFFFF',
    bezel: '#4A2106',
    lcdBg: '#D4E4BD',
    lcdBgLit: '#E8FACB',
    lcdInk: '#1E2A10',
    oled: false,
  },
  chiclete: {
    id: 'chiclete',
    name: 'Chiclete',
    material: 'Policarbonato translúcido',
    body: '#FF5CC6',
    bodyHi: '#FFA3E3',
    bodyLo: '#DE24A6',
    edge: '#B8168A',
    internals: 0.7,
    brush: 0,
    see: 'multiply',
    pcb: '#D9D5CC',
    key: '#FFF1F7',
    keyHi: '#FFFFFF',
    keyLo: '#F0C2D7',
    wheel: '#FFEFF6',
    keyInk: '#D0309F',
    led: '#FF381E',
    engrave: '#FFF0F7',
    engraveShadow: 'rgba(140,10,90,.3)',
    accent: '#FF381E',
    accentLo: '#C11F0B',
    accentInk: '#FFFFFF',
    bezel: '#4A0B38',
    lcdBg: '#F5D4EC',
    lcdBgLit: '#FFE8F7',
    lcdInk: '#3A0A2C',
    oled: false,
  },
  bondi: {
    id: 'bondi',
    name: 'Bondi',
    material: 'Policarbonato translúcido',
    body: '#1B99B3',
    bodyHi: '#5CCFE3',
    bodyLo: '#0A6680',
    edge: '#085266',
    internals: 0.8,
    brush: 0,
    see: 'multiply',
    pcb: '#D9D5CC',
    key: '#EAF7FA',
    keyHi: '#FFFFFF',
    keyLo: '#B2D3DB',
    wheel: '#E4F4F7',
    keyInk: '#1A7C92',
    led: '#A6F5FF',
    engrave: '#E6FAFF',
    engraveShadow: 'rgba(0,50,65,.35)',
    accent: '#1592AE',
    accentLo: '#0A6178',
    accentInk: '#FFFFFF',
    bezel: '#0A3542',
    lcdBg: '#BFE2EA',
    lcdBgLit: '#D8F7FF',
    lcdInk: '#062C38',
    oled: false,
  },
  cristal: {
    id: 'cristal',
    name: 'Cristal',
    material: 'Policarbonato cristal',
    body: '#C3C9D0',
    bodyHi: '#F1F4F7',
    bodyLo: '#8A929C',
    edge: '#717983',
    internals: 0.85,
    brush: 0,
    see: 'multiply',
    pcb: '#D9D5CC',
    key: '#DDE2E7',
    keyHi: '#FAFBFC',
    keyLo: '#9CA4AD',
    wheel: '#D9DEE3',
    keyInk: '#4B535C',
    led: '#39C6FF',
    engrave: '#434B54',
    engraveShadow: 'rgba(255,255,255,.7)',
    accent: '#1F6BFF',
    accentLo: '#0E45B5',
    accentInk: '#FFFFFF',
    bezel: '#15191E',
    lcdBg: '#0A131B',
    lcdBgLit: '#0F1C27',
    lcdInk: '#7FE6FF',
    oled: true,
  },
  uva: {
    id: 'uva',
    name: 'Uva',
    material: 'Policarbonato translúcido',
    body: '#B97CF9',
    bodyHi: '#DDBDFF',
    bodyLo: '#8B4FE0',
    edge: '#6E36BE',
    internals: 0.85,
    brush: 0,
    see: 'multiply',
    pcb: '#D9D5CC',
    key: '#F1ECFA',
    keyHi: '#FFFFFF',
    keyLo: '#C6BAE2',
    wheel: '#EEE8F9',
    keyInk: '#7B45C9',
    led: '#C3FF35',
    engrave: '#F3EDFF',
    engraveShadow: 'rgba(40,10,80,.4)',
    accent: '#C3FF35',
    accentLo: '#86B812',
    accentInk: '#3A1C6A',
    bezel: '#2B1452',
    lcdBg: '#E7CDFF',
    lcdBgLit: '#F3E6FF',
    lcdInk: '#240F45',
    oled: false,
  },
  fume: {
    id: 'fume',
    name: 'Fumê',
    material: 'Policarbonato translúcido',
    body: '#3A302A',
    bodyHi: '#6B5D52',
    bodyLo: '#1E1915',
    edge: '#120E0B',
    internals: 0.55,
    brush: 0,
    see: 'screen',
    pcb: '#1A1A18',
    key: '#EDE6DC',
    keyHi: '#FFFFFF',
    keyLo: '#C9BFB2',
    wheel: '#EDE6DC',
    keyInk: '#5A4A3C',
    led: '#FFB547',
    engrave: '#EDE2D3',
    engraveShadow: 'rgba(0,0,0,.45)',
    accent: '#FFB547',
    accentLo: '#C7841C',
    accentInk: '#2A1A08',
    bezel: '#0E0B09',
    lcdBg: '#1B1612',
    lcdBgLit: '#241C15',
    lcdInk: '#FFB547',
    oled: true,
  },
};

export const FINISH_LIST = Object.values(FINISHES);

export interface Mood {
  id: MoodId;
  name: string;
  en: string;
  line: string;
  fx: string;
  accessory: string;
  fps: number;
  // o plástico do aparelho vem do humor
  finish: FinishId;
  // ticks (125ms) por quadro
  step: number;
  frames: number;
}

export const MOODS: Record<MoodId, Mood> = {
  groovy: {
    id: 'groovy',
    name: 'Dançante',
    en: 'Groovy',
    line: 'Dança até quando não deveria. Principalmente quando não deveria.',
    fx: 'Notas ♫ saltando',
    accessory: 'Fones de ouvido',
    finish: 'tangerina',
    fps: 4,
    step: 2,
    frames: 4,
  },
  romantic: {
    id: 'romantic',
    name: 'Apaixonado',
    en: 'Romantic',
    line: 'Olha pra você do jeito que ninguém olha. Abraça um coração e tudo.',
    fx: 'Corações subindo',
    accessory: 'Bochecha corada',
    finish: 'chiclete',
    fps: 2,
    step: 4,
    frames: 4,
  },
  melancholy: {
    id: 'melancholy',
    name: 'Triste',
    en: 'Melancholy · Lo-fi',
    line: 'Enrolado no cobertor ouvindo a chuva. Respeita o momento.',
    fx: 'Chuva digital',
    accessory: 'Cobertor + fones grandes',
    finish: 'bondi',
    fps: 1.3,
    step: 6,
    frames: 2,
  },
  focus: {
    id: 'focus',
    name: 'Focado',
    en: 'Deep Focus',
    line: 'Óculos no rosto, zero notificação. Só levanta quando a música acabar.',
    fx: 'Onda senoidal zen',
    accessory: 'Óculos de visor',
    finish: 'cristal',
    fps: 2,
    step: 4,
    frames: 4,
  },
  flirty: {
    id: 'flirty',
    name: 'Paquera',
    en: 'Flirty',
    line: 'Pisca, levanta a sobrancelha e manda beijo. Sem vergonha nenhuma.',
    fx: 'Brilhos ✦ e beijo',
    accessory: 'Sobrancelha + blush',
    finish: 'uva',
    fps: 2.7,
    step: 3,
    frames: 4,
  },
  swagger: {
    id: 'swagger',
    name: 'Se Gostando',
    en: 'Feeling Myself',
    line: 'Todo todo desde a primeira nota. Não precisa de plateia.',
    fx: 'Holofote + estalo de dedo',
    accessory: 'Óculos escuros com brilho',
    finish: 'fume',
    fps: 2.7,
    step: 3,
    frames: 4,
  },
};

export const MOOD_LIST = Object.values(MOODS);

export const finishForMood = (m: MoodId) => FINISHES[MOODS[m].finish];

export const TYPE = {
  hardware: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  spec: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  lcd: "'Press Start 2P', monospace",
  lcdBody: "'VT323', monospace",
};

// Variáveis de material (aparelho e componentes isolados).
export function materialVars(f: Finish): CSSProperties {
  return {
    '--body': f.body,
    '--body-hi': f.bodyHi,
    '--body-lo': f.bodyLo,
    '--edge': f.edge,
    '--internals': f.internals,
    '--brush': f.brush,
    '--see': f.see,
    '--pcb': f.pcb,
    '--key': f.key,
    '--key-hi': f.keyHi,
    '--key-lo': f.keyLo,
    '--wheel': f.wheel,
    '--key-ink': f.keyInk,
    '--led': f.led,
    '--engrave': f.engrave,
    '--engrave-shadow': f.engraveShadow,
    '--accent': f.accent,
    '--accent-lo': f.accentLo,
    '--accent-ink': f.accentInk,
    '--bezel': f.bezel,
    '--lcd-bg': f.lcdBg,
    '--lcd-bg-lit': f.lcdBgLit,
    '--lcd-ink': f.lcdInk,
  } as CSSProperties;
}

// Páginas: só o material do aparelho; a tinta da página é neutra (.pp-root).
export const finishVars = materialVars;
