import { describe, it, expect } from 'vitest';
import { BufferCache } from '../BufferCache';
import { MockAudioBuffer, MockAudioContext } from './webAudioMock';

function makeCache(decodedDuration = 180): { cache: BufferCache; ctx: MockAudioContext } {
  const ctx = new MockAudioContext();
  ctx.setDecodedDuration(decodedDuration);
  const cache = new BufferCache(ctx as unknown as AudioContext);
  return { cache, ctx };
}

describe('BufferCache', () => {
  describe('add()', () => {
    it('decodes and stores the buffer under the given ID', async () => {
      const { cache } = makeCache(123);
      const buf = await cache.add('id1', new ArrayBuffer(8));
      expect(buf).toBeInstanceOf(MockAudioBuffer);
      expect(cache.has('id1')).toBe(true);
    });

    it('returns the decoded AudioBuffer', async () => {
      const { cache } = makeCache(200);
      const buf = await cache.add('id1', new ArrayBuffer(8));
      expect(buf.duration).toBe(200);
    });

    it('overwrites an existing buffer when the same ID is reused', async () => {
      const { cache, ctx } = makeCache(100);
      await cache.add('id1', new ArrayBuffer(8));
      ctx.setDecodedDuration(250);
      await cache.add('id1', new ArrayBuffer(8));
      expect(cache.getDuration('id1')).toBe(250);
    });
  });

  describe('get()', () => {
    it('returns the AudioBuffer for a known ID', async () => {
      const { cache } = makeCache();
      const buf = await cache.add('id1', new ArrayBuffer(8));
      expect(cache.get('id1')).toBe(buf);
    });

    it('returns undefined for an unknown ID', () => {
      const { cache } = makeCache();
      expect(cache.get('missing')).toBeUndefined();
    });
  });

  describe('has()', () => {
    it('returns false when empty', () => {
      const { cache } = makeCache();
      expect(cache.has('x')).toBe(false);
    });

    it('returns true after add()', async () => {
      const { cache } = makeCache();
      await cache.add('id1', new ArrayBuffer(8));
      expect(cache.has('id1')).toBe(true);
    });

    it('returns false after remove()', async () => {
      const { cache } = makeCache();
      await cache.add('id1', new ArrayBuffer(8));
      cache.remove('id1');
      expect(cache.has('id1')).toBe(false);
    });
  });

  describe('remove()', () => {
    it('removes an existing buffer', async () => {
      const { cache } = makeCache();
      await cache.add('id1', new ArrayBuffer(8));
      cache.remove('id1');
      expect(cache.get('id1')).toBeUndefined();
    });

    it('is a no-op for unknown IDs', () => {
      const { cache } = makeCache();
      expect(() => cache.remove('nope')).not.toThrow();
    });
  });

  describe('getDuration()', () => {
    it('returns the buffer duration', async () => {
      const { cache } = makeCache(321);
      await cache.add('id1', new ArrayBuffer(8));
      expect(cache.getDuration('id1')).toBe(321);
    });

    it('returns undefined for unknown ID', () => {
      const { cache } = makeCache();
      expect(cache.getDuration('nope')).toBeUndefined();
    });
  });
});
