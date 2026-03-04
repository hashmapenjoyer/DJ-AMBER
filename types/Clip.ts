import type { Fade } from "./Fade";
import type { ID, Seconds } from "./UtilTypes";

export interface Clip {
    id: ID;
    bufferID: ID;
    startTime: Seconds;
    duration: Seconds;
    offset: Seconds; // offset from start of project
    fades: Fade[];
    title: string;
}