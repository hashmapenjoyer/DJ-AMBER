import * as mm from 'music-metadata-browser';

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

export interface TrackMetadata {
  title: string;
  artist: string;
  coverUrl?: string;
}

/**
 * Attempts to read ID3/Vorbis/etc. tags from an audio File.
 * Falls back to the stripped filename and 'Unknown Artist' when
 * tags are absent (e.g. WAV files) or parsing fails.
 */
export async function extractMetadata(file: File): Promise<TrackMetadata> {
  try {
    const metadata = await mm.parseBlob(file);

    let coverUrl: string | undefined;
    const picture = metadata.common.picture?.[0];
    if (picture) {
      const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format });
      coverUrl = URL.createObjectURL(blob);
    }

    return {
      title: metadata.common.title ?? stripExtension(file.name),
      artist: metadata.common.artist ?? 'Unknown Artist',
      coverUrl,
    };
  } catch (err) {
    console.error('[extractMetadata] failed to parse tags:', err);
    return {
      title: stripExtension(file.name),
      artist: 'Unknown Artist',
    };
  }
}
