import { useEffect, useRef } from 'react';
import { useAudioEngine } from '../../audio/UseAudioEngine';

interface ClipWaveformProps {
  bufferId: string;
  /** seconds into the source buffer where this clip's playback starts */
  bufferOffset: number;
  /** how many seconds of the buffer this clip actually plays */
  playDuration: number;
  widthPx: number;
  heightPx: number;
  color: string;
}

/**
 * canvas-backed waveform that reads pre-computed peaks from engine.waveforms.
 * redraw cost is O(widthPx) regardless of clip length or zoom level.
 * mipmap level is chosen by WaveformCache to match the requested bucket count.
 */
export default function ClipWaveform({
  bufferId,
  bufferOffset,
  playDuration,
  widthPx,
  heightPx,
  color,
}: ClipWaveformProps) {
  const { engine } = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || widthPx <= 0 || heightPx <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(widthPx * dpr));
    canvas.height = Math.max(1, Math.floor(heightPx * dpr));
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const slice = engine.waveforms.get(bufferId, Math.ceil(widthPx));
    if (!slice) return;

    const { peaks, samplesPerBucket, sampleRate } = slice;
    const totalBuckets = peaks.length / 2;

    const startBucket = Math.max(0, Math.floor((bufferOffset * sampleRate) / samplesPerBucket));
    const endBucket = Math.min(
      totalBuckets,
      Math.ceil(((bufferOffset + playDuration) * sampleRate) / samplesPerBucket),
    );
    const bucketSpan = Math.max(1, endBucket - startBucket);

    const columnCount = Math.max(1, Math.floor(widthPx * dpr));
    const mid = canvas.height / 2;
    const amp = canvas.height / 2;

    ctx.fillStyle = color;

    // for each output column, find the min/max across the peaks it covers.
    // bucketsPerColumn is usually < 1 when zoomed in (one bucket spans many columns)
    // and >= 1 when zoomed out.
    for (let col = 0; col < columnCount; col++) {
      const bucketStart = startBucket + (col / columnCount) * bucketSpan;
      const bucketEnd = startBucket + ((col + 1) / columnCount) * bucketSpan;
      const bStart = Math.floor(bucketStart);
      const bEnd = Math.max(bStart + 1, Math.ceil(bucketEnd));

      let min = 127;
      let max = -128;
      for (let b = bStart; b < bEnd && b < totalBuckets; b++) {
        const mn = peaks[b * 2];
        const mx = peaks[b * 2 + 1];
        if (mn < min) min = mn;
        if (mx > max) max = mx;
      }
      if (min > max) continue;

      const yTop = mid - (max / 127) * amp;
      const yBot = mid - (min / 127) * amp;
      const h = Math.max(1, yBot - yTop);
      ctx.fillRect(col, yTop, 1, h);
    }
  }, [engine, bufferId, bufferOffset, playDuration, widthPx, heightPx, color]);

  return <canvas ref={canvasRef} className="timeline_clip_waveform" aria-hidden="true" />;
}
