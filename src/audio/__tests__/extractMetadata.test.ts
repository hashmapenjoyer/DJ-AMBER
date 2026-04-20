import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractMetadata, extractMetadataWithShazam } from '../extractMetadata';

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

describe('extractMetadataWithShazam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --- Short-circuit: both tags present ---

  it('returns tag data and does NOT call fetch when both title and artist tags are present', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'Tag Title', artist: 'Tag Artist' },
    } as any);

    const meta = await extractMetadataWithShazam(makeFile('song.mp3'));

    expect(meta.title).toBe('Tag Title');
    expect(meta.artist).toBe('Tag Artist');
    expect(fetch).not.toHaveBeenCalled();
  });

  // --- Shazam called: title tag missing ---

  it('calls fetch and fills title from Shazam when title tag is absent', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { artist: 'Tag Artist' },
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Shazam Title', artist: 'Shazam Artist', coverUrl: null }),
    });

    const meta = await extractMetadataWithShazam(makeFile('song.mp3'));

    expect(fetch).toHaveBeenCalledOnce();
    expect(meta.title).toBe('Shazam Title');
    // Tag artist should be preserved over the Shazam artist
    expect(meta.artist).toBe('Tag Artist');
  });

  // --- Shazam called: artist tag missing ---

  it('calls fetch and fills artist from Shazam when artist tag is absent', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'Tag Title' },
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Shazam Title', artist: 'Shazam Artist', coverUrl: null }),
    });

    const meta = await extractMetadataWithShazam(makeFile('song.mp3'));

    expect(fetch).toHaveBeenCalledOnce();
    // Tag title should be preserved over the Shazam title
    expect(meta.title).toBe('Tag Title');
    expect(meta.artist).toBe('Shazam Artist');
  });

  // --- Shazam called: both tags missing ---

  it('uses Shazam title and artist when both tags are absent', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: {},
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Shazam Title',
        artist: 'Shazam Artist',
        coverUrl: 'https://example.com/cover.jpg',
      }),
    });

    const meta = await extractMetadataWithShazam(makeFile('song.mp3'));

    expect(meta.title).toBe('Shazam Title');
    expect(meta.artist).toBe('Shazam Artist');
    expect(meta.coverUrl).toBe('https://example.com/cover.jpg');
  });

  // --- Embedded cover art takes priority over Shazam cover ---

  it('prefers embedded cover art over Shazam coverUrl', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:embedded');
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: {
        title: 'T',
        picture: [{ data: new Uint8Array([1, 2, 3]), format: 'image/jpeg' }],
      },
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Shazam Title',
        artist: 'Shazam Artist',
        coverUrl: 'https://example.com/shazam-cover.jpg',
      }),
    });

    const meta = await extractMetadataWithShazam(makeFile('song.mp3'));

    expect(meta.coverUrl).toBe('blob:embedded');
    createObjectURLSpy.mockRestore();
  });

  // --- Graceful degradation: server not running ---

  it('falls back to filename + Unknown Artist when fetch rejects (server not running)', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({ common: {} } as any);
    vi.mocked(fetch as any).mockRejectedValue(new Error('Failed to fetch'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const meta = await extractMetadataWithShazam(makeFile('my-song.mp3'));

    expect(meta.title).toBe('my-song');
    expect(meta.artist).toBe('Unknown Artist');
    expect(meta.coverUrl).toBeUndefined();
    warnSpy.mockRestore();
  });

  // --- Graceful degradation: server returns non-ok status ---

  it('falls back to filename + Unknown Artist when Shazam server returns a non-ok response', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({ common: {} } as any);
    vi.mocked(fetch as any).mockResolvedValue({ ok: false });

    const meta = await extractMetadataWithShazam(makeFile('unknown-track.wav'));

    expect(meta.title).toBe('unknown-track');
    expect(meta.artist).toBe('Unknown Artist');
  });

  // --- Graceful degradation: partial Shazam response ---

  it('falls back to filename when Shazam title is null', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({ common: {} } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ title: null, artist: 'Shazam Artist', coverUrl: null }),
    });

    const meta = await extractMetadataWithShazam(makeFile('my-track.flac'));

    expect(meta.title).toBe('my-track');
    expect(meta.artist).toBe('Shazam Artist');
  });

  // --- Graceful degradation: parseBlob rejects, Shazam succeeds ---

  it('still tries Shazam and returns its data when tag parsing throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(mm.parseBlob).mockRejectedValue(new Error('parse error'));
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Shazam Title', artist: 'Shazam Artist', coverUrl: null }),
    });

    const meta = await extractMetadataWithShazam(makeFile('corrupt.mp3'));

    expect(meta.title).toBe('Shazam Title');
    expect(meta.artist).toBe('Shazam Artist');
    errorSpy.mockRestore();
  });

  // --- Does not throw in any failure scenario ---

  it('never rejects - always resolves to a TrackMetadata object', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(mm.parseBlob).mockRejectedValue(new Error('boom'));
    vi.mocked(fetch as any).mockRejectedValue(new Error('also boom'));

    await expect(extractMetadataWithShazam(makeFile('a.mp3'))).resolves.toBeDefined();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
