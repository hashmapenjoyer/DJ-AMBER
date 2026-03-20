import type { ID } from './UtilTypes';

export interface LibraryItem {
  id: ID;
  title: string;
  duration: number;
  category: 'music' | 'sfx';
}