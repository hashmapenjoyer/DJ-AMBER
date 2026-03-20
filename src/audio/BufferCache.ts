import type { ID, Seconds } from './types';

/**
 * decodes and caches AudioBuffers by ID.
 * single source of truth for decoded audio data.
 */
export class BufferCache {
  private readonly buffers = new Map<ID, AudioBuffer>();
  private readonly ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async add(id: ID, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(id, audioBuffer);
    return audioBuffer;
  }

  get(id: ID): AudioBuffer | undefined {
    return this.buffers.get(id);
  }

  has(id: ID): boolean {
    return this.buffers.has(id);
  }

  remove(id: ID): void {
    this.buffers.delete(id);
  }

  getDuration(id: ID): Seconds | undefined {
    return this.buffers.get(id)?.duration;
  }
}
