import {
    describeTextQuote as apacheDescribeTextQuote,
    type Chunk,
    type Chunker,
    type TextQuoteSelector,
    textQuoteSelectorMatcher
} from "@apache-annotator/selector";
import {makeDiff, xIndex} from "@sanity/diff-match-patch";

export class StringChunk implements Chunk<string> {
    constructor(public data: string) {}
    equals(other: this) {
        return this.data === other.data;
    }
}

export class StringChunker implements Chunker<StringChunk> {
    private chunk: StringChunk;
    constructor(str: string) {
        this.chunk = new StringChunk(str);
    }
    get currentChunk() {
        return this.chunk;
    }
    nextChunk() {
        return null;
    }
    previousChunk() {
        return null;
    }
    precedesCurrentChunk() {
        return false;
    }
}

export type QuoteInfo = {
    exact: string;
    prefix?: string;
    suffix?: string;
};

export interface QuoteMatchResult {
    start: number;
    end: number;
    text: string;
}

export async function matchTextQuote(
    text: string,
    quote: QuoteInfo
): Promise<QuoteMatchResult | null> {
    const matcher = textQuoteSelectorMatcher({
        type: "TextQuoteSelector",
        exact: quote.exact,
        prefix: quote.prefix || undefined,
        suffix: quote.suffix || undefined
    });
    const chunker = new StringChunker(text);
    const generator = matcher(chunker);
    const match = await generator.next();

    if (!match.done && match.value) {
        const val = match.value as any;
        return {start: val.startIndex, end: val.endIndex, text: quote.exact};
    }

    // Fuzzy match via global semantic diff
    const expectedPrefix = quote.prefix || "";
    const expectedSuffix = quote.suffix || "";
    const expectedText = expectedPrefix + quote.exact + expectedSuffix;

    const diffs = makeDiff(expectedText, text);

    const exactStartInExpected = expectedPrefix.length;
    const exactEndInExpected = expectedPrefix.length + quote.exact.length;

    const actualStart = xIndex(diffs, exactStartInExpected);
    const actualEnd = xIndex(diffs, exactEndInExpected);

    if (actualStart !== actualEnd) {
        // diff-match-patch can aggressively semantic-cleanup boundary characters if the prefix/suffix
        // changes resemble the exact text. We override `actualEnd` if the original exact string is intact.
        const end = text.startsWith(quote.exact, actualStart)
            ? actualStart + quote.exact.length
            : actualEnd;

        return {
            start: actualStart,
            end: end,
            text: text.substring(actualStart, end)
        };
    }

    return null;
}

export async function describeTextQuote(
    text: string,
    startIndex: number,
    endIndex: number
): Promise<TextQuoteSelector> {
    const chunker = new StringChunker(text);
    const quote = await apacheDescribeTextQuote(
        {
            startChunk: chunker.currentChunk,
            startIndex: startIndex,
            endChunk: chunker.currentChunk,
            endIndex: endIndex
        },
        () => new StringChunker(text)
    );

    const MIN_CONTEXT = 8;

    // Expand prefix if it's too short
    if (!quote.prefix || quote.prefix.length < MIN_CONTEXT) {
        const prefixStart = Math.max(0, startIndex - MIN_CONTEXT);
        quote.prefix = text.substring(prefixStart, startIndex);
    }

    // Expand suffix if it's too short
    if (!quote.suffix || quote.suffix.length < MIN_CONTEXT) {
        const suffixEnd = Math.min(text.length, endIndex + MIN_CONTEXT);
        quote.suffix = text.substring(endIndex, suffixEnd);
    }

    return quote;
}

export type HighlightElementGeometry = {
    text: string;
    prefix: string;
    suffix: string;
};

export async function getHealedHighlightGeometry<T extends HighlightElementGeometry>(
    fullText: string,
    element: T
): Promise<{healed: boolean; element: T; actualStart: number} | null> {
    const matchResult = await matchTextQuote(fullText, {
        exact: element.text,
        prefix: element.prefix,
        suffix: element.suffix
    });

    if (matchResult) {
        const {start: actualStart, end: actualEnd, text: matchedText} = matchResult;

        const quoteInfo = await describeTextQuote(fullText, actualStart, actualEnd);

        if (
            matchedText !== element.text ||
            quoteInfo.prefix !== element.prefix ||
            quoteInfo.suffix !== element.suffix
        ) {
            const healedElement = {
                ...element,
                text: matchedText,
                prefix: quoteInfo.prefix || "",
                suffix: quoteInfo.suffix || ""
            };

            return {
                healed: true,
                actualStart,
                element: healedElement
            };
        }
        return {
            healed: false,
            actualStart,
            element: element
        };
    }
    return null;
}
