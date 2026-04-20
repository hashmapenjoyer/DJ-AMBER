import * as mm from 'music-metadata-browser';
import type { ShazamSuggestion } from '../../types/LibraryItem';

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

export interface TrackMetadata {
  title: string;
  artist: string;
  coverUrl?: string;
}

/**
 * Returned by extractMetadataWithShazam.
 *
 * `metadata` is always safe to display immediately - it contains tag values
 * with filename / "Unknown Artist" fallbacks applied.
 *
 * `shazamSuggestion` is present only when Shazam fingerprinted the file and
 * returned a result.  The caller should surface this to the user for
 * confirmation before overwriting `metadata`, because fingerprinting can
 * misidentify songs.
 */
export interface MetadataResult {
  metadata: TrackMetadata;
  shazamSuggestion?: ShazamSuggestion;
}

interface TagResult {
  tagTitle: string | undefined;
  tagArtist: string | undefined;
  coverUrl: string | undefined;
}

/**
 * Parses embedded tags without applying any fallbacks.
 * Never rejects - returns all-undefined fields on failure.
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
 * Asks the local Shazam server to fetch cover art for a file whose title and
 * artist are already known from embedded tags.  The server fingerprints the
 * audio and returns only the cover art URL - it never overwrites the title or
 * artist, so a misidentification cannot corrupt metadata the user already has.
 *
 * Returns null silently on any failure (server not running, not found, etc.).
 */
async function fetchCoverArtBySearch(file: File): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('audio', file, file.name);
    const response = await fetch('/api/shazam/search', { method: 'POST', body: formData });
    if (!response.ok) return null;
    const data = (await response.json()) as { coverUrl: string | null };
    return data.coverUrl ?? null;
  } catch {
    // Server not running - not an error the user needs to see.
    return null;
  }
}

/**
 * Asks the local Shazam server to fingerprint the file.
 * Returns null silently on any failure.
 */
async function fetchShazamFingerprint(file: File): Promise<ShazamSuggestion | null> {
  try {
    const formData = new FormData();
    formData.append('audio', file, file.name);

    const response = await fetch('/api/shazam', { method: 'POST', body: formData });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      title: string | null;
      artist: string | null;
      coverUrl: string | null;
    };

    // Only treat it as a successful identification if we got at least a title.
    if (!data.title) return null;

    return {
      title: data.title,
      artist: data.artist ?? 'Unknown Artist',
      coverUrl: data.coverUrl,
    };
  } catch (err) {
    console.warn('[extractMetadataWithShazam] Shazam server unavailable:', err);
    return null;
  }
}

/**
 * Reads embedded tags and applies filename / "Unknown Artist" fallbacks.
 * Never calls the network.  Behaviour is identical to the original
 * extractMetadata implementation.
 */
export async function extractMetadata(file: File): Promise<TrackMetadata> {
  const { tagTitle, tagArtist, coverUrl } = await parseTags(file);
  return {
    title: tagTitle ?? stripExtension(file.name),
    artist: tagArtist ?? 'Unknown Artist',
    coverUrl,
  };
}

/**
 * Smart metadata extraction with optional Shazam assistance.
 *
 * Strategy:
 *
 * 1. Both title AND artist present in tags
 *    - Use tag values directly.
 *    - If cover art is also embedded, done.
 *    - If cover art is missing, silently search Shazam by title + artist
 *      (low misidentification risk since we already know the song identity).
 *    - Returns no shazamSuggestion - nothing for the user to confirm.
 *
 * 2. Title OR artist (or both) missing from tags
 *    - Fingerprint the audio via the Shazam server.
 *    - Keep tag values for any fields that were present.
 *    - Apply filename / "Unknown Artist" fallbacks for missing fields.
 *    - If Shazam identified the song, attach the result as shazamSuggestion
 *      for the user to accept or dismiss - never apply it silently.
 *    - Returns shazamSuggestion when Shazam succeeded.
 *
 * In all cases the returned `metadata` is immediately safe to display.
 * If the Shazam server is not running, every path degrades gracefully to
 * the same result as extractMetadata().
 */
export async function extractMetadataWithShazam(file: File): Promise<MetadataResult> {
  const { tagTitle, tagArtist, coverUrl: embeddedCoverUrl } = await parseTags(file);

  // --- Case 1: both identity fields are present in tags ---
  if (tagTitle !== undefined && tagArtist !== undefined) {
    let coverUrl = embeddedCoverUrl;

    // Silently try to fill missing cover art via a title+artist search.
    // This is safe because we are doing a lookup, not a fingerprint.
    if (!coverUrl) {
      const searched = await fetchCoverArtBySearch(file);
      coverUrl = searched ?? undefined;
    }

    return { metadata: { title: tagTitle, artist: tagArtist, coverUrl } };
  }

  // --- Case 2: at least one identity field is missing - fingerprint ---
  const suggestion = await fetchShazamFingerprint(file);

  const metadata: TrackMetadata = {
    title: tagTitle ?? stripExtension(file.name),
    artist: tagArtist ?? 'Unknown Artist',
    coverUrl: embeddedCoverUrl,
  };

  return {
    metadata,
    shazamSuggestion: suggestion ?? undefined,
  };
}
