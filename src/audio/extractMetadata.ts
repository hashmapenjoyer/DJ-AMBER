import * as mm from 'music-metadata-browser';

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

export interface TrackMetadata {
  title: string;
  artist: string;
  coverUrl?: string;
}

interface TagResult {
  /** Title from the embedded tag, or undefined if absent. */
  tagTitle: string | undefined;
  /** Artist from the embedded tag, or undefined if absent. */
  tagArtist: string | undefined;
  /** Object URL for the embedded cover art, or undefined if absent. */
  coverUrl: string | undefined;
}

/**
 * Parses ID3/Vorbis/etc. tags from `file` and returns the raw tag values
 * without applying any fallbacks.  Callers decide what to do with gaps.
 *
 * Resolves to all-undefined fields (never rejects) when parsing fails.
 */
async function parseTags(file: File): Promise<TagResult> {
  try {
    const metadata = await mm.parseBlob(file);

    let coverUrl: string | undefined;
    const picture = metadata.common.picture?.[0];
    if (picture) {
      const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
      coverUrl = URL.createObjectURL(blob);
    }

    return {
      tagTitle: metadata.common.title,
      tagArtist: metadata.common.artist,
      coverUrl,
    };
  } catch (err) {
    console.error('[extractMetadata] failed to parse tags:', err);
    return { tagTitle: undefined, tagArtist: undefined, coverUrl: undefined };
  }
}

/**
 * Attempts to read ID3/Vorbis/etc. tags from an audio File.
 * Falls back to the stripped filename and 'Unknown Artist' when tags are
 * absent (e.g. WAV files) or parsing fails.
 */
export async function extractMetadata(file: File): Promise<TrackMetadata> {
  const { tagTitle, tagArtist, coverUrl } = await parseTags(file);
  return {
    title: tagTitle ?? stripExtension(file.name),
    artist: tagArtist ?? 'Unknown Artist',
    coverUrl,
  };
}

interface ShazamPayload {
  title: string | null;
  artist: string | null;
  coverUrl: string | null;
}

/**
 * Like `extractMetadata`, but when either the title or the artist tag is
 * absent it also tries the optional local Shazam server at `/api/shazam`.
 *
 * If the server is not running (or returns an error) this function catches
 * the failure silently and returns the same filename/Unknown-Artist fallback
 * as `extractMetadata`, so callers don't need to handle a different error
 * surface.
 *
 * Tag values always win over Shazam values when both are available, so a
 * file that has a title tag but no artist tag keeps its embedded title while
 * filling the artist from Shazam.
 */
export async function extractMetadataWithShazam(file: File): Promise<TrackMetadata> {
  const { tagTitle, tagArtist, coverUrl } = await parseTags(file);

  // Both fields present in tags - no need to hit the network at all.
  if (tagTitle !== undefined && tagArtist !== undefined) {
    return { title: tagTitle, artist: tagArtist, coverUrl };
  }

  // At least one field is missing; ask the Shazam server.
  try {
    const formData = new FormData();
    formData.append('audio', file, file.name);

    const response = await fetch('/api/shazam', { method: 'POST', body: formData });

    if (response.ok) {
      const data = (await response.json()) as ShazamPayload;
      return {
        // Tag value wins; Shazam fills gaps; filename is the last resort.
        title: tagTitle ?? data.title ?? stripExtension(file.name),
        artist: tagArtist ?? data.artist ?? 'Unknown Artist',
        // Prefer embedded art; fall back to Shazam's CDN URL if present.
        coverUrl: coverUrl ?? data.coverUrl ?? undefined,
      };
    }
  } catch (err) {
    // Network error = server not running.  Warn and continue to fallback.
    console.warn('[extractMetadataWithShazam] Shazam server unavailable, using fallback:', err);
  }

  // Final fallback -
  // - identical behaviour to extractMetadata.
  return {
    title: tagTitle ?? stripExtension(file.name),
    artist: tagArtist ?? 'Unknown Artist',
    coverUrl,
  };
}
