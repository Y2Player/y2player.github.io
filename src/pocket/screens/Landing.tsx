import { useEffect, useRef, useState } from 'react';
import { Device } from '../components/Hardware';
import { LcdScreen, ScreenPet } from '../components/Lcd';
import { useTicker } from '../hooks/useTicker';
import { FINISHES, MOOD_LIST, finishVars } from '../tokens';

// o visor troca de bichinho (e o aparelho de cor) sozinho nesse ritmo
const CYCLE_MS = 500;
// depois de mexer na roda, a troca automática espera esse tempo para voltar
const HOLD_MS = 4000;

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
      {/* tela de app: cabe na altura da janela; no celular o aparelho encolhe pra caber o texto */}
      <div className="mx-auto h-[100dvh] max-w-[1080px] overflow-hidden px-5">
        <main className="flex h-full flex-col gap-6 pt-6 pb-[calc(20px+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-20 lg:py-10">
          <div className="order-2 flex-none text-center lg:order-1 lg:text-left">
            <h1 className="text-[30px] font-medium leading-[1.05] tracking-[-0.025em] sm:text-[48px]">Qual a vibe de hoje?</h1>
            <p className="mx-auto mt-3 max-w-[420px] sm:mt-5 text-[17px] leading-[1.5] lg:mx-0" style={{ color: 'var(--ink-2)', textWrap: 'balance' }}>
              Crie seu mix e compartilhe com quem você quiser.
            </p>
            <div className="mt-5 flex flex-col items-center gap-3 sm:mt-8 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href="#/criar"
                className="pp-btn is-gel w-full sm:w-auto"
              >
                Criar
              </a>
            </div>
          </div>

          <div className="pp-fit order-1 flex-1 lg:order-2 lg:h-full">
            <div className="pp-cq pp-arrive">
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
