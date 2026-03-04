import type { Fade } from "./Fade";
import type { ID, Seconds } from "./UtilTypes";

export interface AudioEvent {
    id: ID;
    clipId: ID;
    trackId: ID;
    buffer: AudioBuffer;
    startAbsTime: Seconds;
    offsetIntoBuffer: Seconds;
    duration: Seconds;
    fades: Fade[];
}