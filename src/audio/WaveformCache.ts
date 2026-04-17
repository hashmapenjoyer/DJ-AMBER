import type { ID } from './types';

/**
 * precomputed min/max peaks for one zoom level
 * peaks are interleaved [min0, max0, min1, max1, ...] normalized to -127..127
 */
export interface PeakLevel {
  samplesPerBucket: number;
  peaks: Int8Array;
}

export interface PeakSlice {
  peaks: Int8Array;
  samplesPerBucket: number;
  sampleRate: number;
}

// smallest-bucket level is the finest detail, each subsequent level is 4x coarser
// covers zoom from ~1 bucket per 6ms up to ~1 bucket per 1.5s at 44.1kHz
const BASE_SAMPLES_PER_BUCKET = 256;
const LEVEL_COUNT = 4;
const LEVEL_STEP = 4;

/**
 * caches mipmapped waveform peaks per bufferId.
 * computed once on buffer add, reads are O(visible pixels) regardless of clip length
 *
 * lifecycle is driven by BufferCache via callback injection in AudioEngine,
 * so peaks exist if the buffer exists.
 */
export class WaveformCache {
  private readonly levelsById = new Map<ID, PeakLevel[]>();
  private readonly sampleRateById = new Map<ID, number>();

  add(id: ID, buffer: AudioBuffer): void {
    const mono = downmixToMono(buffer);
    const levels: PeakLevel[] = [];

    let prev: Int8Array<ArrayBuffer> | null = null;

    for (let i = 0; i < LEVEL_COUNT; i++) {
      const samplesPerBucket = BASE_SAMPLES_PER_BUCKET * Math.pow(LEVEL_STEP, i);
      const peaks: Int8Array<ArrayBuffer> = prev
        ? downsamplePeaks(prev, LEVEL_STEP)
        : computePeaksFromSamples(mono, samplesPerBucket);
      levels.push({ samplesPerBucket, peaks });
      prev = peaks;
    }

    this.levelsById.set(id, levels);
    this.sampleRateById.set(id, buffer.sampleRate);
  }

  remove(id: ID): void {
    this.levelsById.delete(id);
    this.sampleRateById.delete(id);
  }

  has(id: ID): boolean {
    return this.levelsById.has(id);
  }

  /**
   * returns the finest level whose bucket count still fits within targetBuckets
   * (i.e. one peak-pair covers at least one pixel). callers ask for pixel width,
   * the cache picks the right resolution.
   */
  get(id: ID, targetBuckets: number): PeakSlice | undefined {
    const levels = this.levelsById.get(id);
    const sampleRate = this.sampleRateById.get(id);
    if (!levels || !sampleRate || targetBuckets <= 0) return undefined;

    let chosen = levels[0];
    for (const level of levels) {
      const bucketCount = level.peaks.length / 2;
      if (bucketCount >= targetBuckets) {
        chosen = level;
      } else {
        break;
      }
    }

    return {
      peaks: chosen.peaks,
      samplesPerBucket: chosen.samplesPerBucket,
      sampleRate,
    };
  }
}

/** average all channels into a single Float32Array */
function downmixToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const channelCount = buffer.numberOfChannels;
  if (channelCount === 1) return buffer.getChannelData(0);

  const out = new Float32Array(length);
  for (let ch = 0; ch < channelCount; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      out[i] += data[i];
    }
  }
  const inv = 1 / channelCount;
  for (let i = 0; i < length; i++) out[i] *= inv;
  return out;
}

/** build the base mipmap level directly from sample data */
function computePeaksFromSamples(
  samples: Float32Array,
  samplesPerBucket: number,
): Int8Array<ArrayBuffer> {
  const bucketCount = Math.ceil(samples.length / samplesPerBucket);
  const out = new Int8Array(bucketCount * 2);

  for (let b = 0; b < bucketCount; b++) {
    const start = b * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, samples.length);
    let min = 1;
    let max = -1;
    for (let i = start; i < end; i++) {
      const s = samples[i];
      if (s < min) min = s;
      if (s > max) max = s;
    }
    out[b * 2] = clampToInt8(min);
    out[b * 2 + 1] = clampToInt8(max);
  }
  return out;
}

function downsamplePeaks(source: Int8Array, step: number): Int8Array<ArrayBuffer> {
  const sourceBuckets = source.length / 2;
  const bucketCount = Math.ceil(sourceBuckets / step);
  const out = new Int8Array(bucketCount * 2);

  for (let b = 0; b < bucketCount; b++) {
    const start = b * step;
    const end = Math.min(start + step, sourceBuckets);
    let min = 127;
    let max = -128;
    for (let i = start; i < end; i++) {
      const mn = source[i * 2];
      const mx = source[i * 2 + 1];
      if (mn < min) min = mn;
      if (mx > max) max = mx;
    }
    out[b * 2] = min;
    out[b * 2 + 1] = max;
  }
  return out;
}

function clampToInt8(v: number): number {
  const scaled = Math.round(v * 127);
  if (scaled > 127) return 127;
  if (scaled < -128) return -128;
  return scaled;
}
