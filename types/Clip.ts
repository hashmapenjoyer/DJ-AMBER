import type { Fade } from "./Fade";
import type { ID } from "./UtilTypes";

export interface Clip {
    id: ID;
    bufferID: ID;
    startTime: number;
    duration: number;
    offset: number; // offset from start of project
    fades: Fade[];
    title: string;
}