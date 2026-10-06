import { useEffect, useMemo, useRef, useState } from 'react';
import { Device } from '../components/Hardware';
import { LcdScreen, MascotScene, ScreenList, ScreenNote, ScreenNow, ScreenSaved } from '../components/Lcd';
import { useTicker } from '../hooks/useTicker';
import { haptic } from '../lib/haptics';
import {
  fetchTrackInfo,
  LIMITS,
  looksLikeLink,
  parseYouTubeId,
  searchTracks,
  shareUrl,
  thumb,
  MAX_TRACKS,
  MIN_TRACKS,
  type Mixtape,
  type Track,
} from '../lib/mixtape';
import { FINISHES, MOOD_LIST, finishForMood, finishVars, type MoodId } from '../tokens';

// link: empty → loading → ok | invalid | notfound
// busca por nome: query → searching → results | noresults | quota | searcherror
type SlotStatus =
  | 'empty'
  | 'loading'
  | 'ok'
  | 'invalid'
  | 'notfound'
  | 'query'
  | 'searching'
  | 'results'
  | 'noresults'
  | 'quota'
  | 'searcherror';
const SEARCHING: SlotStatus[] = ['query', 'searching', 'results', 'noresults', 'quota', 'searcherror'];
interface Slot {
  key: string; // identidade fixa: a posição muda quando a pessoa reordena
  url: string; // o que está no campo: link ou o nome buscado
  status: SlotStatus;
  track?: Track;
  results?: Track[];
}

let slotSeq = 0;
const newSlot = (url = '', status: SlotStatus = 'empty'): Slot => ({ key: `s${++slotSeq}`, url, status });

const STEP_TITLES = ['Escolha um bichinho', 'Defina as músicas', 'Agora um recado'];

// quem chega pelo + de um mix: o Voltar da primeira etapa retorna a ele
export const FROM_MIX_KEY = 'pp-from-mix';

export function CreateWizard() {
  const tick = useTicker();
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<MoodId>('groovy');
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: MIN_TRACKS }, () => newSlot()));
  const [focusRow, setFocusRow] = useState(0);
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lit, setLit] = useState(false);
  const [vol, setVol] = useState(0.7);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [override, setOverride] = useState<'now' | 'note' | 'list' | null>(null);
  const timers = useRef(new Map<string, number>());
  // lido ao abrir e apagado depois de montar, pra não valer numa próxima visita à criação
  const [fromMix] = useState(() => sessionStorage.getItem(FROM_MIX_KEY) ?? '');
  useEffect(() => sessionStorage.removeItem(FROM_MIX_KEY), []);
  // a cor do aparelho vem do humor
  const finish = finishForMood(mood);
  const finishId = finish.id;

  useEffect(() => {
    document.title = 'Novo mix · Y2Player';
  }, []);
  useEffect(() => setOverride(null), [step]);
  useEffect(() => {
    if (link) document.getElementById('pp-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [link]);

  const setSlotUrl = (i: number, url: string) => {
    const key = slots[i]?.key;
    if (!key) return;
    setLink(null);
    // texto que não é link vira busca: espera a pessoa apertar Buscar
    const status: SlotStatus = !url.trim() ? 'empty' : looksLikeLink(url) ? 'loading' : 'query';
    setSlots((s) => s.map((x) => (x.key === key ? { ...x, url, status, track: undefined, results: undefined } : x)));
    window.clearTimeout(timers.current.get(key));
    if (status !== 'loading') return;
    timers.current.set(key, window.setTimeout(() => validate(key, i, url), 350));
  };

  const searchSlot = (i: number) => {
    const slot = slots[i];
    if (!slot || !slot.url.trim() || slot.status === 'searching') return;
    const { key, url } = slot;
    const update = (patch: Partial<Slot>) =>
      setSlots((s) => s.map((x) => (x.key === key && x.url === url ? { ...x, ...patch } : x)));
    haptic('key');
    // fecha o teclado pra lista de resultados aparecer
    (document.activeElement as HTMLElement | null)?.blur();
    update({ status: 'searching', results: undefined });
    searchTracks(url)
      .then((results) => update(results.length ? { status: 'results', results: results.slice(0, 5) } : { status: 'noresults' }))
      .catch((e: Error) => update({ status: e.message === 'quota' ? 'quota' : 'searcherror' }));
  };

  const pickResult = (i: number, track: Track) => {
    const key = slots[i]?.key;
    if (!key) return;
    haptic('tick');
    setLink(null);
    setSlots((s) =>
      s.map((x) => (x.key === key ? { ...x, url: `https://youtu.be/${track.id}`, status: 'ok', track, results: undefined } : x)),
    );
  };

  const validate = (key: string, i: number, url: string) => {
    const id = parseYouTubeId(url);
    const update = (patch: Partial<Slot>) =>
      setSlots((s) => s.map((x) => (x.key === key && x.url === url ? { ...x, ...patch } : x)));
    if (!id) return update({ status: 'invalid', track: undefined });
    fetchTrackInfo(id)
      .then((track) => {
        update({ status: 'ok', track });
        haptic('tick');
      })
      .catch((e: Error) => {
        if (e.message === 'not-found') update({ status: 'notfound', track: undefined });
        // sem rede para o preview: aceita o link, título genérico
        else update({ status: 'ok', track: { id, title: `Faixa ${String(i + 1).padStart(2, '0')}`, author: 'YouTube' } });
      });
  };

  const addSlot = () => {
    if (slots.length >= MAX_TRACKS) return;
    haptic('key');
    setLink(null);
    setFocusRow(slots.length);
    setSlots((s) => [...s, newSlot()]);
  };

  const removeSlot = (i: number) => {
    if (slots.length <= MIN_TRACKS) return;
    haptic('key');
    setLink(null);
    const key = slots[i]?.key;
    if (key) window.clearTimeout(timers.current.get(key));
    setFocusRow(0);
    setSlots((s) => s.filter((_, j) => j !== i));
  };

  // arrastar para reordenar: troca a faixa de lugar com a vizinha
  const moveSlot = (from: number, to: number) => {
    if (to < 0 || to >= slots.length || from === to) return;
    setLink(null);
    setFocusRow(to);
    setSlots((s) => {
      const next = [...s];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const okCount = slots.filter((s) => s.status === 'ok').length;
  // link com erro ou ainda conferindo segura o passo; vaga vazia só é ignorada
  const pending = slots.some((s) => s.status === 'loading');
  const broken = slots.some((s) => s.status === 'invalid' || s.status === 'notfound');
  const tracksOk = okCount >= MIN_TRACKS && !pending && !broken;
  const canNext = step === 0 ? true : step === 1 ? tracksOk : true;
  const missing = MIN_TRACKS - okCount;
  const tracksCta =
    missing > 0 ? `Falta${missing > 1 ? 'm' : ''} ${missing} música${missing > 1 ? 's' : ''}` : pending ? 'Conferindo…' : 'Arruma o link com erro';

  const mix: Mixtape = useMemo(
    () => ({
      v: 1,
      mood,
      finish: finishId,
      title: title.trim() || 'Um mix pra você',
      from: from.trim(),
      to: to.trim(),
      note: note.trim(),
      tracks: slots.map((s) => s.track!).filter(Boolean),
    }),
    [mood, finishId, title, from, to, note, slots],
  );

  const generate = async () => {
    haptic('heavy');
    setLink(await shareUrl(mix));
    setCopied(false);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      haptic('key');
    } catch {
      window.prompt('Copia o link:', link);
    }
  };

  // ── visor de pré-visualização (muda conforme a etapa)
  const fakeT = (tick % 480) * 0.5;
  const firstTrack = slots.find((s) => s.track)?.track;
  let screen;
  const view = override ?? (step === 0 ? 'now' : step === 1 ? 'list' : 'note');
  if (link) screen = <ScreenSaved mood={mood} tick={tick} count={mix.tracks.length} />;
  else if (view === 'now')
    screen = (
      <ScreenNow
        mood={mood}
        tick={tick}
        playing={previewPlaying}
        track={firstTrack ?? { id: '', title: title || 'Seu mix', author: 'Faixa 01' }}
        index={0}
        total={Math.max(okCount, 1)}
        time={fakeT}
        duration={240}
        hasNote={!!note}
      />
    );
  else if (view === 'list')
    screen = (
      <ScreenList
        tracks={slots.map((s) => s.track ?? null)}
        cursor={focusRow}
        playingIndex={-1}
        playing={false}
        tick={tick}
        label={(title || 'LADO A').toUpperCase().slice(0, 18)}
      />
    );
  else screen = <ScreenNote to={to} from={from} note={note} scroll={Math.max(0, Math.ceil(note.length / 30) - 7)} />;

  const device = (
    <Device
      finish={finish}
      lit={lit}
      playing={previewPlaying}
      volume={vol}
      onVolume={setVol}
      onLight={setLit}
      onCenter={() => setPreviewPlaying((p) => !p)}
      onWheel={(z) => {
        // MENU passeia pelas telas do visor na pré-visualização; VOLTAR retorna à tela da etapa
        if (z === 'menu') {
          const order = ['now', 'list', 'note'] as const;
          return setOverride(order[(order.indexOf(view) + 1) % order.length]);
        }
        if (z === 'back') return setOverride(null);
        const i = MOOD_LIST.findIndex((m) => m.id === mood);
        const n = (i + (z === 'next' ? 1 : -1) + MOOD_LIST.length) % MOOD_LIST.length;
        if (step === 0) setMood(MOOD_LIST[n].id);
      }}
      onJog={(d) => {
        if (step === 0) {
          const i = MOOD_LIST.findIndex((m) => m.id === mood);
          setMood(MOOD_LIST[(i + d + MOOD_LIST.length) % MOOD_LIST.length].id);
        }
        if (step === 1) setFocusRow((r) => Math.max(0, Math.min(4, r + d)));
      }}
      screen={<LcdScreen lit={lit} oled={finish.oled}>{screen}</LcdScreen>}
    />
  );

  return (
    <div className="pp-root pp-stage" style={finishVars(finish)}>
      {/* tela de app: tudo cabe na altura da janela, sem rolar a página */}
      <div className="mx-auto flex h-[100dvh] max-w-[1080px] flex-col overflow-hidden lg:grid lg:grid-cols-[1fr_520px] lg:gap-16 lg:px-8">
        {/* aparelho: fica com a altura que sobra e encolhe pra caber */}
        <div className="flex min-h-0 flex-1 flex-col lg:h-[100dvh]">
          <header className="flex h-12 flex-none items-center justify-between px-5 lg:h-14 lg:px-0">
            {/* voltar do topo: só na primeira etapa (ou já gravado), volta pro mix de onde
                a pessoa veio pelo +, ou pra home. Do passo 2 em diante o voltar fica na barra de baixo. */}
            {(step === 0 || link) && (
              <a
                href="#/"
                className="pp-spec"
                style={{ color: 'var(--ink-2)' }}
                onClick={(e) => {
                  if (fromMix) {
                    e.preventDefault();
                    history.back();
                  }
                }}
              >
                ← Voltar
              </a>
            )}
          </header>
          <div className="pp-fit flex-1 pb-3 lg:pb-14">
            <div className="pp-cq">{device}</div>
          </div>
        </div>

        {/* folha do formulário */}
        <section className="pp-sheet relative z-10 flex min-h-0 flex-none flex-col px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-5 lg:max-h-[calc(100dvh-80px)] lg:self-center lg:px-8 lg:py-8">
          {/* se um dia não couber (teclado aberto, tela baixa), só o miolo da folha rola */}
          <div className="min-h-0 flex-1 overflow-y-auto">
          {/* depois de gravar, a folha fica só com o bloco de compartilhar */}
          {!link && (
            <>
              <div className="pp-steps">
                {[0, 1, 2].map((i) => (
                  <i key={i} className={i <= step ? 'on' : ''} />
                ))}
              </div>
              <p className="pp-spec pp-tall-only mt-4 lg:mt-5" style={{ color: 'var(--ink-3)' }}>
                Passo {step + 1} de 3
              </p>
              <h1 className="pp-step-title mt-1 text-[24px] font-medium tracking-[-0.02em] lg:text-[28px]">{STEP_TITLES[step]}</h1>
            </>
          )}

          <div key={step} className="pp-fade-in">
            {step === 0 && (
              <StepMood mood={mood} setMood={setMood} tick={tick} />
            )}
            {step === 1 && (
              <StepTracks
                slots={slots}
                setSlotUrl={setSlotUrl}
                searchSlot={searchSlot}
                pickResult={pickResult}
                onFocusRow={setFocusRow}
                addSlot={addSlot}
                removeSlot={removeSlot}
                moveSlot={moveSlot}
                okCount={okCount}
              />
            )}
            {step === 2 && (
              <StepNote
                title={title}
                setTitle={(v) => (setTitle(v), setLink(null))}
                from={from}
                setFrom={(v) => (setFrom(v), setLink(null))}
                to={to}
                setTo={(v) => (setTo(v), setLink(null))}
                note={note}
                setNote={(v) => (setNote(v), setLink(null))}
                link={link}
                generate={generate}
              />
            )}
          </div>

          </div>

          {/* barra de ação: sempre no pé da folha */}
          <div className="flex flex-none gap-3 pt-4 lg:pt-6">
            {step > 0 && !link && (
              <button className="pp-btn is-ghost" onClick={() => (haptic('key'), setStep((s) => s - 1))}>
                Voltar
              </button>
            )}
            {step < 2 && (
              <button className="pp-btn is-gel flex-1" disabled={!canNext} onClick={() => (haptic('key'), setStep((s) => s + 1))}>
                {step === 1 && !canNext ? tracksCta : 'Avançar'}
              </button>
            )}
            {step === 2 && !link && (
              <button className="pp-btn is-gel flex-1" onClick={generate}>
                Gravar mix
              </button>
            )}
            {step === 2 && link && (
              <>
                <a className="pp-btn is-ghost" href={link.slice(link.indexOf('#'))}>
                  Testar
                </a>
                <button className="pp-btn is-gel flex-1" onClick={copy}>
                  {copied ? 'Copiado. Agora manda.' : 'Copiar link'}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Etapa 1 ───────────────────────────────────────────────────────────────

function StepMood({ mood, setMood, tick }: { mood: MoodId; setMood: (m: MoodId) => void; tick: number }) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {MOOD_LIST.map((m) => {
          const on = m.id === mood;
          const f = FINISHES[m.finish];
          return (
            <button
              key={m.id}
              className={`pp-chip flex min-w-0 items-center gap-2.5 p-2 pr-2.5 lg:gap-3 lg:pr-3 ${on ? 'is-on' : ''}`}
              onClick={() => (haptic('key'), setMood(m.id))}
              aria-pressed={on}
            >
              {/* o visor já dentro do plástico daquele humor */}
              <div
                className="flex-none rounded-[10px] p-[3px] lg:rounded-[12px] lg:p-[4px]"
                style={{
                  background: f.body,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.3)',
                }}
              >
                <div
                  className="pp-cq w-[40px] overflow-hidden rounded-[7px] p-[3px] lg:w-[56px] lg:rounded-[8px] lg:p-1"
                  style={{ background: f.lcdBg, color: f.lcdInk, boxShadow: `0 0 0 2px ${f.bezel}` }}
                >
                  <MascotScene mood={m.id} tick={on ? tick : 0} playing={on} w={26} h={20} charX={3} ghost={0.06} />
                </div>
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium leading-tight lg:text-[16px]">{m.name}</div>
                <div className="pp-spec mt-0.5 truncate" style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                  {f.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Etapa 2 ───────────────────────────────────────────────────────────────

const MSG: Record<SlotStatus, string> = {
  empty: '',
  loading: 'Conferindo…',
  ok: '',
  invalid: 'Isso aí não é youtube não, hein',
  notfound: 'Esse vídeo sumiu ou é privado. Escolhe outro',
  query: 'Aperta Buscar pra achar no YouTube',
  searching: 'Buscando…',
  results: '',
  noresults: 'Não achei nada. Tenta outro nome',
  quota: 'A busca descansou por hoje. Cola o link do YouTube',
  searcherror: 'Não deu pra buscar agora. Cola o link do YouTube',
};

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

function StepTracks({
  slots,
  setSlotUrl,
  searchSlot,
  pickResult,
  onFocusRow,
  addSlot,
  removeSlot,
  moveSlot,
  okCount,
}: {
  slots: Slot[];
  setSlotUrl: (i: number, u: string) => void;
  searchSlot: (i: number) => void;
  pickResult: (i: number, t: Track) => void;
  onFocusRow: (i: number) => void;
  addSlot: () => void;
  removeSlot: (i: number) => void;
  moveSlot: (from: number, to: number) => void;
  okCount: number;
}) {
  const canRemove = slots.length > MIN_TRACKS;

  // Arrastar pela alça: o cartão segue o dedo e troca de lugar ao passar da metade do vizinho.
  const items = useRef(new Map<string, HTMLDivElement>());
  const order = useRef(slots);
  order.current = slots;
  const st = useRef({ key: '', startY: 0, id: -1 });
  const [drag, setDrag] = useState<{ key: string; dy: number } | null>(null);
  const GAP = 12;

  const onDown = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro já liberado */
    }
    st.current = { key, startY: e.clientY, id: e.pointerId };
    setDrag({ key, dy: 0 });
    haptic('key');
  };
  const onMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.key || e.pointerId !== s.id) return;
    let dy = e.clientY - s.startY;
    const list = order.current;
    const i = list.findIndex((x) => x.key === s.key);
    const h = (k?: string) => (k ? (items.current.get(k)?.getBoundingClientRect().height ?? 0) + GAP : 0);
    const below = h(list[i + 1]?.key);
    const above = h(list[i - 1]?.key);
    if (below && dy > below / 2) {
      moveSlot(i, i + 1);
      order.current = [...list.slice(0, i), list[i + 1], list[i], ...list.slice(i + 2)];
      s.startY += below;
      dy -= below;
      haptic('tick');
    } else if (above && dy < -above / 2) {
      moveSlot(i, i - 1);
      order.current = [...list.slice(0, i - 1), list[i], list[i - 1], ...list.slice(i + 1)];
      s.startY -= above;
      dy += above;
      haptic('tick');
    }
    setDrag({ key: s.key, dy });
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== st.current.id) return;
    st.current = { key: '', startY: 0, id: -1 };
    setDrag(null);
  };
  return (
    <>
      <div className="mt-4 flex flex-col gap-2">
        {slots.map((s, i) => (
          <div
            key={s.key}
            ref={(el) => {
              if (el) items.current.set(s.key, el);
              else items.current.delete(s.key);
            }}
            className="pp-track relative rounded-[16px] p-2.5"
            style={{
              background: 'var(--paper-2)',
              boxShadow: drag?.key === s.key ? 'inset 0 0 0 1.5px var(--ink-3)' : 'inset 0 0 0 1px var(--line)',
              transform: drag?.key === s.key ? `translateY(${drag.dy}px) scale(1.02)` : undefined,
              zIndex: drag?.key === s.key ? 5 : undefined,
              transition: drag?.key === s.key ? 'box-shadow 120ms' : 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="pp-drag flex h-10 w-6 flex-none items-center justify-center"
                style={{ color: 'var(--ink-3)', cursor: drag?.key === s.key ? 'grabbing' : 'grab' }}
                aria-label={`Mover faixa ${i + 1} (setas para cima e para baixo)`}
                onPointerDown={(e) => onDown(e, s.key)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') (e.preventDefault(), moveSlot(i, i - 1));
                  if (e.key === 'ArrowDown') (e.preventDefault(), moveSlot(i, i + 1));
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <rect x="2" y="4" width="12" height="1.6" rx="0.8" />
                  <rect x="2" y="7.2" width="12" height="1.6" rx="0.8" />
                  <rect x="2" y="10.4" width="12" height="1.6" rx="0.8" />
                </svg>
              </button>
              {s.status === 'ok' && s.track ? (
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <img src={thumb(s.track.id)} alt="" className="h-9 w-12 flex-none rounded-[6px] object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium leading-tight">{s.track.title}</div>
                    <div className="truncate text-[12px]" style={{ color: 'var(--ink-3)' }}>
                      {s.track.author}
                    </div>
                  </div>
                </div>
              ) : (
              // um campo só: link do YouTube ou o nome da música (a lupa avisa que dá pra buscar)
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-3)' }}>
                  <IconSearch />
                </span>
                <input
                  className="pp-field pp-search !py-2.5 !pl-9 !pr-3"
                  inputMode="text"
                  enterKeyHint="search"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Buscar ou colar link do YouTube"
                  value={s.url}
                  onFocus={() => onFocusRow(i)}
                  onChange={(e) => setSlotUrl(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && SEARCHING.includes(s.status)) {
                      e.preventDefault();
                      searchSlot(i);
                    }
                  }}
                  aria-label={`Faixa ${i + 1}: nome da música ou link do YouTube`}
                />
              </div>
              )}
              {SEARCHING.includes(s.status) ? (
                <button
                  className="pp-spec h-10 flex-none rounded-full px-3"
                  style={{ color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
                  disabled={s.status === 'searching'}
                  onClick={() => searchSlot(i)}
                >
                  Buscar
                </button>
              ) : (
                s.url && (
                  <button className="pp-spec h-10 flex-none rounded-full px-3" style={{ color: 'var(--ink-2)' }} onClick={() => setSlotUrl(i, '')}>
                    Limpar
                  </button>
                )
              )}
            </div>
            {s.status === 'results' && s.results ? (
              // resultados da busca: um toque escolhe a música
              <div className="pp-fade-in mt-2 flex flex-col gap-0.5 pl-[26px]">
                {s.results.map((r) => (
                  <button
                    key={r.id}
                    className="pp-result flex min-w-0 items-center gap-2.5 rounded-[10px] p-1.5 text-left"
                    onClick={() => pickResult(i, r)}
                  >
                    <img src={thumb(r.id)} alt="" className="h-9 w-12 flex-none rounded-[6px] object-cover" loading="lazy" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium leading-tight">{r.title}</span>
                      <span className="block truncate text-[12px]" style={{ color: 'var(--ink-3)' }}>
                        {r.author}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              MSG[s.status] && (
                <div
                  className="mt-1.5 pl-8 text-[13px] leading-[18px]"
                  style={{ color: s.status === 'invalid' || s.status === 'notfound' ? '#d8352a' : 'var(--ink-3)' }}
                >
                  {MSG[s.status]}
                </div>
              )
            )}
            {s.status === 'empty' && canRemove && (
              // faixa extra vazia: o Tirar fica embaixo pra não apertar o campo
              <div className="mt-1 flex justify-end">
                <button
                  className="pp-spec h-8 rounded-full px-3"
                  style={{ color: 'var(--ink-2)' }}
                  onClick={() => removeSlot(i)}
                  aria-label={`Remover faixa ${i + 1}`}
                >
                  Tirar
                </button>
              </div>
            )}
          </div>
        ))}
        {slots.length < MAX_TRACKS && (
          <button
            className="pp-chip flex h-11 flex-none items-center justify-center gap-2 text-[15px] font-medium"
            style={{ color: 'var(--ink-2)', textAlign: 'center' }}
            onClick={addSlot}
          >
            + Mais uma ({slots.length}/{MAX_TRACKS})
          </button>
        )}
      </div>
      <div className="pp-tall-only mt-3 flex items-center justify-between">
        <span className="pp-spec" style={{ color: 'var(--ink-3)' }}>
          {okCount} pronta{okCount === 1 ? '' : 's'}
        </span>
      </div>
    </>
  );
}

// ─── Etapa 3 ───────────────────────────────────────────────────────────────

function IconShare() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.97L2 22l5.17-1.5A9.94 9.94 0 1 0 12.04 2zm0 18.1a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.07.9.92-2.99-.2-.31a8.17 8.17 0 1 1 6.83 3.73zm4.49-6.12c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.79.97-.14.16-.29.18-.54.06a6.7 6.7 0 0 1-1.97-1.22 7.4 7.4 0 0 1-1.37-1.7c-.14-.25 0-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.66.31 2.8 2.8 0 0 0-.87 2.07c0 1.22.89 2.4 1.01 2.57.12.16 1.75 2.67 4.24 3.75.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.29z" />
    </svg>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span className="pp-spec" style={{ color: n > max * 0.9 ? 'var(--signal)' : 'var(--ink-3)', fontSize: 10 }}>
      {n}/{max}
    </span>
  );
}

function StepNote(p: {
  title: string;
  setTitle: (v: string) => void;
  from: string;
  setFrom: (v: string) => void;
  to: string;
  setTo: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  link: string | null;
  generate: () => void;
}) {
  // compartilhar do sistema só no celular; no computador ficam WhatsApp + copiar link
  const canShare =
    typeof navigator !== 'undefined' && !!navigator.share && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  return (
    <>
      {!p.link && (
      <div className="mt-4 flex flex-col gap-3 lg:mt-5 lg:gap-4">
        <label className="block">
          <div className="mb-1.5 flex justify-between text-[14px] font-medium">
            Nome do mix <Counter n={p.title.length} max={LIMITS.title} />
          </div>
          <input
            className="pp-field"
            maxLength={LIMITS.title}
            placeholder="Lado A pra você"
            value={p.title}
            onChange={(e) => p.setTitle(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="mb-1.5 text-[14px] font-medium">De</div>
            <input className="pp-field" maxLength={LIMITS.from} placeholder="Seu nome" value={p.from} onChange={(e) => p.setFrom(e.target.value)} />
          </label>
          <label className="block">
            <div className="mb-1.5 text-[14px] font-medium">Pra</div>
            <input className="pp-field" maxLength={LIMITS.to} placeholder="Nome de quem recebe" value={p.to} onChange={(e) => p.setTo(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <div className="mb-1.5 flex justify-between text-[14px] font-medium">
            Recado <Counter n={p.note.length} max={LIMITS.note} />
          </div>
          <textarea
            className="pp-field min-h-[96px] resize-none leading-[1.45] lg:min-h-[132px]"
            maxLength={LIMITS.note}
            placeholder="Escreve do coração (ou do jeito que der)."
            value={p.note}
            onChange={(e) => p.setNote(e.target.value)}
          />
        </label>
      </div>
      )}

      {p.link && (
        <div
          id="pp-result"
          className="pp-fade-in rounded-[18px] p-4" style={{ background: 'var(--paper-2)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-medium">Tá gravado. Agora é com você.</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div
              className="pp-spec min-w-0 flex-1 truncate rounded-[10px] px-3 py-2.5 normal-case"
              style={{ background: 'var(--paper)', boxShadow: 'inset 0 0 0 1px var(--line)', letterSpacing: 0 }}
            >
              {p.link}
            </div>
            {canShare && (
              <button
                className="pp-btn is-ghost !h-11 !w-11 flex-none !p-0"
                aria-label="Compartilhar"
                title="Compartilhar"
                onClick={() => navigator.share({ title: p.title || 'Um mix pra você', url: p.link! }).catch(() => {})}
              >
                <IconShare />
              </button>
            )}
            <a
              className="pp-btn is-ghost !h-11 !w-11 flex-none !p-0"
              aria-label="Mandar no WhatsApp"
              title="Mandar no WhatsApp"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(p.link)}`}
            >
              <IconWhatsApp />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
