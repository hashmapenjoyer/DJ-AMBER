export enum FadeType {
    LINEAR,
    EXPONENTIAL,
}

export interface Fade {
    type: FadeType;
    startOffset: number;
    endOffset: number;
    startGain: number;
    endGain: number;
}