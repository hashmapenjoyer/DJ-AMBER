import type { ID, Seconds, Gain } from "./UtilTypes";
import type { Clip } from "./Clip"

export interface Track {
    id: ID;
    clips: Clip[];
    gain: Gain;
    muted: boolean;
    getEventsBetween(windowStart: Seconds, windowEnd: Seconds): Seconds[];
}