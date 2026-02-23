import type { Fade } from "./Fade";
import type { ID } from "./UtilTypes";

export interface AudioEvent {
    id: ID;
    clipId: ID;
    trackId: ID;
    buffer: AudioBuffer;
    startAbsTime: number;
    offsetIntoBuffer: number;
    duration: number;
    fades: Fade[];
}