import Mustache from "mustache";
import {MUSTACHE_TEMPLATE_TAGS} from "./constants";
import {getMustacheTemplateVariableNames} from "./MustacheView";

type MustacheToken = [string, string, number, number, MustacheToken[]?];

export interface MustacheTemplateIssue {
    from: number;
    to: number;
    message: string;
    variableName?: string;
}

const SUPPORTED_VARIABLE_NAMES = new Set(
    getMustacheTemplateVariableNames().map((name) => name.toLowerCase())
);

function clampOffset(offset: number, source: string): number {
    return Math.max(0, Math.min(offset, source.length));
}

function getSyntaxIssue(error: unknown, source: string): MustacheTemplateIssue {
    const message = error instanceof Error ? error.message : String(error);
    const reportedOffset = /\bat\s+(\d+)\b/.exec(message)?.[1];
    const parsedOffset = reportedOffset == null ? source.length : Number(reportedOffset);
    const offset = clampOffset(
        Number.isFinite(parsedOffset) ? parsedOffset : source.length,
        source
    );
    const openingTag = source.lastIndexOf(MUSTACHE_TEMPLATE_TAGS[0], offset);
    const from = openingTag >= 0 ? openingTag : Math.max(0, offset - 1);
    const lineEnd = source.indexOf("\n", Math.max(from, offset));

    return {
        from,
        to: Math.max(from + 1, lineEnd >= 0 ? lineEnd : source.length),
        message: `Invalid Mustache syntax: ${message}`
    };
}

function collectIssues(tokens: MustacheToken[], issues: MustacheTemplateIssue[]): void {
    for (const token of tokens) {
        const [type, rawName, from, to, children] = token;

        if (type === "=") {
            issues.push({
                from,
                to,
                message: "Changing Mustache delimiters is not supported. Use <% variable %>."
            });
        } else if (type === "name" || type === "&") {
            const variableName = rawName.trim();
            if (!SUPPORTED_VARIABLE_NAMES.has(variableName.toLowerCase())) {
                issues.push({
                    from,
                    to,
                    variableName,
                    message: `Unknown Mustache variable: ${variableName}`
                });
            }
        }

        if (children) collectIssues(children, issues);
    }
}

export function validateMustacheTemplate(source: string): MustacheTemplateIssue[] {
    try {
        const issues: MustacheTemplateIssue[] = [];
        collectIssues(
            Mustache.parse(source, [...MUSTACHE_TEMPLATE_TAGS]) as unknown as MustacheToken[],
            issues
        );
        return issues;
    } catch (error) {
        return [getSyntaxIssue(error, source)];
    }
}
