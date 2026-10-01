import { Logo } from './Logo';

// Link para a home, no rodapé: o logo do app.
export function HomeLink() {
  return (
    <a href="#/" aria-label="Y2Player" className="inline-block" style={{ color: 'var(--ink-2)' }}>
      <Logo />
    </a>
  );
}

// Faixa do rodapé para telas que não têm rodapé próprio.
export function HomeBar({ className = 'h-14' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center ${className}`}>
      <span className="pointer-events-auto">
        <HomeLink />
      </span>
    </div>
  );
}
