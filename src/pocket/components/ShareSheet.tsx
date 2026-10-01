import { useEffect, useRef, useState } from 'react';
import type { Mixtape } from '../lib/mixtape';
import { renderStory } from '../lib/story';

// Compartilhar o mix recebido: link ou imagem pros stories.
// A imagem é gerada ao abrir a folha, para o compartilhar do sistema
// poder ser chamado direto no toque (o Safari exige isso).
export function ShareSheet({ mix, onClose }: { mix: Mixtape; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState<'link' | 'image' | null>(null);
  const first = useRef<HTMLButtonElement>(null);
  const link = location.href;
  const close = useRef(onClose);
  close.current = onClose;

  // só ao abrir: o player redesenha várias vezes por segundo e não pode regerar a imagem
  useEffect(() => {
    let alive = true;
    renderStory(mix)
      .then((b) => alive && setFile(new File([b], 'y2player-mix.png', { type: 'image/png' })))
      .catch(() => {});
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', esc);
    return () => {
      alive = false;
      window.removeEventListener('keydown', esc);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt('Copia o link:', link);
    }
  };

  const shareImage = () => {
    if (!file) return;
    // o link vai junto na área de transferência, pronto pro adesivo de link do story
    copyLink();
    setDone('image');
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => {});
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div className="pp-modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pp-sheet pp-modal__card pp-fade-in" role="dialog" aria-modal="true" aria-labelledby="pp-share-title">
        <h2 id="pp-share-title" className="text-[22px] font-medium tracking-[-0.01em]">
          Compartilhar este mix
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          <button ref={first} className="pp-btn is-signal w-full" onClick={shareImage} disabled={!file}>
            {file ? 'Imagem pros stories' : 'Gerando imagem…'}
          </button>
          <button
            className="pp-btn is-ghost w-full"
            onClick={() => {
              copyLink();
              setDone('link');
            }}
          >
            {done === 'link' ? 'Link copiado' : 'Copiar link'}
          </button>
        </div>
        {done === 'image' && (
          <p className="mt-4 text-[15px] leading-[1.45]" style={{ color: 'var(--ink-2)' }}>
            O link também foi copiado. Cola no adesivo de link do story.
          </p>
        )}
      </div>
    </div>
  );
}
