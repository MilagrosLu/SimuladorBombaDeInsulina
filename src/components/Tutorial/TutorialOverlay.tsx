// ============================================================
// TUTORIAL OVERLAY – Componente reutilizable
// Patrón: 4 bandas rodean el elemento resaltado + tooltip card.
// Sin backdrop-filter para máximo rendimiento.
// ============================================================
import { memo, useEffect, useRef, useState, useCallback } from 'react';
import type { TutorialStep } from './tutorialSteps';

const CARD_W   = 360;
const SP_PAD   = 8;   // padding extra alrededor del elemento
const GAP      = 14;  // distancia entre spotlight y card
const MARGIN   = 12;  // margen mínimo de la card respecto al viewport

interface Rect { top: number; left: number; width: number; height: number; }

// ── Computa el estilo de posición de la card ────────────────
function cardStyle(r: Rect | null, pos: TutorialStep['position']): React.CSSProperties {
  const base: React.CSSProperties = { position: 'fixed', width: CARD_W };
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!r || pos === 'center') {
    return { ...base, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }

  const clampL = (l: number) => Math.max(MARGIN, Math.min(l, vw - CARD_W - MARGIN));
  const clampT = (t: number) => Math.max(MARGIN, Math.min(t, vh - MARGIN - 260));
  const cx = r.left + r.width / 2;
  const cy = r.top  + r.height / 2;

  switch (pos) {
    case 'bottom': return { ...base, top: clampT(r.top + r.height + SP_PAD + GAP), left: clampL(cx - CARD_W / 2) };
    case 'top':    return { ...base, top: clampT(r.top - SP_PAD - GAP - 240),       left: clampL(cx - CARD_W / 2) };
    case 'right': {
      const l = r.left + r.width + SP_PAD + GAP;
      return { ...base, top: clampT(cy - 120), left: l + CARD_W > vw - MARGIN ? clampL(r.left - SP_PAD - GAP - CARD_W) : clampL(l) };
    }
    case 'left': {
      const l = r.left - SP_PAD - GAP - CARD_W;
      return { ...base, top: clampT(cy - 120), left: l < MARGIN ? clampL(r.left + r.width + SP_PAD + GAP) : clampL(l) };
    }
    default: return { ...base, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onExit: () => void;
}

// ── Componente principal ─────────────────────────────────────
export const TutorialOverlay = memo(function TutorialOverlay({
  step, stepIndex, totalSteps, onNext, onPrev, onSkip, onExit,
}: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number>(0);
  const isLast = stepIndex === totalSteps - 1;

  // Busca el elemento, hace scroll hacia él y calcula su rect
  const updateRect = useCallback(() => {
    if (!step.target) { setRect(null); return; }
    const el = document.querySelector(step.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step.target]);

  // Al cambiar de paso: scroll + cálculo de rect
  useEffect(() => {
    if (step.target) {
      const el = document.querySelector(step.target);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    // Pequeño delay para que el scroll termine antes de medir
    const t = setTimeout(() => {
      updateRect();
    }, step.target ? 350 : 0);
    return () => clearTimeout(t);
  }, [step.target, updateRect]);

  // Actualiza rect en resize (con throttle via rAF)
  useEffect(() => {
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateRect);
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateRect]);

  // Teclas Escape / →Siguiente / ←Anterior
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onExit();
      if (e.key === 'ArrowRight')  isLast ? onExit() : onNext();
      if (e.key === 'ArrowLeft' && stepIndex > 0) onPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit, onNext, onPrev, isLast, stepIndex]);

  // Spotlight: rect expandido con SP_PAD
  const sp: Rect | null = rect
    ? {
        top:    rect.top    - SP_PAD,
        left:   rect.left   - SP_PAD,
        width:  rect.width  + SP_PAD * 2,
        height: rect.height + SP_PAD * 2,
      }
    : null;

  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  // 4 bandas oscuras que rodean el spotlight (o cubren todo si no hay target)
  const bands = sp
    ? [
        // top
        { top: 0, left: 0, width: vw, height: Math.max(0, sp.top) },
        // bottom
        { top: Math.max(0, sp.top + sp.height), left: 0, width: vw, height: Math.max(0, vh - (sp.top + sp.height)) },
        // left
        { top: Math.max(0, sp.top), left: 0, width: Math.max(0, sp.left), height: Math.max(0, sp.height) },
        // right
        { top: Math.max(0, sp.top), left: Math.max(0, sp.left + sp.width), width: Math.max(0, vw - (sp.left + sp.width)), height: Math.max(0, sp.height) },
      ]
    : [{ top: 0, left: 0, width: vw, height: vh }];

  const tCardStyle = cardStyle(sp, step.position);
  const pct = ((stepIndex + 1) / totalSteps) * 100;

  return (
    <>
      {/* ── 4 bandas de overlay oscuro ── */}
      {bands.map((b, i) => (
        <div
          key={i}
          className="tut-band"
          style={{ top: b.top, left: b.left, width: b.width, height: b.height }}
        />
      ))}

      {/* ── Borde luminoso sobre el elemento ── */}
      {sp && (
        <div
          className="tut-spotlight-border"
          style={{ top: sp.top, left: sp.left, width: sp.width, height: sp.height }}
        />
      )}

      {/* ── Tarjeta del tutorial ── */}
      <div className="tut-card" style={tCardStyle} key={step.id}>
        <div className="tut-card-header">
          <span className="tut-step-badge">{stepIndex + 1} / {totalSteps}</span>
          <button className="tut-btn tut-btn-exit" onClick={onExit}>✕ Salir</button>
        </div>

        {/* Barra de progreso */}
        <div className="tut-progress-bar">
          <div className="tut-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        <div className="tut-card-body">
          <div className="tut-title">{step.title}</div>
          <div className="tut-content">{step.content}</div>
        </div>

        <div className="tut-card-footer">

          {/* Navegación */}
          {stepIndex > 0 && (
            <button className="tut-btn tut-btn-ghost" onClick={onPrev}>
              ← Anterior
            </button>
          )}

          {isLast ? (
            <button className="tut-btn tut-btn-primary" onClick={onExit}>
              Finalizar ✓
            </button>
          ) : (
            <button className="tut-btn tut-btn-primary" onClick={onNext}>
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </>
  );
});
