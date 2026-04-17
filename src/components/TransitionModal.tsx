import { useState, useEffect, type CSSProperties } from 'react';
import { FadeType } from '../../types/Fade';
import type { FadeType as FadeTypeValue } from '../../types/Fade';
import { curvePath, FADE_OUT_COLOR, FADE_IN_COLOR } from './fadeCurves';
import '../styles/transition-modal.css';

interface TransitionModalProps {
  fromTitle: string;
  toTitle: string;
  currentDuration: number;
  currentFadeOutType: FadeTypeValue;
  currentFadeInType: FadeTypeValue;
  maxDuration: number;
  hasExistingTransition: boolean;
  onApply: (duration: number, fadeOutType: FadeTypeValue, fadeInType: FadeTypeValue) => void;
  onRemove: () => void;
  onClose: () => void;
}

const FADE_OPTIONS: { value: FadeTypeValue; label: string; description: string }[] = [
  { value: FadeType.NONE, label: 'None', description: 'Clips overlap, no gain curve' },
  { value: FadeType.LINEAR, label: 'Linear', description: 'Constant-rate crossfade' },
  { value: FadeType.EXPONENTIAL, label: 'Exponential', description: 'Fast attack, slow tail' },
  {
    value: FadeType.EQUAL_POWER,
    label: 'Equal Power',
    description: 'Natural-sounding, no volume dip',
  },
];

// ---- SVG components ----

function MiniCurveIcon({ type }: { type: FadeTypeValue }) {
  const w = 48,
    h = 26,
    pad = 3,
    steps = 40;

  if (type === FadeType.NONE) {
    const overlapStart = w / 3;
    const overlapEnd = (w * 2) / 3;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="fade-mini-icon" aria-hidden="true">
        <path
          d={`M 0,${pad} H ${overlapEnd}`}
          stroke={FADE_OUT_COLOR}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M ${overlapStart},${pad} H ${w}`}
          stroke={FADE_IN_COLOR}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const outPath = curvePath(type, w, h, false, pad, steps);
  const inPath = curvePath(type, w, h, true, pad, steps);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="fade-mini-icon" aria-hidden="true">
      <path
        d={outPath}
        stroke={FADE_OUT_COLOR}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d={inPath} stroke={FADE_IN_COLOR} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function CrossfadePreview({ type }: { type: FadeTypeValue }) {
  const w = 280,
    h = 70,
    pad = 6,
    steps = 60;

  if (type === FadeType.NONE) {
    const overlapStart = w / 3;
    const overlapEnd = (w * 2) / 3;
    const lineY = pad + 8;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="fade-crossfade-preview" aria-hidden="true">
        <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.2)" rx="6" />
        <rect
          x={pad}
          y={pad}
          width={overlapEnd - pad}
          height={h - 2 * pad}
          fill="rgba(245,168,52,0.12)"
          rx="3"
        />
        <rect
          x={overlapStart}
          y={pad}
          width={w - overlapStart - pad}
          height={h - 2 * pad}
          fill="rgba(77,224,192,0.1)"
          rx="3"
        />
        <rect
          x={overlapStart}
          y={pad}
          width={overlapEnd - overlapStart}
          height={h - 2 * pad}
          fill="rgba(180,255,220,0.07)"
          rx="3"
        />
        <path
          d={`M ${pad + 2},${lineY} H ${overlapEnd}`}
          stroke={FADE_OUT_COLOR}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M ${overlapStart},${lineY} H ${w - pad - 2}`}
          stroke={FADE_IN_COLOR}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <text x={pad + 8} y={h - pad - 4} fill={FADE_OUT_COLOR} fontSize="10" opacity="0.7">
          A
        </text>
        <text x={w - pad - 14} y={h - pad - 4} fill={FADE_IN_COLOR} fontSize="10" opacity="0.7">
          B
        </text>
      </svg>
    );
  }

  const outFull = curvePath(type, w, h, false, pad, steps);
  const inFull = curvePath(type, w, h, true, pad, steps);
  const aFill = `${outFull} L ${w},${h - pad} L 0,${h - pad} Z`;
  const bFill = `${inFull} L ${w},${h - pad} L 0,${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="fade-crossfade-preview" aria-hidden="true">
      <rect x={0} y={0} width={w} height={h} fill="rgba(0,0,0,0.2)" rx="6" />
      <path d={aFill} fill="rgba(245,168,52,0.15)" />
      <path d={bFill} fill="rgba(77,224,192,0.12)" />
      <path d={outFull} stroke={FADE_OUT_COLOR} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={inFull} stroke={FADE_IN_COLOR} strokeWidth="2" fill="none" strokeLinecap="round" />
      <text x={pad + 8} y={pad + 14} fill={FADE_OUT_COLOR} fontSize="10" opacity="0.7">
        A
      </text>
      <text x={w - pad - 14} y={h - pad - 4} fill={FADE_IN_COLOR} fontSize="10" opacity="0.7">
        B
      </text>
    </svg>
  );
}

export default function TransitionModal({
  fromTitle,
  toTitle,
  currentDuration,
  currentFadeOutType,
  maxDuration,
  hasExistingTransition,
  onApply,
  onRemove,
  onClose,
}: TransitionModalProps) {
  const [fadeType, setFadeType] = useState<FadeTypeValue>(currentFadeOutType);
  const [duration, setDuration] = useState(currentDuration);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleApply = () => {
    onApply(duration, fadeType, fadeType);
  };

  const clampedMax = Math.max(maxDuration, 0.5);
  const durationPercent = ((duration - 0.5) / (clampedMax - 0.5)) * 100;

  return (
    <div className="transition-modal-backdrop" onClick={handleBackdropClick}>
      <div className="transition-modal">
        <div className="transition-modal-header">
          <h2 className="transition-modal-title">Transition</h2>
          <button
            className="transition-modal-close"
            onClick={onClose}
            title="Close"
            aria-label="Close transition modal"
          >
            ✕
          </button>
        </div>

        <div className="transition-modal-content">
          <div className="transition-modal-songs">
            <span className="transition-modal-song-name">{fromTitle}</span>
            <span className="transition-modal-arrow">→</span>
            <span className="transition-modal-song-name">{toTitle}</span>
          </div>

          <section className="transition-section">
            <h3 className="transition-section-title">Transition Type</h3>
            <div className="transition-type-grid">
              {FADE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`transition-type-card${fadeType === opt.value ? ' selected' : ''}`}
                  onClick={() => setFadeType(opt.value)}
                >
                  <MiniCurveIcon type={opt.value} />
                  <span className="transition-type-label">{opt.label}</span>
                  <span className="transition-type-desc">{opt.description}</span>
                </button>
              ))}
            </div>
            <CrossfadePreview type={fadeType} />
          </section>

          <section className="transition-section">
            <h3 className="transition-section-title">
              Duration
              <span className="transition-duration-value">{duration.toFixed(1)}s</span>
            </h3>
            <input
              className="transition-duration-slider"
              type="range"
              min={0.5}
              max={clampedMax}
              step={0.1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              aria-label="Transition duration"
              style={{ '--duration-percent': `${durationPercent}%` } as CSSProperties}
            />
            <div className="transition-duration-labels">
              <span>0.5s</span>
              <span>{clampedMax.toFixed(1)}s</span>
            </div>
          </section>
        </div>

        <div className="transition-modal-footer">
          {hasExistingTransition && (
            <button className="transition-modal-btn-remove" onClick={onRemove}>
              Remove
            </button>
          )}
          <button className="transition-modal-btn-apply" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
