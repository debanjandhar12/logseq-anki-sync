import { Chunk, Chunker, textQuoteSelectorMatcher, describeTextQuote as apacheDescribeTextQuote, TextQuoteSelector } from "@apache-annotator/selector";
import { match as dmpMatch } from "@sanity/diff-match-patch";

export class StringChunk implements Chunk<string> {
    constructor(public data: string) { }
    equals(other: this) { return this.data === other.data; }
}

export class StringChunker implements Chunker<StringChunk> {
    private chunk: StringChunk;
    constructor(str: string) {
        this.chunk = new StringChunk(str);
    }
    get currentChunk() { return this.chunk; }
    nextChunk() { return null; }
    previousChunk() { return null; }
    precedesCurrentChunk() { return false; }
}

export type QuoteInfo = {
    exact: string;
    prefix?: string;
    suffix?: string;
};

export async function matchTextQuote(
    text: string,
    quote: QuoteInfo,
    approxPos?: number
): Promise<number> {
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
        return (match.value as any).startIndex;
    }

    if (approxPos !== undefined) {
        const matchLoc = dmpMatch(text, quote.exact, approxPos);
        if (matchLoc !== -1) {
            return matchLoc;
        }
    }

    // Fallback
    return text.indexOf(quote.exact);
}

export async function describeTextQuote(
    text: string,
    startIndex: number,
    endIndex: number
): Promise<TextQuoteSelector> {
    const chunker = new StringChunker(text);
    const quote = await apacheDescribeTextQuote({
        startChunk: chunker.currentChunk,
        startIndex: startIndex,
        endChunk: chunker.currentChunk,
        endIndex: endIndex
    }, () => new StringChunker(text));

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
    approxPos?: number;
};

export async function getHealedHighlightGeometry<T extends HighlightElementGeometry>(
    fullText: string,
    element: T
): Promise<{ healed: boolean; element: T; actualStart: number } | null> {
    const actualStart = await matchTextQuote(
        fullText,
        {
            exact: element.text,
            prefix: element.prefix,
            suffix: element.suffix,
        },
        element.approxPos
    );

    if (actualStart !== -1) {
        const matchedText = fullText.substring(actualStart, actualStart + element.text.length);
        if (element.approxPos !== actualStart || matchedText !== element.text) {
            const quoteInfo = await describeTextQuote(
                fullText,
                actualStart,
                actualStart + matchedText.length
            );
            return {
                healed: true,
                actualStart,
                element: {
                    ...element,
                    approxPos: actualStart,
                    text: matchedText,
                    prefix: quoteInfo.prefix || "",
                    suffix: quoteInfo.suffix || "",
                },
            };
        }
        return {
            healed: false,
            actualStart,
            element: element,
        };
    }
    return null;
}
