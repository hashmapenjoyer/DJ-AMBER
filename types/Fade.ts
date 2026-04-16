import type {Seconds, Gain} from "./UtilTypes"

export const FadeType = {
    NONE: 0,
    LINEAR: 1,
    EXPONENTIAL: 2,
    EQUAL_POWER: 3,
} as const;

export type FadeType = (typeof FadeType)[keyof typeof FadeType];

export interface Fade {
    type: FadeType;
    startOffset: Seconds;
    endOffset: Seconds;
    startGain: Gain;
    endGain: Gain;
}