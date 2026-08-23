import type {CompletionContext, CompletionResult, CompletionSource} from "@codemirror/autocomplete";
import {type Diagnostic, linter} from "@codemirror/lint";
import type {Extension} from "@codemirror/state";

export interface MustacheIssue {
    from: number;
    to: number;
    message: string;
}

export interface MustacheCompletionOptions {
    tags: readonly [string, string];
    variableNames: readonly string[];
}

export function isInsideOpenTag(
    context: CompletionContext,
    tags: readonly [string, string]
): boolean {
    const line = context.state.doc.lineAt(context.pos);
    const beforeCursor = context.state.doc.sliceString(line.from, context.pos);
    const openingIndex = beforeCursor.lastIndexOf(tags[0]);
    return (
        openingIndex >= 0 && !beforeCursor.slice(openingIndex + tags[0].length).includes(tags[1])
    );
}

export function createMustacheCompletionSource({
    tags,
    variableNames
}: MustacheCompletionOptions): CompletionSource {
    const options = variableNames.map((name) => ({
        label: `${tags[0]} ${name} ${tags[1]}`,
        apply: `${tags[0]} ${name} ${tags[1]}`,
        type: "variable"
    }));

    return (context): CompletionResult | null => {
        const line = context.state.doc.lineAt(context.pos);
        const beforeCursor = context.state.doc.sliceString(line.from, context.pos);
        const openingIndex = beforeCursor.lastIndexOf(tags[0]);
        if (openingIndex < 0) return null;

        const from = line.from + openingIndex;
        const prefix = beforeCursor.slice(openingIndex + tags[0].length);
        if (prefix.includes(tags[1])) return null;

        const query = prefix.trim();
        if (query && !/^[A-Za-z][\w -]*$/.test(query)) return null;

        const matchingOptions = options.filter((option) => {
            const name = option.label.slice(tags[0].length + 1, -(tags[1].length + 1));
            return name.toLowerCase().startsWith(query.toLowerCase());
        });
        if (matchingOptions.length === 0) return null;

        const afterCursor = context.state.doc.sliceString(context.pos, line.to);
        const closingText = afterCursor.startsWith(tags[1])
            ? tags[1]
            : new RegExp(`^\\s*${escapeRegex(tags[1])}`).exec(afterCursor)?.[0];

        return {
            from,
            to: closingText ? context.pos + closingText.length : context.pos,
            options: matchingOptions,
            filter: false
        };
    };
}

export function createMustacheLinter(
    validate: (source: string) => readonly MustacheIssue[],
    delay = 300
): Extension {
    return linter(
        (view): Diagnostic[] =>
            validate(view.state.doc.toString()).map((issue) => ({
                ...issue,
                severity: "error",
                source: "Mustache"
            })),
        {delay}
    );
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
