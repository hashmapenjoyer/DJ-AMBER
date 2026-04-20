import type { ID } from './UtilTypes';

/**
 * A Shazam identification suggestion that is pending user confirmation.
 * Stored separately from the item's live title/artist/coverUrl so that
 * tag-derived values are never silently overwritten.
 */
export interface ShazamSuggestion {
  title: string;
  artist: string;
  coverUrl: string | null;
}

export interface LibraryItem {
  id: ID;
  /** Display title (from metadata tag, or stripped filename). */
  title: string;
  /** Raw filename - preserved for display purposes. */
  filename: string;
  /** SHA-256 hex digest of the file's raw bytes - used for duplicate detection. */
  hash: string;
  artist: string;
  duration: number;
  category: 'music' | 'sfx';
  coverUrl?: string;
  /**
   * Present when Shazam fingerprinted the file and returned a result that
   * still needs the user to confirm it is correct.  Undefined once the user
   * has accepted or dismissed the suggestion.
   */
  shazamSuggestion?: ShazamSuggestion;
}
