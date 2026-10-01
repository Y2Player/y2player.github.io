import { useEffect, useMemo, useRef, useState } from 'react';
import { Device } from '../components/Hardware';
import { LcdScreen, MascotScene, ScreenList, ScreenNote, ScreenNow, ScreenSaved } from '../components/Lcd';
import { useTicker } from '../hooks/useTicker';
import { haptic } from '../lib/haptics';
import {
  fetchTrackInfo,
  LIMITS,
  parseYouTubeId,
  shareUrl,
  thumb,
  MAX_TRACKS,
  MIN_TRACKS,
  type Mixtape,
  type Track,
} from '../lib/mixtape';
import { FINISHES, MOOD_LIST, finishForMood, finishVars, type MoodId } from '../tokens';

type SlotStatus = 'empty' | 'loading' | 'ok' | 'invalid' | 'notfound';
interface Slot {
  url: string;
  status: SlotStatus;
  track?: Track;
}

const STEP_TITLES = ['Qual bichinho vai junto?', 'Escolhe pelo menos 2 músicas.', 'Agora o bilhete'];

export function CreateWizard() {
  const tick = useTicker();
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<MoodId>('groovy');
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: MIN_TRACKS }, () => ({ url: '', status: 'empty' })));
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
  const timers = useRef<number[]>([]);
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
    setLink(null);
    setSlots((s) => s.map((x, j) => (j === i ? { url, status: url.trim() ? 'loading' : 'empty' } : x)));
    window.clearTimeout(timers.current[i]);
    if (!url.trim()) return;
    timers.current[i] = window.setTimeout(() => validate(i, url), 350);
  };

  const validate = (i: number, url: string) => {
    const id = parseYouTubeId(url);
    const update = (patch: Partial<Slot>) =>
      setSlots((s) => s.map((x, j) => (j === i && x.url === url ? { ...x, ...patch } : x)));
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
    setSlots((s) => [...s, { url: '', status: 'empty' }]);
  };

  const removeSlot = (i: number) => {
    if (slots.length <= MIN_TRACKS) return;
    haptic('key');
    setLink(null);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setFocusRow(0);
    setSlots((s) => s.filter((_, j) => j !== i));
  };

  const paste = async (i: number) => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) setSlotUrl(i, txt);
    } catch {
      /* permissão negada: usuário cola manualmente */
    }
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
      <div className="mx-auto max-w-[1080px] lg:grid lg:min-h-[100dvh] lg:grid-cols-[1fr_520px] lg:items-start lg:gap-16 lg:px-8">
        {/* aparelho */}
        <div className="lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col">
          <header className="flex h-14 items-center justify-between px-5 lg:px-0">
            <a href="#/" className="pp-spec" style={{ color: 'var(--ink-2)' }}>
              ← Voltar
            </a>
          </header>
          <div className="relative flex justify-center overflow-hidden lg:flex-1 lg:items-center lg:overflow-visible pp-peek">
            <div className="pp-cq pt-2 lg:pt-0" style={{ width: 'min(calc(100vw - 88px), 380px)' }}>
              {device}
            </div>
          </div>
        </div>

        {/* folha do formulário */}
        <section
          className={`pp-sheet relative z-10 -mt-6 px-5 pb-[calc(96px+env(safe-area-inset-bottom))] pt-6 lg:px-8 lg:pb-8 ${
            // gravada: o bloco de compartilhar fica centralizado na altura, alinhado ao aparelho
            link ? 'lg:mb-0 lg:mt-14 lg:self-center' : 'lg:my-10 lg:mt-14'
          }`}
        >
          {/* depois de gravar, a folha fica só com o bloco de compartilhar */}
          {!link && (
            <>
              <div className="pp-steps">
                {[0, 1, 2].map((i) => (
                  <i key={i} className={i <= step ? 'on' : ''} />
                ))}
              </div>
              <p className="pp-spec mt-5" style={{ color: 'var(--ink-3)' }}>
                Passo {step + 1} de 3
              </p>
              <h1 className="mt-1 text-[28px] font-medium tracking-[-0.02em]">{STEP_TITLES[step]}</h1>
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
                onFocusRow={setFocusRow}
                paste={paste}
                addSlot={addSlot}
                removeSlot={removeSlot}
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

          {/* barra de ação */}
          <div
            className="fixed inset-x-0 bottom-0 z-20 flex gap-3 px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-8 lg:p-0"
            style={{ background: 'linear-gradient(to top, var(--paper) 70%, transparent)' }}
          >
            {step > 0 && !link && (
              <button className="pp-btn is-ghost" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </button>
            )}
            {step < 2 && (
              <button className="pp-btn flex-1" disabled={!canNext} onClick={() => (haptic('key'), setStep((s) => s + 1))}>
                {step === 1 && !canNext ? tracksCta : 'Avançar'}
              </button>
            )}
            {step === 2 && !link && (
              <button className="pp-btn is-signal flex-1" onClick={generate}>
                Gravar mix
              </button>
            )}
            {step === 2 && link && (
              <>
                <a className="pp-btn is-ghost" href={link.slice(link.indexOf('#'))}>
                  Testar
                </a>
                <button className="pp-btn is-signal flex-1" onClick={copy}>
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
      <div className="mt-5 flex flex-col gap-2">
        {MOOD_LIST.map((m) => {
          const on = m.id === mood;
          const f = FINISHES[m.finish];
          return (
            <button
              key={m.id}
              className={`pp-chip flex items-center gap-4 p-2.5 pr-4 ${on ? 'is-on' : ''}`}
              onClick={() => (haptic('key'), setMood(m.id))}
              aria-pressed={on}
            >
              {/* o visor já dentro do plástico daquele humor */}
              <div
                className="flex-none rounded-[14px] p-[5px]"
                style={{
                  background: f.body,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.3)',
                }}
              >
                <div
                  className="pp-cq w-[72px] overflow-hidden rounded-[9px] p-1.5"
                  style={{ background: f.lcdBg, color: f.lcdInk, boxShadow: `0 0 0 2px ${f.bezel}` }}
                >
                  <MascotScene mood={m.id} tick={on ? tick : 0} playing={on} w={26} h={20} charX={3} ghost={0.06} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[17px] font-medium">{m.name}</span>
                  <span className="pp-spec" style={{ color: 'var(--ink-3)', fontSize: 10 }}>
                    {f.name}
                  </span>
                </div>
                <div className="mt-0.5 text-[14px] leading-snug" style={{ color: 'var(--ink-2)' }}>
                  {m.line}
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
  empty: 'Esperando um link…',
  loading: 'Conferindo…',
  ok: '',
  invalid: 'Isso aí não é youtube não, hein',
  notfound: 'Esse vídeo sumiu ou é privado. Escolhe outro',
};

function StepTracks({
  slots,
  setSlotUrl,
  onFocusRow,
  paste,
  addSlot,
  removeSlot,
  okCount,
}: {
  slots: Slot[];
  setSlotUrl: (i: number, u: string) => void;
  onFocusRow: (i: number) => void;
  paste: (i: number) => void;
  addSlot: () => void;
  removeSlot: (i: number) => void;
  okCount: number;
}) {
  const canRemove = slots.length > MIN_TRACKS;
  return (
    <>
      <p className="mt-2 text-[15px] leading-[1.5]" style={{ color: 'var(--ink-2)' }}>
        Cola os links do youtube.
      </p>
      <div className="mt-5 flex flex-col gap-3">
        {slots.map((s, i) => (
          <div key={i} className="rounded-[16px] p-3" style={{ background: 'var(--paper-2)', boxShadow: 'inset 0 0 0 1px var(--line)' }}>
            <div className="flex items-center gap-2">
              <span className="pp-spec w-6 flex-none text-center" style={{ color: 'var(--ink-3)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <input
                className="pp-field min-w-0 flex-1 !py-2.5"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="youtube.com/watch?v=…"
                value={s.url}
                onFocus={() => onFocusRow(i)}
                onChange={(e) => setSlotUrl(i, e.target.value)}
                aria-label={`Link da faixa ${i + 1}`}
              />
              {s.url ? (
                <button className="pp-spec h-10 flex-none rounded-full px-3" style={{ color: 'var(--ink-2)' }} onClick={() => setSlotUrl(i, '')}>
                  Limpar
                </button>
              ) : canRemove ? (
                <button
                  className="pp-spec h-10 flex-none rounded-full px-3"
                  style={{ color: 'var(--ink-2)' }}
                  onClick={() => removeSlot(i)}
                  aria-label={`Remover faixa ${i + 1}`}
                >
                  Tirar
                </button>
              ) : (
                <button
                  className="pp-spec h-10 flex-none rounded-full px-3"
                  style={{ color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line)' }}
                  onClick={() => paste(i)}
                >
                  Colar
                </button>
              )}
            </div>
            <div className="mt-2 flex min-h-[36px] items-center gap-3 pl-8">
              <span className={`pp-status-led ${s.status === 'ok' ? 'ok' : s.status === 'loading' ? 'load' : s.status === 'empty' ? '' : 'err'}`} />
              {s.status === 'ok' && s.track ? (
                <>
                  <img src={thumb(s.track.id)} alt="" className="h-9 w-12 flex-none rounded-[6px] object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium leading-tight">{s.track.title}</div>
                    <div className="truncate text-[12px]" style={{ color: 'var(--ink-3)' }}>
                      {s.track.author}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-[13px]" style={{ color: s.status === 'invalid' || s.status === 'notfound' ? '#d8352a' : 'var(--ink-3)' }}>
                  {MSG[s.status]}
                </span>
              )}
            </div>
          </div>
        ))}
        {slots.length < MAX_TRACKS && (
          <button
            className="pp-chip flex h-12 items-center justify-center gap-2 text-[15px] font-medium"
            style={{ color: 'var(--ink-2)', textAlign: 'center' }}
            onClick={addSlot}
          >
            + Mais uma ({slots.length}/{MAX_TRACKS})
          </button>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
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
      <div className="mt-5 flex flex-col gap-4">
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
            Bilhete <Counter n={p.note.length} max={LIMITS.note} />
          </div>
          <textarea
            className="pp-field min-h-[132px] resize-none leading-[1.45]"
            maxLength={LIMITS.note}
            placeholder="Escreve do coração (ou do jeito que der). Aparece no visor quando apertarem MENU."
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
            <span className="pp-status-led ok" />
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
