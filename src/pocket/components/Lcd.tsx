import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { composeScene, fakeVu, makeGrid, stamp, stampText, type Grid } from '../lib/pixels';
import { fmtTime, lcdAuthor, lcdText as U, lcdTitle, type Track } from '../lib/mixtape';
import type { MoodId } from '../tokens';
import { MOODS } from '../tokens';

// ─── Renderizador de matriz de pontos ──────────────────────────────────────

export function PixelGrid({ grid, ghost = 0.075, className }: { grid: Grid; ghost?: number; className?: string }) {
  const pid = 'px' + useId().replace(/[^a-z0-9]/gi, '');
  const { full, mid } = useMemo(() => {
    let full = '';
    let mid = '';
    const s = 0.84;
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const v = grid.px[y * grid.w + x];
        if (!v) continue;
        const r = `M${x + 0.08} ${y + 0.08}h${s}v${s}h-${s}z`;
        if (v === 1) full += r;
        else mid += r;
      }
    }
    return { full, mid };
  }, [grid]);

  return (
    <svg
      viewBox={`0 0 ${grid.w} ${grid.h}`}
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto' }}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <defs>
        <pattern id={pid} width="1" height="1" patternUnits="userSpaceOnUse">
          <rect x="0.08" y="0.08" width="0.84" height="0.84" fill="currentColor" opacity={ghost} />
        </pattern>
      </defs>
      <rect width={grid.w} height={grid.h} fill={`url(#${pid})`} />
      <g className="pp-px-shadow" transform="translate(0.22 0.26)">
        <path d={full} fill="currentColor" />
      </g>
      <path d={mid} fill="currentColor" opacity={0.42} />
      <path className="pp-px-full" d={full} fill="currentColor" />
    </svg>
  );
}

// ─── Ícones de pixel ───────────────────────────────────────────────────────

const ICONS: Record<string, string[]> = {
  play: ['#....', '###..', '#####', '###..', '#....'],
  pause: ['##.##', '##.##', '##.##', '##.##', '##.##'],
  stop: ['#####', '#####', '#####', '#####', '#####'],
  heart: ['##.##', '#####', '#####', '.###.', '..#..'],
  note: ['..###', '..#.#', '..#.#', '###.#', '##.##'],
  vol: ['...#.', '..##.', '####.', '..##.', '...#.'],
  batt: ['######.', '#:::::#', '#:::::#', '######.'],
  cursor: ['#...', '##..', '###.', '##..', '#...'],
  check: ['....#', '...##', '#.##.', '###..', '.#...'],
  rew: ['..#..#', '.##.##', '######', '.##.##', '..#..#'],
  prev: ['#...#', '#..##', '#.###', '#..##', '#...#'],
  next: ['#...#', '##..#', '###.#', '##..#', '#...#'],
  ff: ['#..#..', '##.##.', '######', '##.##.', '#..#..'],
};

export function PxIcon({ name, size = 2.2 }: { name: keyof typeof ICONS | string; size?: number }) {
  const map = ICONS[name] ?? ICONS.play;
  const g = useMemo(() => {
    const w = Math.max(...map.map((r) => r.length));
    const grid = makeGrid(w, map.length);
    stamp(grid, map, 0, 0);
    return grid;
  }, [map]);
  return (
    <span style={{ display: 'inline-block', width: `${(size * g.w) / g.h}cqw`, height: `${size}cqw` }}>
      <PixelGrid grid={g} ghost={0} />
    </span>
  );
}

// ─── Mascote ───────────────────────────────────────────────────────────────

export function MascotScene(props: {
  mood: MoodId;
  tick: number;
  playing: boolean;
  w?: number;
  h?: number;
  charX?: number;
  vu?: boolean;
  sleep?: boolean;
  celebrate?: boolean;
  ghost?: number;
}) {
  const { mood, tick, playing, w, h, charX, vu, sleep, celebrate, ghost } = props;
  const grid = useMemo(
    () => composeScene({ mood, tick, playing, w, h, charX, sleep, celebrate, vu: vu ? fakeVu(tick, playing) : null }),
    [mood, tick, playing, w, h, charX, vu, sleep, celebrate],
  );
  return <PixelGrid grid={grid} ghost={ghost} />;
}

// ─── Telas ─────────────────────────────────────────────────────────────────

export function LcdScreen({ lit, oled, children }: { lit?: boolean; oled?: boolean; children: ReactNode }) {
  return <div className={`pp-lcd ${lit ? 'is-lit' : ''} ${oled ? 'is-oled' : ''}`}>{children}</div>;
}

function Marquee({ text, className }: { text: string; className?: string }) {
  const long = text.length > 17;
  if (!long)
    return (
      <div className={className}>
        <span>{text}</span>
      </div>
    );
  const steps = text.length * 6;
  return (
    <div className={className}>
      <span className="pp-marquee" style={{ '--dur': `${text.length * 0.42}s`, '--steps': steps } as CSSProperties}>
        <span>{text}</span>
        <span aria-hidden>{text}</span>
      </span>
    </div>
  );
}

// Letreiro que só corre quando o texto não cabe na caixa (mede o texto, não conta caracteres).
function FitMarquee({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const [over, setOver] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    const t = el?.querySelector<HTMLElement>('[data-text]');
    if (el && t) setOver(t.offsetWidth > el.clientWidth + 1);
  }, [text]);
  const steps = text.length * 6;
  return (
    <span ref={box} className={className} style={over ? { textOverflow: 'clip' } : undefined}>
      {over ? (
        <span className="pp-marquee" style={{ '--dur': `${text.length * 0.42}s`, '--steps': steps } as CSSProperties}>
          <span data-text>{text}</span>
          <span aria-hidden>{text}</span>
        </span>
      ) : (
        <span data-text>{text}</span>
      )}
    </span>
  );
}

function Battery() {
  return <PxIcon name="batt" size={1.8} />;
}

export function StatusBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <>
      <div className="pp-lcd-status">
        <span>{left}</span>
        <span>
          {right}
          <Battery />
        </span>
      </div>
      <div className="pp-lcd-rule" />
    </>
  );
}

export function ProgressBar({ time, duration }: { time: number; duration: number }) {
  const p = duration > 0 ? Math.min(1, time / duration) : 0;
  const n = 32;
  const on = Math.floor(p * n);
  return (
    <div className="pp-progress">
      <span>{fmtTime(time)}</span>
      <div className="pp-progress__bar">
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={i < on ? 'on' : i === on && p > 0 ? 'head' : ''} />
        ))}
      </div>
      <span>-{fmtTime(Math.max(0, duration - time))}</span>
    </div>
  );
}

export interface NowProps {
  mood: MoodId;
  tick: number;
  playing: boolean;
  track?: Track;
  index: number;
  total: number;
  time: number;
  duration: number;
  buffering?: boolean;
  hasNote?: boolean;
}

export function ScreenNow(p: NowProps) {
  const title = p.track ? lcdTitle(p.track.title) : 'FAIXA VAZIA';
  return (
    <>
      <StatusBar
        left={
          <>
            <PxIcon name={p.playing ? 'play' : 'pause'} size={1.9} />
            <span>
              {String(p.index + 1).padStart(2, '0')}/{String(p.total).padStart(2, '0')}
            </span>
          </>
        }
        right={
          <>
            {p.buffering && <span className="pp-blink">···</span>}
            {p.hasNote && <PxIcon name="heart" size={1.8} />}
          </>
        }
      />
      {/* Duas seções numa coluna única: o bichinho e, separado por um vão maior,
          o bloco da faixa (controles, título, artista, progresso) com vãos iguais.
          Os vãos crescem em proporção à altura que sobra. */}
      <div className="pp-now">
        <i className="pp-gap" />
        <MascotScene mood={p.mood} tick={p.tick} playing={p.playing} vu w={48} h={21} charX={14} />
        <i className="pp-gap is-section" />
        <div className="pp-transport" aria-hidden>
          <PxIcon name="prev" size={3} />
          <PxIcon name={p.playing ? 'pause' : 'play'} size={3.6} />
          <PxIcon name="next" size={3} />
        </div>
        <i className="pp-gap" />
        <div className="pp-now__meta">
          <Marquee text={U(title)} className="pp-lcd-title" />
          <div className="pp-lcd-sub">{U(lcdAuthor(p.track?.author ?? '—'))}</div>
        </div>
        <i className="pp-gap" />
        <ProgressBar time={p.time} duration={p.duration} />
      </div>
    </>
  );
}

// Visor da landing: só o bichinho, sem música. Troca de humor (e de cor) sozinho.
export function ScreenPet({ mood, tick, playing }: { mood: MoodId; tick: number; playing: boolean }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '92%' }}>
        <MascotScene mood={mood} tick={tick} playing={playing} w={40} h={24} charX={10} />
      </div>
    </div>
  );
}

export function ScreenList({
  tracks,
  cursor,
  playingIndex,
  playing,
  tick,
  label = 'LISTA',
}: {
  tracks: (Track | null)[];
  cursor: number;
  playingIndex: number;
  playing: boolean;
  tick: number;
  label?: string;
}) {
  return (
    <>
      <StatusBar
        left={
          <>
            <PxIcon name="note" size={1.9} />
            <span>{U(label)}</span>
          </>
        }
        right={<span>{String(tracks.filter(Boolean).length).padStart(2, '0')}/{String(tracks.length).padStart(2, '0')}</span>}
      />
      <ul className="pp-lcd-list">
        {tracks.map((t, i) => (
          <li key={i} className={i === cursor ? 'is-cursor' : ''}>
            <span style={{ opacity: 0.7 }}>{String(i + 1).padStart(2, '0')}</span>
            {t && i === cursor ? (
              <FitMarquee text={U(lcdTitle(t.title))} className="t" />
            ) : (
              <span className="t">{t ? U(lcdTitle(t.title)) : '· · · · · ·'}</span>
            )}
            {i === playingIndex && t && (
              <span style={{ width: '2.4cqw', display: 'inline-flex' }}>
                {playing ? (
                  <span style={{ opacity: tick % 4 < 2 ? 1 : 0.3 }}>
                    <PxIcon name="play" size={1.8} />
                  </span>
                ) : (
                  <PxIcon name="pause" size={1.8} />
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="pp-lcd-sub" style={{ marginTop: 'auto', textAlign: 'center' }}>
        ◀ ▶ ESCOLHE · OK TOCA
      </div>
    </>
  );
}

// MENU da roda: um único lugar para tocando / faixas / bilhete.
export type MenuItem = 'now' | 'list' | 'note';
export const MENU_ITEMS: { id: MenuItem; label: string; icon: string }[] = [
  { id: 'now', label: 'TOCANDO AGORA', icon: 'play' },
  { id: 'list', label: 'FAIXAS', icon: 'note' },
  { id: 'note', label: 'BILHETE', icon: 'heart' },
];

export function ScreenMenu({ cursor, title }: { cursor: number; title?: string }) {
  return (
    <>
      <StatusBar
        left={
          <>
            <PxIcon name="cursor" size={1.9} />
            <span>MENU</span>
          </>
        }
      />
      <ul className="pp-lcd-list pp-lcd-menu">
        {MENU_ITEMS.map((m, i) => (
          <li key={m.id} className={i === cursor ? 'is-cursor' : ''}>
            <PxIcon name={m.icon} size={1.9} />
            <span className="t">{m.label}</span>
            {i === cursor && <PxIcon name="cursor" size={1.8} />}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'auto', textAlign: 'center' }}>
        {title && <div className="pp-lcd-sub">{U(title)}</div>}
        <div className="pp-lcd-sub">◀ ▶ ESCOLHE · OK ENTRA</div>
      </div>
    </>
  );
}

export function ScreenNote({ to, from, note, scroll = 0 }: { to: string; from: string; note: string; scroll?: number }) {
  return (
    <>
      <StatusBar
        left={
          <>
            <PxIcon name="heart" size={1.9} />
            <span>BILHETE</span>
          </>
        }
      />
      <div style={{ fontSize: '2.1cqw', lineHeight: 1.4, opacity: 0.7, textAlign: 'center' }}>PARA {U(to || '—')}</div>
      <div style={{ flex: 1, overflow: 'hidden', marginTop: '1.6cqw', position: 'relative' }}>
        <div className="pp-note" style={{ transform: `translateY(${-scroll * 5.4}cqw)`, transition: 'transform 120ms steps(2)' }}>
          {note || 'escreve aqui, vai…'}
        </div>
      </div>
      <div style={{ fontSize: '2.1cqw', textAlign: 'center', marginTop: '1.2cqw' }}>— {U(from || 'ALGUEM')}</div>
    </>
  );
}

export function ScreenBoot({
  mood,
  tick,
  title,
  to,
  from,
  tracks = 5,
  hasNote = false,
}: {
  mood: MoodId;
  tick: number;
  title: string;
  to: string;
  from: string;
  tracks?: number;
  hasNote?: boolean;
}) {
  const grid = useMemo(() => {
    const g = composeScene({ mood, tick, playing: false, sleep: true, w: 52, h: 27, charX: 16 });
    stampText(g, 'MIXTAPE', 12, 0);
    return g;
  }, [mood, tick]);
  return (
    <>
      <StatusBar
        left={
          <>
            <PxIcon name="note" size={1.9} />
            <span>{String(tracks).padStart(2, '0')} FAIXAS</span>
          </>
        }
        right={hasNote ? <PxIcon name="heart" size={1.8} /> : null}
      />
      <div style={{ margin: '0 -0.6cqw' }}>
        <PixelGrid grid={grid} ghost={0.06} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 'auto' }}>
        <Marquee text={U(title || 'SEM TITULO')} className="pp-lcd-title" />
        <div className="pp-lcd-sub" style={{ marginTop: '1cqw' }}>
          {from ? `DE ${U(from)}` : ''}
          {to && from ? ' ' : ''}
          {to ? `PARA ${U(to)}` : ''}
        </div>
        <div className="pp-blink" style={{ fontSize: '2cqw', marginTop: '1.4cqw', display: 'flex', gap: '1.2cqw', justifyContent: 'center', alignItems: 'center' }}>
          APERTE <PxIcon name="play" size={1.8} />
        </div>
      </div>
    </>
  );
}

export function ScreenSaved({ mood, tick, count, label = 'GRAVADA' }: { mood: MoodId; tick: number; count: number; label?: string }) {
  return (
    <>
      <StatusBar
        left={
          <>
            <PxIcon name="check" size={1.9} />
            <span>OK</span>
          </>
        }
      />
      <div style={{ margin: '0 -0.6cqw' }}>
        <MascotScene mood={mood} tick={tick} playing celebrate w={44} h={22} charX={12} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 'auto' }}>
        <div className="pp-lcd-title">MIXTAPE {label}</div>
        <div className="pp-lcd-sub" style={{ marginTop: '1.2cqw' }}>
          {count} FAIXAS · LINK PRONTO
        </div>
      </div>
    </>
  );
}

export function OverlayVolume({ value }: { value: number }) {
  const on = Math.round(value * 20);
  return (
    <div className="pp-lcd-overlay">
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.2cqw' }}>
        <PxIcon name="vol" size={2} /> VOLUME {Math.round(value * 100)}
      </div>
      <div className="pp-seg">
        {Array.from({ length: 20 }, (_, i) => (
          <i key={i} className={i < on ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

export function OverlayMessage({ icon, text, sub }: { icon?: string; text: string; sub?: string }) {
  return (
    <div className="pp-lcd-overlay" style={{ alignItems: 'center', textAlign: 'center' }}>
      <span style={{ display: 'flex', gap: '1.4cqw', alignItems: 'center' }}>
        {icon && <PxIcon name={icon} size={2} />}
        {text}
      </span>
      {sub && <span style={{ opacity: 0.65, fontSize: '1.9cqw' }}>{sub}</span>}
    </div>
  );
}
