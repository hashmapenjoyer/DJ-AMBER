import type { ID } from './UtilTypes';

export interface LibraryItem {
  id: ID;
  /** display title (from metadata tag, or stripped filename) */
  title: string;
  /** raw filename - preserved for display purposes */
  filename: string;
  /** SHA-256 hex digest of the file's raw bytes - used for duplicate detection */
  hash: string;
  artist: string;
  duration: number;
  category: 'music' | 'sfx';
  coverUrl?: string;
}
