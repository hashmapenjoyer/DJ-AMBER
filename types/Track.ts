import { ID } from "./UtilTypes";
import { Clip } from "./Clip"

export interface Track {
    id: ID;
    clips: Clip[];
    gain: number;
    muted: boolean;
    getEventsBetween(windowStart: number, windowEnd: number): number[];
}