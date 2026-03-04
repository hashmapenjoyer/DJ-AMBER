import type {Seconds, Gain} from "./UtilTypes"

export const FadeType = {
    LINEAR: 0,
    EXPONENTIAL: 1,
} as const;

export type FadeType = (typeof FadeType)[keyof typeof FadeType];

export interface Fade {
    type: FadeType;
    startOffset: Seconds;
    endOffset: Seconds;
    startGain: Gain;
    endGain: Gain;
}