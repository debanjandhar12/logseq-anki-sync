import {
    autocompletion,
    type Completion,
    type CompletionContext,
    type CompletionResult,
    type CompletionSource,
    snippetCompletion
} from "@codemirror/autocomplete";
import {markdown} from "@codemirror/lang-markdown";
import {type Diagnostic, linter, lintGutter} from "@codemirror/lint";
import type {Extension} from "@codemirror/state";
import {
    MUSTACHE_TEMPLATE_VARIABLES,
    type MustacheTemplateVariableDefinition
} from "src/core/template-engine/mustacheTemplateVariables";
import {validateMustacheTemplate} from "src/core/template-engine/validateMustacheTemplate";

interface MustacheCompletionContext {
    from: number;
    to: number;
    query: string;
}

interface MarkdownSnippet {
    label: string;
    snippet: string;
    triggers: readonly string[];
    block?: boolean;
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
        snippet: `\`\`\` ${snippetField("language")}\n${snippetField("Code")}\n\`\`\``,
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

function getMustacheCompletions(definition: MustacheTemplateVariableDefinition): Completion[] {
    return [definition.canonicalName, ...definition.aliases].map((name) => ({
        label: `<% ${name} %>`,
        apply: `<% ${name} %>`,
        type: "variable",
        detail:
            name === definition.canonicalName
                ? definition.description
                : `Alias for ${definition.canonicalName}`
    }));
}

const MUSTACHE_COMPLETIONS = MUSTACHE_TEMPLATE_VARIABLES.flatMap(getMustacheCompletions);

function getMustacheCompletionContext(
    context: CompletionContext
): MustacheCompletionContext | null {
    const line = context.state.doc.lineAt(context.pos);
    const beforeCursor = context.state.doc.sliceString(line.from, context.pos);
    const openingIndex = beforeCursor.lastIndexOf("<%");
    if (openingIndex < 0) return null;

    const from = line.from + openingIndex;
    const tagPrefix = beforeCursor.slice(openingIndex + 2);
    if (tagPrefix.includes("%>")) return null;

    const trimmedPrefix = tagPrefix.trimStart();
    if (trimmedPrefix && !/^[A-Za-z][\w -]*$/.test(trimmedPrefix)) return null;

    const afterCursor = context.state.doc.sliceString(context.pos, line.to);
    const closingMatch = /^\s*%>/.exec(afterCursor);
    return {
        from,
        to: closingMatch ? context.pos + closingMatch[0].length : context.pos,
        query: trimmedPrefix.toLowerCase()
    };
}

export const mustacheVariableCompletionSource: CompletionSource = (
    context
): CompletionResult | null => {
    const tag = getMustacheCompletionContext(context);
    if (!tag) return null;

    const options = MUSTACHE_COMPLETIONS.filter((option) =>
        option.label.slice(3, -3).toLowerCase().startsWith(tag.query)
    );
    if (options.length === 0) return null;

    return {from: tag.from, to: tag.to, options, filter: false};
};

function isInFrontmatter(context: CompletionContext): boolean {
    const sourceBeforeCursor = context.state.doc.sliceString(0, context.pos);
    if (!sourceBeforeCursor.startsWith("---\n")) return false;
    return sourceBeforeCursor.indexOf("\n---", 4) < 0;
}

function isInCode(context: CompletionContext): boolean {
    const beforeCursor = context.state.doc.sliceString(0, context.pos);
    const line = context.state.doc.lineAt(context.pos);
    const linePrefix = context.state.doc.sliceString(line.from, context.pos);
    if (linePrefix.trimStart() === "```") return false;

    const fenceCount = beforeCursor.match(/^\s*```/gm)?.length ?? 0;
    if (fenceCount % 2 === 1) return true;

    const inlineCodeDelimiterCount = linePrefix.match(/`/g)?.length ?? 0;
    return inlineCodeDelimiterCount > 1 && inlineCodeDelimiterCount % 2 === 1;
}

function isInsideMustache(context: CompletionContext): boolean {
    const line = context.state.doc.lineAt(context.pos);
    const beforeCursor = context.state.doc.sliceString(line.from, context.pos);
    const openingIndex = beforeCursor.lastIndexOf("<%");
    return openingIndex >= 0 && !beforeCursor.slice(openingIndex + 2).includes("%>");
}

export const markdownSyntaxCompletionSource: CompletionSource = (
    context
): CompletionResult | null => {
    if (isInFrontmatter(context) || isInCode(context) || isInsideMustache(context)) return null;

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
    const matchingTrigger = MARKDOWN_SNIPPETS.flatMap((snippet) =>
        snippet.triggers.map((trigger) => ({snippet, trigger}))
    )
        .filter(({snippet, trigger}) => {
            if (!beforeCursor.endsWith(trigger)) return false;
            if (!snippet.block) return true;
            return beforeCursor.slice(0, -trigger.length).trim().length === 0;
        })
        .sort((left, right) => right.trigger.length - left.trigger.length)[0];
    if (!matchingTrigger) return null;

    return {
        from: context.pos - matchingTrigger.trigger.length,
        options: [
            snippetCompletion(matchingTrigger.snippet.snippet, {
                label: matchingTrigger.snippet.label,
                type: "text",
                detail: "Markdown syntax"
            })
        ],
        filter: false
    };
};

function getMustacheDiagnostics(source: string): Diagnostic[] {
    return validateMustacheTemplate(source).map((issue) => ({
        from: issue.from,
        to: issue.to,
        severity: "error",
        source: "Mustache",
        message: issue.message
    }));
}

export function createSkillEditorExtensions(): Extension[] {
    return [
        markdown({completeHTMLTags: false}),
        autocompletion({
            override: [mustacheVariableCompletionSource, markdownSyntaxCompletionSource]
        }),
        linter((view) => getMustacheDiagnostics(view.state.doc.toString()), {delay: 300}),
        lintGutter()
    ];
}
