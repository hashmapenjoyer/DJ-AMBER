import { useState, useEffect, type CSSProperties } from 'react';
import { FadeType } from '../../types/Fade';
import type { FadeType as FadeTypeValue } from '../../types/Fade';
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
  { value: FadeType.NONE, label: 'None', description: 'Hard cut, no crossfade' },
  { value: FadeType.LINEAR, label: 'Linear', description: 'Constant-rate crossfade' },
  { value: FadeType.EXPONENTIAL, label: 'Exponential', description: 'Fast attack, slow tail' },
  {
    value: FadeType.EQUAL_POWER,
    label: 'Equal Power',
    description: 'Natural-sounding, no volume dip',
  },
];

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
                  <span className="transition-type-label">{opt.label}</span>
                  <span className="transition-type-desc">{opt.description}</span>
                </button>
              ))}
            </div>
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
