import { useCallback, useEffect, useRef, useState } from 'react';
import { Device, type WheelZone } from '../components/Hardware';
import { HomeLink } from '../components/HomeLink';
import { ShareSheet } from '../components/ShareSheet';
import {
  LcdScreen,
  MENU_ITEMS,
  OverlayMessage,
  OverlayVolume,
  ScreenBoot,
  ScreenList,
  ScreenMenu,
  ScreenNote,
  ScreenNow,
} from '../components/Lcd';
import { useTicker } from '../hooks/useTicker';
import { useYouTube } from '../hooks/useYouTube';
import { fetchTrackInfo, fmtTime, type Mixtape, type Track } from '../lib/mixtape';
import { FINISHES, finishVars } from '../tokens';

type Mode = 'boot' | 'menu' | 'now' | 'list' | 'note';
type Overlay = { kind: 'vol' } | { kind: 'msg'; text: string; sub?: string; icon?: string } | null;

// Largura do aparelho: vem de .pp-player-device (cabe na largura E na altura, sem rolagem)

export function PlayerScreen({ mix, demo }: { mix: Mixtape; demo?: boolean }) {
  const finish = FINISHES[mix.finish];
  // links curtos chegam sem título/canal: busca no YouTube e troca o nome provisório
  const [tracks, setTracks] = useState<Track[]>(mix.tracks);
  useEffect(() => {
    let alive = true;
    mix.tracks.forEach((t, i) => {
      if (t.author !== 'YouTube' || !/^Faixa \d\d$/.test(t.title)) return;
      fetchTrackInfo(t.id)
        .then((info) => alive && setTracks((all) => all.map((x, j) => (j === i ? info : x))))
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, [mix]);
  const total = tracks.length;
  const host = useRef<HTMLDivElement>(null);
  const tick = useTicker();

  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('boot');
  const [menuCursor, setMenuCursor] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [noteScroll, setNoteScroll] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [lit, setLit] = useState(false); // a luz do visor sempre começa desligada
  const [overlay, setOverlay] = useState<Overlay>(null);
  // recado: abre sozinho no primeiro play (se houver); depois fica no MENU
  const [noteSeen, setNoteSeen] = useState(false);
  const [notePop, setNotePop] = useState(false);
  const [sharing, setSharing] = useState(false);
  const popBtn = useRef<HTMLButtonElement>(null);
  const overlayTimer = useRef<number>();

  const flash = useCallback((o: Overlay, ms = 1300) => {
    setOverlay(o);
    window.clearTimeout(overlayTimer.current);
    overlayTimer.current = window.setTimeout(() => setOverlay(null), ms);
  }, []);

  const startTrack = (i: number) => {
    setIndex(i);
    setLoaded(i);
    yt.load(tracks[i].id, true);
    setMode((m) => (m === 'boot' ? 'now' : m));
  };

  const yt = useYouTube(host, {
    initialId: mix.tracks[0]?.id,
    onEnded: () => {
      if (index < total - 1) startTrack(index + 1);
      else {
        setIndex(0);
        setLoaded(null);
        flash({ kind: 'msg', icon: 'stop', text: 'ACABOU :(', sub: 'PLAY PRA MAIS UMA' }, 2600);
      }
    },
    onError: () => {
      flash({ kind: 'msg', icon: 'stop', text: 'ESSA NAO ROLOU', sub: 'PULANDO…' }, 1600);
      window.setTimeout(() => {
        if (index < total - 1) startTrack(index + 1);
      }, 1700);
    },
  });

  const playing = yt.status === 'playing' || yt.status === 'buffering';
  const current = loaded === index;

  useEffect(() => {
    if (yt.ready) yt.setVolume(volume * 100);
  }, [yt.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = mix.title ? `${mix.title} · Y2Player` : 'Y2Player';
  }, [mix.title]);

  useEffect(() => {
    if (notePop) popBtn.current?.focus();
  }, [notePop]);

  const togglePlay = () => {
    if (mix.note && !noteSeen) {
      setNoteSeen(true);
      setNotePop(true);
      return;
    }
    if (!yt.ready) {
      flash({ kind: 'msg', text: 'CALMA AI…', sub: 'TA CARREGANDO' });
      return;
    }
    if (mode === 'boot' || mode === 'menu') setMode('now');
    if (!current) return startTrack(index);
    if (playing) yt.pause();
    else yt.play();
  };

  const go = (dir: 1 | -1) => {
    if (dir === -1 && current && yt.time > 3) {
      yt.seek(0);
      return;
    }
    const n = (index + dir + total) % total;
    if (playing) startTrack(n);
    else {
      setIndex(n);
      setLoaded(null);
      if (mode === 'boot') setMode('now');
    }
  };

  const noteLines = mix.note.split('\n').reduce((a, p) => a + Math.max(1, Math.ceil(p.length / 30)), 0);
  const maxScroll = Math.max(0, noteLines - 7);

  const enter = (m: Mode) => {
    if (m === 'list') setCursor(index);
    if (m === 'note') setNoteScroll(0);
    setMode(m);
  };

  // MENU (topo da roda) abre o menu; apertar de novo fecha.
  const onMenu = () => {
    if (mode === 'menu') return setMode('now');
    const from = MENU_ITEMS.findIndex((i) => i.id === mode);
    setMenuCursor(from >= 0 ? from : 0);
    setMode('menu');
  };

  // VOLTAR (base da roda) sobe um nível: tela → menu → tocando.
  const onBack = () => {
    if (mode === 'list' || mode === 'note') return onMenu();
    if (mode === 'menu') return setMode('now');
  };

  const onWheel = (z: WheelZone) => {
    if (z === 'menu') return onMenu();
    if (z === 'back') return onBack();
    const dir = z === 'prev' ? -1 : 1;
    // em telas de navegação, retroceder/avançar movem o cursor (girar a roda é só um atalho escondido)
    if (mode === 'menu' || mode === 'list' || mode === 'note') return onJog(dir);
    go(dir);
  };

  const onCenter = () => {
    if (mode === 'menu') return enter(MENU_ITEMS[menuCursor].id);
    if (mode === 'list') {
      startTrack(cursor);
      setMode('now');
      return;
    }
    if (mode === 'note') return setMode('now');
    togglePlay();
  };

  const onJog = (dir: 1 | -1) => {
    if (mode === 'menu') setMenuCursor((c) => Math.max(0, Math.min(MENU_ITEMS.length - 1, c + dir)));
    else if (mode === 'list') setCursor((c) => Math.max(0, Math.min(total - 1, c + dir)));
    else if (mode === 'note') setNoteScroll((s) => Math.max(0, Math.min(maxScroll, s + dir)));
    else if (current && yt.duration) {
      const t = Math.max(0, Math.min(yt.duration - 1, yt.getTime() + dir * 5));
      yt.seek(t);
      flash({ kind: 'msg', icon: dir > 0 ? 'ff' : 'rew', text: fmtTime(t), sub: `DE ${fmtTime(yt.duration)}` }, 700);
    } else {
      go(dir);
    }
  };

  const onVolume = (v: number) => {
    setVolume(v);
    yt.setVolume(v * 100);
    flash({ kind: 'vol' }, 1000);
  };

  // teclado (desktop)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (notePop) {
        if (e.key === 'Escape') closeNote();
        return;
      }
      if (sharing) return;
      if ((e.target as HTMLElement)?.closest?.('input,textarea,[role=slider]')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onCenter();
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowUp') mode === 'now' || mode === 'boot' ? onVolume(Math.min(1, volume + 0.05)) : onJog(-1);
      else if (e.key === 'ArrowDown') mode === 'now' || mode === 'boot' ? onVolume(Math.max(0, volume - 0.05)) : onJog(1);
      else if (e.key.toLowerCase() === 'm') onMenu();
      else if (e.key === 'Escape' || e.key === 'Backspace') onBack();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // fechar o recado já dá o play
  const closeNote = () => {
    setNotePop(false);
    togglePlay();
  };


  const screen = (
    <LcdScreen lit={lit} oled={finish.oled}>
      {mode === 'boot' && (
        <ScreenBoot mood={mix.mood} tick={tick} title={mix.title} to={mix.to} from={mix.from} tracks={total} hasNote={!!mix.note} />
      )}
      {mode === 'menu' && <ScreenMenu cursor={menuCursor} title={mix.title} />}
      {mode === 'now' && (
        <ScreenNow
          mood={mix.mood}
          tick={tick}
          playing={current && playing}
          buffering={current && yt.status === 'buffering'}
          track={tracks[index]}
          index={index}
          total={total}
          time={current ? yt.time : 0}
          duration={current ? yt.duration : 0}
          hasNote={!!mix.note}
        />
      )}
      {mode === 'list' && (
        <ScreenList
          tracks={tracks}
          cursor={cursor}
          playingIndex={loaded ?? -1}
          playing={playing}
          tick={tick}
          label={(mix.title || 'FAIXAS').slice(0, 18)}
        />
      )}
      {mode === 'note' && <ScreenNote to={mix.to} from={mix.from} note={mix.note} scroll={noteScroll} />}
      {overlay?.kind === 'vol' && <OverlayVolume value={volume} />}
      {overlay?.kind === 'msg' && <OverlayMessage icon={overlay.icon} text={overlay.text} sub={overlay.sub} />}
    </LcdScreen>
  );

  return (
    <div className="pp-root pp-stage pp-player" style={finishVars(finish)}>
      <div className="mx-auto flex h-[100dvh] max-w-[480px] flex-col items-center overflow-hidden px-3">
        {/* topo: só o logo, centralizado, que volta pro início */}
        <header className="flex h-14 w-full flex-none items-center justify-center pt-[env(safe-area-inset-top)]">
          <HomeLink />
        </header>
        <main className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
          <div className="pp-cq pp-arrive pp-player-device">
            <Device
              finish={finish}
              screen={screen}
              lit={lit}
              playing={current && playing}
              volume={volume}
              onWheel={onWheel}
              onJog={onJog}
              onCenter={onCenter}
              onVolume={onVolume}
              onLight={setLit}
            />
          </div>
        </main>

        {/* rodapé: compartilhar e criar lado a lado */}
        <footer className="flex w-full flex-none justify-center pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-center gap-2">
            <button
              className="pp-btn is-ghost !h-10 !w-10 !p-0"
              onClick={() => setSharing(true)}
              aria-label="Compartilhar"
              title="Compartilhar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3v12" />
                <path d="m7 8 5-5 5 5" />
                <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
              </svg>
            </button>
            <a href="#/criar" className="pp-btn is-ghost !h-10 !w-10 !p-0" aria-label="Criar a sua" title="Criar a sua">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </a>
          </div>
        </footer>
      </div>
      {notePop && (
        <div className="pp-modal" onClick={(e) => e.target === e.currentTarget && closeNote()}>
          <div className="pp-sheet pp-modal__card pp-fade-in" role="dialog" aria-modal="true" aria-labelledby="pp-note-title">
            <h2 id="pp-note-title" className="text-[22px] font-medium tracking-[-0.01em]">
              {mix.from ? `${mix.from} deixou um recado` : 'Deixaram um recado pra você'}
            </h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-[17px] leading-[1.5]" style={{ color: 'var(--ink-2)' }}>
              {mix.note}
            </p>
            <button ref={popBtn} className="pp-btn is-signal mt-6 w-full" onClick={closeNote}>
              Bora ouvir
            </button>
          </div>
        </div>
      )}
      {sharing && <ShareSheet mix={{ ...mix, tracks }} onClose={() => setSharing(false)} />}
      <div ref={host} className="pp-yt-host" aria-hidden />
    </div>
  );
}
