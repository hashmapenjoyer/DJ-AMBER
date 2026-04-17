import { FadeType } from '../../types/Fade';
import type { FadeType as FadeTypeValue } from '../../types/Fade';

export const FADE_OUT_COLOR = '#f5a834';
export const FADE_IN_COLOR = '#4de0c0';

export function fadeGain(type: FadeTypeValue, t: number): number {
  switch (type) {
    case FadeType.LINEAR:
      return 1 - t;
    case FadeType.EXPONENTIAL:
      return Math.pow(1 - t, 2);
    case FadeType.EQUAL_POWER:
      return Math.cos((t * Math.PI) / 2);
    default: // NONE
      return 1;
  }
}

export function curvePath(
  type: FadeTypeValue,
  w: number,
  h: number,
  invert: boolean,
  pad: number,
  steps: number,
): string {
  const inner = h - 2 * pad;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const g = invert ? fadeGain(type, 1 - t) : fadeGain(type, t);
    const x = (t * w).toFixed(1);
    const y = (pad + (1 - g) * inner).toFixed(1);
    return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(' ');
}
