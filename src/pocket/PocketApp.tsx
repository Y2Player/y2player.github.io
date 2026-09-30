import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import './pocket.css';
import { decodeMixtape, DEMO } from './lib/mixtape';
import { PlayerScreen } from './screens/Player';
import { Landing } from './screens/Landing';
import { CreateWizard } from './screens/Create';

// Páginas internas (decupagem e protótipo antigo) ficam fora do repositório público.
// O glob só encontra os arquivos quando eles existem, então o build público não quebra.
const internal = import.meta.glob<{ default?: ComponentType; AssetSheet?: ComponentType }>(['./screens/Assets.tsx', '../App.tsx']);
const Assets = internal['./screens/Assets.tsx'] && lazy(() => internal['./screens/Assets.tsx']().then((m) => ({ default: m.AssetSheet! })));
const Legacy = internal['../App.tsx'] && lazy(() => internal['../App.tsx']().then((m) => ({ default: m.default! })));

function useHash() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const h = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return hash.replace(/^#/, '') || '/';
}

export default function PocketApp() {
  const route = useHash();
  const mix = useMemo(() => (route.startsWith('/m/') ? decodeMixtape(route.slice(3)) : null), [route]);

  if (route.startsWith('/m/')) {
    if (!mix) return <Broken />;
    return <PlayerScreen key={route} mix={mix} />;
  }
  if (route === '/demo') return <PlayerScreen key="demo" mix={DEMO} demo />;
  if (route === '/criar') return <CreateWizard />;
  if (route === '/assets' && Assets)
    return (
      <Suspense fallback={null}>
        <Assets />
      </Suspense>
    );
  if (route === '/legacy' && Legacy)
    return (
      <Suspense fallback={null}>
        <div className="min-h-screen bg-[#121316] text-white">
          <Legacy />
        </div>
      </Suspense>
    );
  return <Landing />;
}

function Broken() {
  useEffect(() => {
    document.title = 'Y2Player';
  }, []);
  return (
    <div className="pp-root pp-stage grid place-items-center px-6 text-center">
      <div>
        <p className="pp-spec" style={{ color: 'var(--ink-3)' }}>
          Erro 404
        </p>
        <h1 className="mt-3 text-2xl font-medium">Esse link chegou todo amassado ):</h1>
        <p className="mt-2" style={{ color: 'var(--ink-2)' }}>
          Pede pra quem mandou copiar de novo. Inteirinho dessa vez.
        </p>
        <a href="#/criar" className="pp-btn mt-8">
          Fazer a minha
        </a>
      </div>
    </div>
  );
}
