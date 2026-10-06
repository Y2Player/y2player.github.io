import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allow?: boolean): void;
  cueVideoById(id: string): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(v: number): void;
  destroy(): void;
}

// cast local (o player legado também declara window.YT com outro formato)
const w = window as unknown as {
  YT?: { Player: new (el: HTMLElement, cfg: unknown) => YTPlayer };
  onYouTubeIframeAPIReady?: () => void;
};

let apiPromise: Promise<void> | null = null;
function loadApi() {
  if (w.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export type YTStatus = 'loading' | 'idle' | 'buffering' | 'playing' | 'paused' | 'ended' | 'error';

interface Opts {
  // primeira faixa: o player já nasce com ela (como na referência), em vez de vazio
  initialId?: string;
  onEnded?: () => void;
  onError?: (code: number) => void;
}

// Player do YouTube escondido: o som sai do embed, a interface é o gadget.
export function useYouTube(host: RefObject<HTMLDivElement>, opts: Opts) {
  const player = useRef<YTPlayer | null>(null);
  const isReady = useRef(false);
  // os métodos do YT.Player só existem depois do onReady
  const api = () => (isReady.current ? player.current : null);
  const cbs = useRef(opts);
  cbs.current = opts;
  // Tocar = preparar (cue) e dar play quando o vídeo estiver pronto.
  // loadVideoById faz o YouTube pedir anúncio de novo (medido: 3 de 4 com anúncio;
  // cue + play: 0 de 6), por isso ele não é usado.
  const cued = useRef<string | undefined>(opts.initialId);
  const playWhenCued = useRef(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<YTStatus>('loading');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let dead = false;
    loadApi().then(() => {
      if (dead || !host.current || !w.YT) return;
      const el = document.createElement('div');
      host.current.appendChild(el);
      player.current = new w.YT.Player(el, {
        width: 320,
        height: 180,
        // sem faixa ainda (montagem): o player nasce vazio. videoId undefined faz o YouTube recusar o player
        ...(cbs.current.initialId ? { videoId: cbs.current.initialId } : {}),
        // mesmos parâmetros da referência (mixtape-for-you) + playsinline para o iPhone
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            isReady.current = true;
            setReady(true);
            setStatus('idle');
          },
          onStateChange: (e: { data: number }) => {
            const map: Record<number, YTStatus> = { [-1]: 'idle', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'idle' };
            if (e.data === 5 && playWhenCued.current) {
              playWhenCued.current = false;
              api()?.playVideo();
            }
            const st = map[e.data] ?? 'idle';
            setStatus(st);
            if (st === 'playing') setDuration(api()?.getDuration() ?? 0);
            if (st === 'ended') cbs.current.onEnded?.();
          },
          onError: (e: { data: number }) => {
            setStatus('error');
            cbs.current.onError?.(e.data);
          },
        },
      });
    });
    return () => {
      dead = true;
      isReady.current = false;
      player.current?.destroy();
      player.current = null;
      setReady(false);
      setStatus('loading');
    };
  }, [host]);

  useEffect(() => {
    if (status !== 'playing' && status !== 'buffering') return;
    const id = window.setInterval(() => {
      const p = api();
      if (!p) return;
      setTime(p.getCurrentTime());
      const d = p.getDuration();
      if (d) setDuration(d);
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  const load = useCallback((id: string, autoplay: boolean) => {
    const p = api();
    if (!p) return;
    setTime(0);
    setDuration(0);
    // já preparado (a primeira faixa nasce assim): só dá play
    if (autoplay && cued.current === id) {
      cued.current = undefined;
      p.playVideo();
      return;
    }
    playWhenCued.current = autoplay;
    cued.current = autoplay ? undefined : id;
    p.cueVideoById(id);
  }, []);

  const play = useCallback(() => api()?.playVideo(), []);
  const pause = useCallback(() => api()?.pauseVideo(), []);
  const seek = useCallback((s: number) => {
    api()?.seekTo(Math.max(0, s), true);
    setTime(Math.max(0, s));
  }, []);
  const setVolume = useCallback((v: number) => api()?.setVolume(Math.round(v)), []);
  const getTime = useCallback(() => api()?.getCurrentTime() ?? 0, []);

  return { ready, status, time, duration, load, play, pause, seek, setVolume, getTime };
}
