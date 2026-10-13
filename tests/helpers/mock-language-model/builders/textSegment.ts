import type {TextSegment, WaitSegment} from "../types";

export function textSegment(text: string | readonly (string | WaitSegment)[]): TextSegment {
    return {type: "text", chunks: typeof text === "string" ? [text] : text};
}
