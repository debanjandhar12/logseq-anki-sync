import type {WaitSegment} from "../types";

export function waitSegment(until: Promise<void>, onReached?: () => void): WaitSegment {
    return {type: "wait", until, onReached};
}
