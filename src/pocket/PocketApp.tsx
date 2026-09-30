import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react';
import './pocket.css';
import { decodeMixtape, decodeShort, DEMO, type Mixtape } from './lib/mixtape';
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

// Link de mixtape: formato 2 (curto) é qualquer hash que não começa com "/";
// o formato 1 (#/m/…) segue abrindo para links já compartilhados.
function useMixtape(route: string) {
  const [state, setState] = useState<{ route: string; mix: Mixtape | null } | null>(null);
  const isV1 = route.startsWith('/m/');
  const isV2 = !route.startsWith('/');
  useEffect(() => {
    if (!isV2) return;
    let alive = true;
    decodeShort(route).then((mix) => alive && setState({ route, mix }));
    return () => {
      alive = false;
    };
  }, [route, isV2]);
  if (isV1) return { is: true, ready: true, mix: decodeMixtape(route.slice(3)) };
  if (isV2) return { is: true, ready: state?.route === route, mix: state?.route === route ? state.mix : null };
  return { is: false, ready: true, mix: null };
}

export default function PocketApp() {
  const route = useHash();
  const link = useMixtape(route);

  if (link.is) {
    if (!link.ready) return <div className="pp-root pp-stage" />;
    if (!link.mix) return <Broken />;
    return <PlayerScreen key={route} mix={link.mix} />;
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
