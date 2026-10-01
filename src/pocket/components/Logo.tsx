import { LOGO_BOX, LOGO_PATHS } from '../lib/logo';

// Pinta com currentColor pra seguir a tinta da página.
export function Logo({ height = 20 }: { height?: number }) {
  const { x, y, w, h } = LOGO_BOX;
  return (
    <svg viewBox={`${x} ${y} ${w} ${h}`} height={height} fill="currentColor" style={{ display: 'block', width: 'auto' }} aria-hidden>
      {LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
