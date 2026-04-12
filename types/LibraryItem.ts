import type { ID } from './UtilTypes';

export interface LibraryItem {
  id: ID;
  /** display title (from metadata tag, or stripped filename) */
  title: string;
  /** raw filename — used for duplicate detection */
  filename: string;
  artist: string;
  duration: number;
  category: 'music' | 'sfx';
  coverUrl?: string;
}