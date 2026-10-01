import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type React from 'react';
import { haptic } from '../lib/haptics';
import { materialVars, type Finish } from '../tokens';

export type WheelZone = 'menu' | 'prev' | 'next' | 'back';

// ─── Ícones gravados (traço geométrico, estilo Braun) ──────────────────────

const I = {
  prev: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="6" width="2.4" height="12" rx="0.6" />
      <path d="M19 6.6v10.8a.6.6 0 0 1-.93.5L9.3 12.5a.6.6 0 0 1 0-1l8.77-5.4a.6.6 0 0 1 .93.5z" />
    </svg>
  ),
  next: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="17.6" y="6" width="2.4" height="12" rx="0.6" />
      <path d="M5 6.6v10.8a.6.6 0 0 0 .93.5l8.77-5.4a.6.6 0 0 0 0-1L5.93 6.1A.6.6 0 0 0 5 6.6z" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7 4.5 11.5 9 16" />
      <path d="M5 11.5h9.5a4.5 4.5 0 0 1 0 9H12" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4.9v14.2a.8.8 0 0 0 1.22.68l11.4-7.1a.8.8 0 0 0 0-1.36L8.22 4.22A.8.8 0 0 0 7 4.9z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4.2" height="14" rx="0.8" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="0.8" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 20.3 4.2 12.7a4.9 4.9 0 0 1 6.9-6.9l.9.9.9-.9a4.9 4.9 0 0 1 6.9 6.9z" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="5" width="18" height="2.4" rx="1" />
      <rect x="3" y="10.8" width="18" height="2.4" rx="1" />
      <rect x="3" y="16.6" width="12" height="2.4" rx="1" />
    </svg>
  ),
};
export const EngraveIcon = I;

// ─── Click-wheel ───────────────────────────────────────────────────────────

function zoneOf(deg: number): WheelZone {
  // 0° = direita, 90° = baixo (coordenadas de tela)
  // 0° = direita, 90° = baixo (coordenadas de tela)
  const a = ((deg % 360) + 360) % 360;
  if (a >= 315 || a < 45) return 'next';
  if (a < 135) return 'back';
  if (a < 225) return 'prev';
  return 'menu';
}

export function ClickWheel({
  onPress,
  onJog,
  onCenter,
  playing,
  centerIcon,
  demoPress,
}: {
  onPress?: (z: WheelZone) => void;
  onJog?: (dir: 1 | -1) => void;
  onCenter?: () => void;
  playing?: boolean;
  centerIcon?: ReactNode;
  demoPress?: WheelZone | 'center' | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ active: false, last: 0, acc: 0, moved: 0, zone: null as WheelZone | null, id: -1 });
  const [press, setPress] = useState<WheelZone | null>(null);
  const [rot, setRot] = useState(0);
  const DETENT = 18; // graus por clique de jog

  const angle = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    return { deg: (Math.atan2(dy, dx) * 180) / Math.PI, dist: Math.hypot(dx, dy) / (r.width / 2) };
  };

  const down = (e: React.PointerEvent) => {
    const { deg, dist } = angle(e);
    if (dist < 0.4 || dist > 1.02) return;
    ref.current!.setPointerCapture(e.pointerId);
    const z = zoneOf(deg);
    st.current = { active: true, last: deg, acc: 0, moved: 0, zone: z, id: e.pointerId };
    setPress(z);
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.active || e.pointerId !== s.id) return;
    const { deg } = angle(e);
    let d = deg - s.last;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    s.last = deg;
    s.moved += Math.abs(d);
    if (s.moved > 10 && s.zone) {
      s.zone = null;
      setPress(null);
    }
    if (s.zone) return;
    s.acc += d;
    setRot((r) => r + d);
    while (Math.abs(s.acc) >= DETENT) {
      const dir = s.acc > 0 ? 1 : -1;
      s.acc -= dir * DETENT;
      haptic('tick');
      onJog?.(dir);
    }
  };
  const up = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.active || e.pointerId !== s.id) return;
    if (s.zone) {
      haptic('key');
      onPress?.(s.zone);
    }
    s.active = false;
    setPress(null);
  };

  const zone = press ?? (demoPress && demoPress !== 'center' ? demoPress : null);
  const kb = (z: WheelZone) => (e: React.MouseEvent) => {
    // só teclado (detail 0); toques são tratados pelo anel
    if (e.detail === 0) {
      haptic('key');
      onPress?.(z);
    }
  };

  return (
    <div
      ref={ref}
      className="pp-wheel"
      data-press={zone ?? undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ '--rot': `${rot}deg` } as CSSProperties}
    >
      <div className="pp-wheel__disc">
        <div className="pp-wheel__ticks" />
        <div className="pp-wheel__shade" />
        <button className="pp-wheel__label" style={{ left: '50%', top: '14%' }} onClick={kb('menu')} aria-label="Menu">
          MENU
        </button>
        <button className="pp-wheel__label" style={{ left: '14%', top: '50%' }} onClick={kb('prev')} aria-label="Retroceder">
          {I.prev}
        </button>
        <button className="pp-wheel__label" style={{ left: '86%', top: '50%' }} onClick={kb('next')} aria-label="Avançar">
          {I.next}
        </button>
        <button className="pp-wheel__label" style={{ left: '50%', top: '86%' }} onClick={kb('back')} aria-label="Voltar">
          {I.back}
        </button>
        <div className="pp-center-seat">
          <button
            className={`pp-center ${demoPress === 'center' ? 'is-down' : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              haptic('heavy');
            }}
            onClick={() => onCenter?.()}
            aria-label={playing ? 'Pausar' : 'Tocar'}
          >
            {centerIcon ?? (playing ? I.pause : I.play)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Knob de volume ────────────────────────────────────────────────────────

const SWEEP = 270;

export function Knob({ value, onChange, label = 'VOL' }: { value: number; onChange?: (v: number) => void; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ active: false, last: 0, id: -1 });
  const lastDetent = useRef(Math.round(value * 20));

  const set = (v: number) => {
    const nv = Math.max(0, Math.min(1, v));
    const d = Math.round(nv * 20);
    if (d !== lastDetent.current) {
      lastDetent.current = d;
      haptic('detent');
    }
    onChange?.(nv);
  };
  const ang = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  const rot = -SWEEP / 2 + value * SWEEP;
  const dots = 11;

  return (
    <div className="pp-knob-wrap">
      <div className="pp-knob-scale" aria-hidden>
        {Array.from({ length: dots }, (_, i) => {
          const a = ((-SWEEP / 2 + (i / (dots - 1)) * SWEEP - 90) * Math.PI) / 180;
          const r = 11.2;
          return (
            <i
              key={i}
              className={i / (dots - 1) <= value + 0.001 && value > 0 ? 'on' : ''}
              style={{ transform: `translate(${Math.cos(a) * r}cqw, ${Math.sin(a) * r}cqw)` }}
            />
          );
        })}
      </div>
      <div
        ref={ref}
        className="pp-knob"
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        style={{ transform: `rotate(${rot}deg)` }}
        onPointerDown={(e) => {
          ref.current!.setPointerCapture(e.pointerId);
          st.current = { active: true, last: ang(e), id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const s = st.current;
          if (!s.active || e.pointerId !== s.id) return;
          const a = ang(e);
          let d = a - s.last;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          s.last = a;
          set(value + d / SWEEP);
        }}
        onPointerUp={() => (st.current.active = false)}
        onPointerCancel={() => (st.current.active = false)}
        onWheel={(e) => set(value - Math.sign(e.deltaY) * 0.05)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set(value + 0.05);
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set(value - 0.05);
        }}
      >
        <div className="pp-knob__cap" />
        <div className="pp-knob__mark" />
      </div>
      <span className="pp-engrave" style={{ position: 'absolute', bottom: '-1.2cqw', fontSize: '2cqw' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Chave e LED ───────────────────────────────────────────────

export function SlideSwitch({ on, onChange, label }: { on: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <div className="pp-switch-row">
      <span className="pp-engrave" style={{ fontSize: '2cqw' }}>
        {label}
      </span>
      <button
        className={`pp-switch ${on ? 'is-on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => {
          haptic('switch');
          onChange?.(!on);
        }}
      >
        <span className="pp-switch__thumb" />
      </button>
    </div>
  );
}

export function Led({ on, pulse }: { on: boolean; pulse?: boolean }) {
  return <span className={`pp-led ${on ? 'is-on' : ''} ${on && pulse ? 'is-pulse' : ''}`} />;
}

// ─── Botões laterais ───────────────────────────────────────────────────────
// Teclas de borda, saindo de baixo da casca: volume à esquerda, luz à direita.
// `repeat` dispara de novo enquanto segura (volume).

export function SideKey({
  side,
  label,
  onPress,
  repeat,
  style,
}: {
  side: 'left' | 'right';
  label: string;
  onPress?: () => void;
  repeat?: boolean;
  style?: CSSProperties;
}) {
  const [down, setDown] = useState(false);
  const timer = useRef<number>();
  const stop = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(timer.current);
    setDown(false);
  };
  return (
    <button
      className={`pp-sidekey is-${side} ${down ? 'is-down' : ''}`}
      style={style}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        haptic('key');
        onPress?.();
        if (repeat) {
          timer.current = window.setTimeout(() => {
            timer.current = window.setInterval(() => {
              haptic('tick');
              onPress?.();
            }, 110);
          }, 380);
        }
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onClick={(e) => {
        // só teclado (detail 0); toques já foram tratados no pointerdown
        if (e.detail === 0) {
          haptic('key');
          onPress?.();
        }
      }}
    />
  );
}

// ─── Aparelho ──────────────────────────────────────────────────────────────
// `framed` só existe para mostrar o conjunto isolado na decupagem.

export interface DeviceProps {
  finish: Finish;
  screen: ReactNode;
  lit?: boolean;
  playing?: boolean;
  volume?: number;
  onWheel?: (z: WheelZone) => void;
  onJog?: (dir: 1 | -1) => void;
  onCenter?: () => void;
  onVolume?: (v: number) => void;
  onLight?: (v: boolean) => void;
  demoPress?: WheelZone | 'center' | null;
  framed?: boolean;
  style?: CSSProperties;
  className?: string;
}

const VOL_STEP = 0.05;

export function Device(p: DeviceProps) {
  // o volume lido na hora do clique (o repeat do botão segura um closure antigo)
  const vol = useRef(p.volume ?? 0.8);
  vol.current = p.volume ?? 0.8;
  const lit = useRef(!!p.lit);
  lit.current = !!p.lit;
  const nudge = (d: number) => {
    const v = Math.max(0, Math.min(1, Math.round((vol.current + d) * 100) / 100));
    vol.current = v;
    p.onVolume?.(v);
  };

  return (
    <div className={`pp-shell ${p.className ?? ''}`} style={{ ...materialVars(p.finish), ...p.style }}>
      <SideKey side="left" label="Aumentar volume" repeat onPress={() => nudge(VOL_STEP)} style={{ top: '20cqw', height: '12cqw' }} />
      <SideKey side="left" label="Diminuir volume" repeat onPress={() => nudge(-VOL_STEP)} style={{ top: '34.5cqw', height: '12cqw' }} />
      <SideKey side="right" label="Luz do visor" onPress={() => p.onLight?.(!lit.current)} style={{ top: '19cqw', height: '15cqw' }} />

      <div className={`pp-device ${p.framed ? 'is-framed' : ''}`}>
        <div className="pp-bezel">
          {p.screen}
          <div className="pp-glass" />
        </div>

        <div className="pp-deck">
          <ClickWheel
            onPress={p.onWheel}
            onJog={p.onJog}
            onCenter={p.onCenter}
            playing={p.playing}
            demoPress={p.demoPress}
          />
        </div>
      </div>
    </div>
  );
}
