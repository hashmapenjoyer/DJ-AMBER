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

  // ── Case 1: both tags present, cover art embedded ────────────────────────

  it('returns tag data immediately and does NOT call fetch when both tags and cover art are present', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:embedded');
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: {
        title: 'Tag Title',
        artist: 'Tag Artist',
        picture: [{ data: new Uint8Array([1]), format: 'image/jpeg' }],
      },
    } as any);

    const result = await extractMetadataWithShazam(makeFile('song.mp3'));

    expect(result.metadata.title).toBe('Tag Title');
    expect(result.metadata.artist).toBe('Tag Artist');
    expect(result.metadata.coverUrl).toBe('blob:embedded');
    expect(result.shazamSuggestion).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    createObjectURLSpy.mockRestore();
  });

  // ── Case 1: both tags present, cover art missing -> silent search ─────────

  it('silently searches for cover art by audio fingerprint when both tags are present but art is missing', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'Tag Title', artist: 'Tag Artist' },
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ coverUrl: 'https://example.com/cover.jpg' }),
    });

    const result = await extractMetadataWithShazam(makeFile('song.mp3'));

    // Should call /api/shazam/search with the audio file, not /api/shazam
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch as any).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/shazam/search');
    expect(init.body).toBeInstanceOf(FormData);

    expect(result.metadata.title).toBe('Tag Title');
    expect(result.metadata.artist).toBe('Tag Artist');
    expect(result.metadata.coverUrl).toBe('https://example.com/cover.jpg');
    // No user confirmation needed - only cover art is used from the result
    expect(result.shazamSuggestion).toBeUndefined();
  });

  it('returns no coverUrl and no suggestion when cover art search server is unavailable', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'Tag Title', artist: 'Tag Artist' },
    } as any);
    vi.mocked(fetch as any).mockRejectedValue(new Error('Failed to fetch'));

    const result = await extractMetadataWithShazam(makeFile('song.mp3'));

    expect(result.metadata.title).toBe('Tag Title');
    expect(result.metadata.artist).toBe('Tag Artist');
    expect(result.metadata.coverUrl).toBeUndefined();
    expect(result.shazamSuggestion).toBeUndefined();
  });

  // ── Case 2: missing tags → fingerprint -> suggestion returned ─────────────

  it('fingerprints and returns a shazamSuggestion when both tags are missing', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({ common: {} } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Shazam Title',
        artist: 'Shazam Artist',
        coverUrl: 'https://example.com/cover.jpg',
      }),
    });

    const result = await extractMetadataWithShazam(makeFile('unknown.mp3'));

    // metadata uses safe fallbacks
    expect(result.metadata.title).toBe('unknown');
    expect(result.metadata.artist).toBe('Unknown Artist');
    // suggestion is present for user to confirm
    expect(result.shazamSuggestion).toBeDefined();
    expect(result.shazamSuggestion?.title).toBe('Shazam Title');
    expect(result.shazamSuggestion?.artist).toBe('Shazam Artist');
    expect(result.shazamSuggestion?.coverUrl).toBe('https://example.com/cover.jpg');
  });

  it('fingerprints when title tag is missing even if artist tag is present', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { artist: 'Tag Artist' },
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Shazam Title', artist: 'Shazam Artist', coverUrl: null }),
    });

    const result = await extractMetadataWithShazam(makeFile('partial.mp3'));

    // Safe fallback in metadata (tag artist preserved, filename used for title)
    expect(result.metadata.title).toBe('partial');
    expect(result.metadata.artist).toBe('Tag Artist');
    // Shazam suggestion surfaced for confirmation
    expect(result.shazamSuggestion?.title).toBe('Shazam Title');
  });

  it('fingerprints when artist tag is missing even if title tag is present', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: { title: 'Tag Title' },
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'Shazam Title', artist: 'Shazam Artist', coverUrl: null }),
    });

    const result = await extractMetadataWithShazam(makeFile('partial.mp3'));

    expect(result.metadata.title).toBe('Tag Title');
    expect(result.metadata.artist).toBe('Unknown Artist');
    expect(result.shazamSuggestion?.artist).toBe('Shazam Artist');
  });

  // ── Case 2: fingerprint returns no result -> no suggestion ────────────────

  it('returns no suggestion when fingerprinting server returns 404', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({ common: {} } as any);
    vi.mocked(fetch as any).mockResolvedValue({ ok: false });

    const result = await extractMetadataWithShazam(makeFile('obscure.mp3'));

    expect(result.metadata.title).toBe('obscure');
    expect(result.metadata.artist).toBe('Unknown Artist');
    expect(result.shazamSuggestion).toBeUndefined();
  });

  it('returns no suggestion when fingerprinting server is unavailable', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({ common: {} } as any);
    vi.mocked(fetch as any).mockRejectedValue(new Error('Failed to fetch'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await extractMetadataWithShazam(makeFile('offline.mp3'));

    expect(result.metadata.title).toBe('offline');
    expect(result.metadata.artist).toBe('Unknown Artist');
    expect(result.shazamSuggestion).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('returns no suggestion when Shazam response has no title', async () => {
    vi.mocked(mm.parseBlob).mockResolvedValue({ common: {} } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ title: null, artist: 'Shazam Artist', coverUrl: null }),
    });

    const result = await extractMetadataWithShazam(makeFile('unrecognized.mp3'));

    expect(result.shazamSuggestion).toBeUndefined();
  });

  // ── Embedded cover art is preserved in metadata regardless of Shazam ─────

  it('keeps embedded cover art in metadata even when fingerprinting', async () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:embedded');
    vi.mocked(mm.parseBlob).mockResolvedValue({
      common: {
        picture: [{ data: new Uint8Array([1]), format: 'image/jpeg' }],
      },
    } as any);
    vi.mocked(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'Shazam Title',
        artist: 'Shazam Artist',
        coverUrl: 'https://example.com/shazam.jpg',
      }),
    });

    const result = await extractMetadataWithShazam(makeFile('art.mp3'));

    // Embedded art stays in metadata; Shazam art is in the suggestion only
    expect(result.metadata.coverUrl).toBe('blob:embedded');
    expect(result.shazamSuggestion?.coverUrl).toBe('https://example.com/shazam.jpg');
    createObjectURLSpy.mockRestore();
  });

  it('never rejects - always resolves to a MetadataResult', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(mm.parseBlob).mockRejectedValue(new Error('parse error'));
    vi.mocked(fetch as any).mockRejectedValue(new Error('network error'));

    await expect(extractMetadataWithShazam(makeFile('a.mp3'))).resolves.toBeDefined();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
