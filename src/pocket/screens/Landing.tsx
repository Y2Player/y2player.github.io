import { useEffect, useRef, useState } from 'react';
import { Device } from '../components/Hardware';
import { LcdScreen, ScreenPet } from '../components/Lcd';
import { useTicker } from '../hooks/useTicker';
import { FINISHES, MOOD_LIST, finishVars } from '../tokens';

// o visor troca de bichinho (e o aparelho de cor) sozinho nesse ritmo
const CYCLE_MS = 500;
// depois de mexer na roda, a troca automática espera esse tempo para voltar
const HOLD_MS = 4000;

// Texto do botão sobre a cor do aparelho: escolhe entre tinta escura e branco
// pelo maior contraste (WCAG), para manter a leitura em qualquer acabamento.
const INK_DARK = '#1d1d1b';
const INK_LIGHT = '#ffffff';
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function readableInk(bg: string) {
  const l = luminance(bg);
  const vsDark = (l + 0.05) / (luminance(INK_DARK) + 0.05);
  const vsLight = (luminance(INK_LIGHT) + 0.05) / (l + 0.05);
  return vsDark >= vsLight ? INK_DARK : INK_LIGHT;
}

export function Landing() {
  const tick = useTicker();
  const [m, setM] = useState(0);
  const [lit, setLit] = useState(false);
  const [vol, setVol] = useState(0.7);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);
  const holdTimer = useRef<number>();
  const n = MOOD_LIST.length;
  const mood = MOOD_LIST[m % n];
  // a cor do aparelho vem do humor
  const finish = FINISHES[mood.finish];

  useEffect(() => {
    document.title = 'Y2Player';
  }, []);

  // troca automática; pausa enquanto a pessoa mexe na roda (senão o giro fica invisível)
  useEffect(() => {
    if (held) return;
    const id = window.setTimeout(() => setM((x) => (x + 1) % n), CYCLE_MS);
    return () => window.clearTimeout(id);
  }, [m, n, held]);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const hold = () => {
    setHeld(true);
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setHeld(false), HOLD_MS);
  };

  const step = (d: number) => {
    hold();
    setM((x) => (x + d + n) % n);
  };

  return (
    <div className="pp-root pp-stage" style={finishVars(finish)}>
      <div className="mx-auto grid min-h-[100dvh] max-w-[1080px] px-5">
        <main className="grid items-center gap-10 pt-10 pb-6 lg:grid-cols-[1fr_400px] lg:gap-20">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <h1 className="text-[34px] font-medium leading-[1.05] tracking-[-0.025em] sm:text-[48px]">Qual a vibe de hoje?</h1>
            <p className="mx-auto mt-5 max-w-[420px] text-[17px] leading-[1.5] lg:mx-0" style={{ color: 'var(--ink-2)' }}>
              Crie seu mix com até 5 músicas, escreva 1 bilhete levemente cafona e escolha 1 bichinho com mais
              sentimento que você. Depois é só mandar pra quem você quiser.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href="#/criar"
                className="pp-btn w-full sm:w-auto"
                style={{ background: finish.body, color: readableInk(finish.body) }}
              >
                Criar
              </a>
            </div>
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            <div className="pp-cq pp-arrive" style={{ width: 'min(calc(100vw - 56px), 380px)' }}>
              <Device
                finish={finish}
                lit={lit}
                playing={playing}
                volume={vol}
                onVolume={setVol}
                onLight={setLit}
                onCenter={() => {
                  hold();
                  setPlaying((p) => !p);
                }}
                onWheel={(z) => {
                  if (z === 'next') step(1);
                  if (z === 'prev') step(-1);
                }}
                onJog={step}
                screen={
                  <LcdScreen lit={lit} oled={finish.oled}>
                    <ScreenPet mood={mood.id} tick={tick} playing={playing} />
                  </LcdScreen>
                }
              />
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
