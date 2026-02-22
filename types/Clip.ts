import { Fade } from "./Fade";
import { ID } from "./UtilTypes";

export interface Clip {
    id: ID;
    bufferID: ID;
    startTime: number;
    duration: number;
    offset: number; // offset from start of project
    fades: Fade[];
    title: string;
}