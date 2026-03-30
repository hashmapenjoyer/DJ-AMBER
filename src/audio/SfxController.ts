import type { ID, SfxClip } from './types';

/**
 * manages the list of SFX clips placed on the timeline.
 *
 * SFX changes don't affect the playlist timeline. the callback
 * just pushes the updated clip list to the Scheduler.
 */
export class SfxController {
  private clips: SfxClip[] = [];
  private readonly onChanged: (clips: SfxClip[]) => void;

  constructor(onChanged: (clips: SfxClip[]) => void) {
    this.onChanged = onChanged;
  }

  add(sfx: Omit<SfxClip, 'id'>): ID {
    const id = crypto.randomUUID();
    const clip: SfxClip = { ...sfx, id };
    this.clips.push(clip);
    this.onChanged(this.clips);
    return id;
  }

  remove(sfxId: ID): void {
    this.clips = this.clips.filter((s) => s.id !== sfxId);
    this.onChanged(this.clips);
  }

  getClips(): ReadonlyArray<SfxClip> {
    return this.clips;
  }
}
