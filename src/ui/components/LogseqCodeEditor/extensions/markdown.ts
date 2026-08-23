import {
    type CompletionContext,
    type CompletionResult,
    type CompletionSource,
    snippetCompletion
} from "@codemirror/autocomplete";
import {markdown} from "@codemirror/lang-markdown";
import type {LanguageSupport} from "@codemirror/language";
import {isInsideOpenTag} from "./mustache";
import {getFrontmatterRange} from "./yamlFrontmatter";

interface MarkdownSnippet {
    label: string;
    snippet: string;
    triggers: readonly string[];
    block?: boolean;
}

export interface MarkdownCompletionOptions {
    mustacheTags?: readonly [string, string];
}

const snippetField = (placeholder: string): string => "$" + `{${placeholder}}`;

const MARKDOWN_SNIPPETS: readonly MarkdownSnippet[] = [
    {label: "# heading", snippet: `# ${snippetField("Heading")}`, triggers: ["#"], block: true},
    {label: "- bullet item", snippet: `- ${snippetField("Item")}`, triggers: ["-"], block: true},
    {
        label: "1. numbered item",
        snippet: `1. ${snippetField("Item")}`,
        triggers: ["1."],
        block: true
    },
    {
        label: "- [ ] task item",
        snippet: `- [ ] ${snippetField("Task")}`,
        triggers: ["- ["],
        block: true
    },
    {label: "> blockquote", snippet: `> ${snippetField("Quote")}`, triggers: [">"], block: true},
    {
        label: "``` fenced code block",
        snippet: `\`\`\`${snippetField("language")}\n${snippetField("Code")}\n\`\`\``,
        triggers: ["```"],
        block: true
    },
    {
        label: "[text](url)",
        snippet: `[${snippetField("text")}](${snippetField("url")})`,
        triggers: ["["]
    },
    {
        label: "![alt](url)",
        snippet: `![${snippetField("alt text")}](${snippetField("url")})`,
        triggers: ["!["]
    },
    {label: "**bold**", snippet: `**${snippetField("bold text")}**`, triggers: ["**"]},
    {label: "*italic*", snippet: `*${snippetField("italic text")}*`, triggers: ["*"]},
    {label: "`inline code`", snippet: `\`${snippetField("code")}\``, triggers: ["`"]},
    {label: "--- horizontal rule", snippet: "---", triggers: ["---"], block: true}
];

export function createMarkdownLanguageSupport(): LanguageSupport {
    return markdown({completeHTMLTags: false});
}

function isInCode(context: CompletionContext): boolean {
    const beforeCursor = context.state.doc.sliceString(0, context.pos);
    const line = context.state.doc.lineAt(context.pos);
    const linePrefix = context.state.doc.sliceString(line.from, context.pos);
    if (/^\s*```$/.test(linePrefix)) return false;

    const fenceCount = beforeCursor.match(/^ {0,3}(?:`{3,}|~{3,})/gm)?.length ?? 0;
    if (fenceCount % 2 === 1) return true;

    const inlineDelimiters: string[] = linePrefix.match(/`+/g) ?? [];
    if (!context.explicit && inlineDelimiters.length === 1 && linePrefix.endsWith("`"))
        return false;

    return inlineDelimiters.some(
        (delimiter) =>
            inlineDelimiters.filter((candidate) => candidate.length === delimiter.length).length %
                2 ===
            1
    );
}

export function createMarkdownCompletionSource({
    mustacheTags
}: MarkdownCompletionOptions = {}): CompletionSource {
    return (context): CompletionResult | null => {
        const frontmatterRange = getFrontmatterRange(context.state.doc.toString());
        if (
            (frontmatterRange &&
                context.pos >= frontmatterRange.from &&
                context.pos <= frontmatterRange.to) ||
            isInCode(context) ||
            (mustacheTags && isInsideOpenTag(context, mustacheTags))
        ) {
            return null;
        }

        if (context.explicit) {
            return {
                from: context.pos,
                options: MARKDOWN_SNIPPETS.map(({label, snippet}) =>
                    snippetCompletion(snippet, {label, type: "text", detail: "Markdown syntax"})
                )
            };
        }

        const line = context.state.doc.lineAt(context.pos);
        const beforeCursor = context.state.doc.sliceString(line.from, context.pos);
        const match = MARKDOWN_SNIPPETS.flatMap((snippet) =>
            snippet.triggers.map((trigger) => ({snippet, trigger}))
        )
            .filter(({snippet, trigger}) => {
                if (!beforeCursor.endsWith(trigger)) return false;
                return !snippet.block || beforeCursor.slice(0, -trigger.length).trim().length === 0;
            })
            .sort((left, right) => right.trigger.length - left.trigger.length)[0];
        if (!match) return null;

        return {
            from: context.pos - match.trigger.length,
            options: [
                snippetCompletion(match.snippet.snippet, {
                    label: match.snippet.label,
                    type: "text",
                    detail: "Markdown syntax"
                })
            ],
            filter: false
        };
    };
}
