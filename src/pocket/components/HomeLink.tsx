// Link para a home, sempre no topo e centralizado, no mesmo estilo das legendas do topo.
// Sublinhado para deixar claro que é link.
export function HomeLink() {
  return (
    <a href="#/" className="pp-spec underline underline-offset-4" style={{ color: 'var(--ink-2)' }}>
      Y2Player
    </a>
  );
}

// Faixa do topo para telas que não têm cabeçalho próprio no centro da página.
export function HomeBar({ className = 'h-14' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center ${className}`}>
      <span className="pointer-events-auto">
        <HomeLink />
      </span>
    </div>
  );
}
