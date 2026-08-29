import type {CompletionResult, CompletionSource} from "@codemirror/autocomplete";
import {yamlFrontmatter} from "@codemirror/lang-yaml";
import type {Language, LanguageSupport} from "@codemirror/language";
import {type Diagnostic, linter} from "@codemirror/lint";
import type {Extension} from "@codemirror/state";
import {splitFrontmatter} from "src/core/template-engine";
import {isInsideOpenTag} from "./mustache";

export interface FrontmatterFieldDefinition {
    key: string;
    valueType: "string" | "boolean";
    required?: boolean;
}

export interface FrontmatterCompletionOptions {
    fields: readonly FrontmatterFieldDefinition[];
    mustacheTags?: readonly [string, string];
}

export interface FrontmatterIssue {
    from: number;
    to: number;
    message: string;
}

export function createYamlFrontmatterLanguageSupport(
    content: Language | LanguageSupport
): LanguageSupport {
    return yamlFrontmatter({content});
}

export function getFrontmatterRange(source: string): {from: number; to: number} | null {
    return splitFrontmatter(source).matterRange;
}

export function createFrontmatterLinter(
    validate: (source: string) => readonly FrontmatterIssue[],
    delay = 300
): Extension {
    return linter(
        (view): Diagnostic[] =>
            validate(view.state.doc.toString()).map((issue) => ({
                ...issue,
                severity: "error",
                source: "Frontmatter"
            })),
        {delay}
    );
}

export function createFrontmatterCompletionSource({
    fields,
    mustacheTags
}: FrontmatterCompletionOptions): CompletionSource {
    return (context): CompletionResult | null => {
        if (mustacheTags && isInsideOpenTag(context, mustacheTags)) return null;

        const source = context.state.doc.toString();
        const range = getFrontmatterRange(source);
        if (!range || context.pos < range.from || context.pos > range.to) return null;

        const line = context.state.doc.lineAt(context.pos);
        const beforeCursor = context.state.doc.sliceString(line.from, context.pos);
        const valueMatch = /^\s*([\w-]+)\s*:\s*([\w-]*)$/.exec(beforeCursor);
        if (valueMatch) {
            const field = fields.find(({key}) => key === valueMatch[1]);
            if (field?.valueType !== "boolean") return null;

            return {
                from: context.pos - valueMatch[2].length,
                options: ["true", "false"].map((value) => ({label: value, type: "constant"}))
            };
        }

        const keyMatch = /^(\s*)([\w-]*)$/.exec(beforeCursor);
        if (!keyMatch) return null;

        const existingKeys = new Set(
            source
                .slice(range.from, range.to)
                .split(/\r?\n/)
                .map((frontmatterLine) => /^\s*([\w-]+)\s*:/.exec(frontmatterLine)?.[1])
                .filter((key): key is string => key != null)
        );
        const query = keyMatch[2].toLowerCase();
        const options = fields
            .filter(({key}) => !existingKeys.has(key) && key.toLowerCase().startsWith(query))
            .map(({key, required}) => ({
                label: key,
                apply: `${key}: `,
                type: "property",
                detail: required ? "Required frontmatter field" : "Frontmatter field"
            }));
        if (options.length === 0) return null;

        return {from: context.pos - keyMatch[2].length, options};
    };
}
