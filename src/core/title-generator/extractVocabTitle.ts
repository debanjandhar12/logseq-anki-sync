import {getCustomVocab} from "./getCustomVocab";
import {capitalize, escapeRegExp, MAX_TITLE_LENGTH, truncateAtWordBoundary} from "./titleUtils";

/**
 * Match known domain terms from the custom vocabulary in the input.
 * Uses vocab keys as a case-insensitive whole-word dictionary lookup,
 * NOT as POS tag overrides (which breaks compromise's noun detection).
 */
export const extractVocabTitle = (message: string): string | undefined => {
    const vocab = getCustomVocab();
    const lowerMessage = message.toLowerCase();

    const foundTerms = Object.keys(vocab).filter((term) => {
        const pattern = new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`);
        return pattern.test(lowerMessage);
    });

    if (foundTerms.length === 0) return undefined;
    return truncateAtWordBoundary(
        foundTerms.slice(0, 3).map(capitalize).join(" "),
        MAX_TITLE_LENGTH
    );
};
