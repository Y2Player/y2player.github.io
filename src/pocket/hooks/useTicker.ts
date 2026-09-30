import { useEffect, useState } from 'react';

// Relógio global do visor: 8 quadros/s. Todos os mascotes derivam o frame daqui
// (animação em degraus, como um LCD de verdade).
const listeners = new Set<(t: number) => void>();
let tick = 0;
let timer: number | null = null;

function start() {
  if (timer !== null) return;
  timer = window.setInterval(() => {
    tick++;
    listeners.forEach((l) => l(tick));
  }, 125);
}

export function useTicker(enabled = true) {
  const [t, setT] = useState(tick);
  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const l = reduce ? (n: number) => n % 8 === 0 && setT(n) : setT;
    listeners.add(l);
    start();
    return () => {
      listeners.delete(l);
      if (listeners.size === 0 && timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [enabled]);
  return t;
}
