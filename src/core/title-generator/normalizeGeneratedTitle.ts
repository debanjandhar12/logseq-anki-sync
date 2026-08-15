export const MAX_TITLE_LENGTH = 50;

const TITLE_PREFIX =
    /^(?:title|chat title|conversation title|thread title)\s*[:\-\u2013\u2014]\s*/i;
const LEADING_MARKDOWN = /^(?:#{1,6}\s+|[-*\u2022]\s+)/;
const TRAILING_PUNCTUATION = /[.,!?;:\u2026]+$/u;

const stripPairedWrapper = (value: string): string => {
    const wrappers: Array<[string, string]> = [
        ["**", "**"],
        ["__", "__"],
        ['"', '"'],
        ["'", "'"],
        ["`", "`"]
    ];

    for (const [start, end] of wrappers) {
        if (
            value.startsWith(start) &&
            value.endsWith(end) &&
            value.length > start.length + end.length
        ) {
            return value.slice(start.length, -end.length).trim();
        }
    }

    return value;
};

const truncateAtWordBoundary = (value: string): string => {
    const codePoints = Array.from(value);
    if (codePoints.length <= MAX_TITLE_LENGTH) return value;

    const truncated = codePoints.slice(0, MAX_TITLE_LENGTH).join("");
    const lastWhitespace = truncated.search(/\s+\S*$/u);
    return (lastWhitespace > 0 ? truncated.slice(0, lastWhitespace) : truncated).trim();
};

export function normalizeGeneratedTitle(output: string): string | undefined {
    let title = output.trim();
    const fencedMatch = title.match(/^```(?:[^\r\n]*)?[\r\n]+([\s\S]*?)\r?\n?```$/u);
    if (fencedMatch) title = fencedMatch[1].trim();

    title = title.replace(/\s+/gu, " ").replace(LEADING_MARKDOWN, "").trim();

    let previousTitle: string;
    do {
        previousTitle = title;
        title = stripPairedWrapper(title).replace(TITLE_PREFIX, "").trim();
    } while (title !== previousTitle);

    title = title.replace(TRAILING_PUNCTUATION, "").trim();
    title = truncateAtWordBoundary(title).replace(TRAILING_PUNCTUATION, "").trim();

    return /[\p{L}\p{N}]/u.test(title) ? title : undefined;
}
