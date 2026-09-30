// Link para a home, no rodapé, no mesmo estilo das legendas do cabeçalho.
// Sublinhado para deixar claro que é link.
export function HomeLink() {
  return (
    <a href="#/" className="pp-spec underline underline-offset-4" style={{ color: 'var(--ink-2)' }}>
      Y2Player
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
