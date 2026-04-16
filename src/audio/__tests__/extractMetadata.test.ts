import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractMetadata } from '../extractMetadata';

vi.mock('music-metadata-browser', () => ({
  parseBlob: vi.fn(),
}));

import * as mm from 'music-metadata-browser';

function makeFile(name: string): File {
  return new File([new ArrayBuffer(0)], name, { type: 'audio/mpeg' });
}

describe('extractMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // stub URL.createObjectURL (jsdom may not have it for blob)
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    }
  });

  it('returns title and artist from tags when present', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'Real Title', artist: 'Real Artist' },
    } as any);
    const meta = await extractMetadata(makeFile('foo.mp3'));
    expect(meta.title).toBe('Real Title');
    expect(meta.artist).toBe('Real Artist');
    expect(meta.coverUrl).toBeUndefined();
  });

  it('falls back to stripped filename when title tag is missing', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { artist: 'Artist' },
    } as any);
    const meta = await extractMetadata(makeFile('my-track.mp3'));
    expect(meta.title).toBe('my-track');
  });

  it('falls back to Unknown Artist when artist tag is missing', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'T' },
    } as any);
    const meta = await extractMetadata(makeFile('foo.mp3'));
    expect(meta.artist).toBe('Unknown Artist');
  });

  it('strips extension correctly (last dot only)', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: {},
    } as any);
    const meta = await extractMetadata(makeFile('song.with.dots.flac'));
    expect(meta.title).toBe('song.with.dots');
  });

  it('returns coverUrl via URL.createObjectURL when picture is present', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: {
        title: 'T',
        artist: 'A',
        picture: [{ data: new Uint8Array([1, 2, 3]), format: 'image/png' }],
      },
    } as any);
    const meta = await extractMetadata(makeFile('foo.mp3'));
    expect(meta.coverUrl).toBe('blob:test');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    createObjectURLSpy.mockRestore();
  });

  it('returns undefined coverUrl when no picture', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'T', artist: 'A' },
    } as any);
    const meta = await extractMetadata(makeFile('foo.mp3'));
    expect(meta.coverUrl).toBeUndefined();
  });

  it('falls back to filename + Unknown Artist when parseBlob rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mm.parseBlob).mockRejectedValue(new Error('boom'));
    const meta = await extractMetadata(makeFile('failing.wav'));
    expect(meta.title).toBe('failing');
    expect(meta.artist).toBe('Unknown Artist');
    expect(meta.coverUrl).toBeUndefined();
    errorSpy.mockRestore();
  });

  it('does not throw when parseBlob rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mm.parseBlob).mockRejectedValue(new Error('boom'));
    await expect(extractMetadata(makeFile('a.mp3'))).resolves.toBeDefined();
    errorSpy.mockRestore();
  });
});
