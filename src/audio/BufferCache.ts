import type { ID, Seconds } from './types';

export interface BufferCacheHooks {
  onAdd?: (id: ID, buffer: AudioBuffer) => void;
  onRemove?: (id: ID) => void;
}

/**
 * decodes and caches AudioBuffers by ID.
 * single source of truth for decoded audio data.
 *
 * hooks let the mediator wire derived caches (e.g. WaveformCache) without
 * BufferCache knowing about them.
 */
export class BufferCache {
  private readonly buffers = new Map<ID, AudioBuffer>();
  private readonly ctx: AudioContext;
  private readonly hooks: BufferCacheHooks;

  constructor(ctx: AudioContext, hooks: BufferCacheHooks = {}) {
    this.ctx = ctx;
    this.hooks = hooks;
  }

  async add(id: ID, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(id, audioBuffer);
    this.hooks.onAdd?.(id, audioBuffer);
    return audioBuffer;
  }

  get(id: ID): AudioBuffer | undefined {
    return this.buffers.get(id);
  }

  has(id: ID): boolean {
    return this.buffers.has(id);
  }

  remove(id: ID): void {
    if (this.buffers.delete(id)) {
      this.hooks.onRemove?.(id);
    }
  }

  getDuration(id: ID): Seconds | undefined {
    return this.buffers.get(id)?.duration;
  }
}
