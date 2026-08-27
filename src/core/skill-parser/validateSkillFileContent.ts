import matter from "gray-matter";
import type {SkillFileData} from "../stores/skill-file-store/types";
import {SKILL_FRONTMATTER_FIELDS} from "./constants";
import {readSkillFrontmatterValues} from "./readSkillFrontmatterValues";
import type {SkillFrontmatterFieldDefinition} from "./types";

export interface SkillFileValidationIssue {
    from: number;
    to: number;
    message: string;
}

export type SkillFileValidationResult =
    | {valid: true; skillFile: SkillFileData; issues: readonly []}
    | {
          valid: false;
          skillFile: null;
          issues: readonly SkillFileValidationIssue[];
      };

interface YamlErrorLike {
    reason?: unknown;
    mark?: {position?: unknown};
}

const FRONTMATTER_REQUIRED_MESSAGE = "Invalid skill file structure: frontmatter is required";

export function validateSkillFileContent(content: string): SkillFileValidationResult {
    if (!matter.test(content)) {
        return invalidResult([
            createLineIssue(content, 0, FRONTMATTER_REQUIRED_MESSAGE, {from: 0, to: 0})
        ]);
    }

    let parsed: ReturnType<typeof matter>;
    try {
        // gray-matter caches before YAML parsing, which can cache a partial result when parsing throws.
        parsed = matter(content, {});
    } catch (error) {
        const yamlError = asYamlError(error);
        const matterFrom = getMatterFrom(content);
        const parserPosition =
            typeof yamlError?.mark?.position === "number"
                ? matterFrom + yamlError.mark.position
                : matterFrom;
        const position = movePastLineBreak(content, parserPosition);
        const reason =
            typeof yamlError?.reason === "string"
                ? yamlError.reason
                : error instanceof Error
                  ? error.message
                  : "Invalid YAML";

        return invalidResult([
            createLineIssue(content, position, `Invalid skill file frontmatter: ${reason}`, {
                from: 0,
                to: Math.min(3, content.length)
            })
        ]);
    }

    const matterFrom = getMatterFrom(content, parsed.matter);
    const issues: SkillFileValidationIssue[] = [];

    for (const field of SKILL_FRONTMATTER_FIELDS) {
        const message = getInvalidFieldMessage(field, parsed.data[field.key]);
        if (!message) continue;

        issues.push(
            createMetadataIssue(
                content,
                parsed.matter,
                matterFrom,
                field.key,
                message,
                Object.hasOwn(parsed.data, field.key)
            )
        );
    }

    if (issues.length > 0) return invalidResult(issues);

    const values = readSkillFrontmatterValues(parsed.data);

    return {
        valid: true,
        skillFile: {
            name: values.name as string,
            description: values.description as string,
            content,
            builtInSkill: values.builtInSkill,
            builtInSkillUserControllable: values.builtInSkillUserControllable,
            disableModelInvocation: values.disableModelInvocation
        },
        issues: []
    };
}

function getInvalidFieldMessage(
    field: SkillFrontmatterFieldDefinition,
    value: unknown
): string | null {
    if (field.valueType === "boolean") {
        return value === undefined || typeof value === "boolean"
            ? null
            : `Invalid skill file metadata: ${field.key} must be a boolean`;
    }

    if (typeof value === "string" && value.trim().length > 0) return null;
    if (!field.required && value === undefined) return null;

    return field.required
        ? `Invalid skill file metadata: ${field.key} is required`
        : `Invalid skill file metadata: ${field.key} must be a non-empty string`;
}

// -- Utility methods --
function invalidResult(issues: SkillFileValidationIssue[]): SkillFileValidationResult {
    return {valid: false, skillFile: null, issues};
}

function createMetadataIssue(
    content: string,
    rawMatter: string,
    matterFrom: number,
    key: string,
    message: string,
    locateKey = true
): SkillFileValidationIssue {
    const fallback = {from: 0, to: Math.min(3, content.length)};
    if (!locateKey) return {...fallback, message};

    const keyPattern = new RegExp(
        `^[ \\t]*(?:${escapeRegex(key)}|["']${escapeRegex(key)}["'])\\s*:`,
        "gm"
    );
    const keyMatch = Array.from(rawMatter.matchAll(keyPattern)).reduce<RegExpMatchArray | null>(
        (topLevelMatch, match) =>
            !topLevelMatch || match[0].search(/\S/) < topLevelMatch[0].search(/\S/)
                ? match
                : topLevelMatch,
        null
    );
    if (!keyMatch) return {...fallback, message};

    return createLineIssue(content, matterFrom + keyMatch.index, message, fallback);
}

function createLineIssue(
    content: string,
    position: number,
    message: string,
    fallback: {from: number; to: number}
): SkillFileValidationIssue {
    if (!Number.isFinite(position) || position < 0 || position > content.length) {
        return {...clampRange(content, fallback), message};
    }

    const safePosition = Math.min(position, Math.max(0, content.length - 1));
    const lineFrom = content.lastIndexOf("\n", safePosition - 1) + 1;
    const newlineAt = content.indexOf("\n", safePosition);
    let lineTo = newlineAt < 0 ? content.length : newlineAt;
    if (lineTo > lineFrom && content[lineTo - 1] === "\r") lineTo -= 1;

    const range = lineTo > lineFrom ? {from: lineFrom, to: lineTo} : fallback;
    return {...clampRange(content, range), message};
}

function clampRange(
    content: string,
    range: {from: number; to: number}
): {from: number; to: number} {
    const from = Math.max(0, Math.min(range.from, content.length));
    const to = Math.max(from, Math.min(range.to, content.length));
    return {from, to};
}

function getMatterFrom(content: string, rawMatter?: string): number {
    if (rawMatter !== undefined) {
        const matterFrom = content.indexOf(rawMatter, 3);
        if (matterFrom >= 0) return matterFrom;
    }
    return Math.min(3, content.length);
}

function movePastLineBreak(content: string, position: number): number {
    if (content[position] === "\r" && content[position + 1] === "\n") return position + 2;
    if (content[position] === "\r" || content[position] === "\n") return position + 1;
    return position;
}

function asYamlError(error: unknown): YamlErrorLike | null {
    return typeof error === "object" && error !== null ? (error as YamlErrorLike) : null;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
