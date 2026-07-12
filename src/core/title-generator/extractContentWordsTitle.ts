import nlp from "compromise";
import {cleanTitle, MAX_TITLE_LENGTH, truncateAtWordBoundary} from "./titleUtils";

/**
 * Fallback: take the first sentence and strip function words (stopwords)
 * using compromise's built-in POS tags.
 */
export const extractContentWordsTitle = (message: string): string | undefined => {
    const doc = nlp(message);
    const firstSentence = doc.sentences().first().text();
    if (!firstSentence) return undefined;

    const contentText = nlp(firstSentence)
        .not("#Pronoun")
        .not("#Preposition")
        .not("#Determiner")
        .not("#Conjunction")
        .not("#Copula")
        .not("#Modal")
        .not("#QuestionWord")
        .not("#Particle")
        .text()
        .trim();

    if (!contentText) return undefined;
    return cleanTitle(truncateAtWordBoundary(contentText, MAX_TITLE_LENGTH));
};
