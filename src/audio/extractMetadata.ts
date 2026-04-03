import * as mm from 'music-metadata-browser';

function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

export interface TrackMetadata {
  title: string;
  artist: string;
}

/**
 * Attempts to read ID3/Vorbis/etc. tags from an audio File.
 * Falls back to the stripped filename and 'Unknown Artist' when
 * tags are absent (e.g. WAV files) or parsing fails.
 */
export async function extractMetadata(file: File): Promise<TrackMetadata> {
  try {
    const metadata = await mm.parseBlob(file, { skipCovers: true });
    return {
      title: metadata.common.title ?? stripExtension(file.name),
      artist: metadata.common.artist ?? 'Unknown Artist',
    };
  } catch {
    return {
      title: stripExtension(file.name),
      artist: 'Unknown Artist',
    };
  }
}
