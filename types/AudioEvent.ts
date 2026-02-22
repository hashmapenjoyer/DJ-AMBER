import { Fade } from "./Fade";
import { ID } from "./UtilTypes";

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