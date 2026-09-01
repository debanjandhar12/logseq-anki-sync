import matter from "gray-matter";
import type {CommandFileData, CommandInvokeLocation} from "../stores/command-file-store/types";
import {COMMAND_FRONTMATTER_FIELDS, COMMAND_INVOKE_LOCATIONS} from "./constants";
import {readCommandFrontmatterValues} from "./readCommandFrontmatterValues";
import type {CommandFrontmatterFieldDefinition} from "./types";

export interface CommandFileValidationIssue {
    from: number;
    to: number;
    message: string;
}

export type CommandFileValidationResult =
    | {valid: true; commandFile: CommandFileData; issues: readonly []}
    | {
          valid: false;
          commandFile: null;
          issues: readonly CommandFileValidationIssue[];
      };

interface YamlErrorLike {
    reason?: unknown;
    mark?: {position?: unknown};
}

const FRONTMATTER_REQUIRED_MESSAGE = "Invalid command file structure: frontmatter is required";
const INVOKE_LOCATION_KEY = "invoke-location";
const invokeLocationSet = new Set<string>(COMMAND_INVOKE_LOCATIONS);

export function validateCommandFileContent(content: string): CommandFileValidationResult {
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
            createLineIssue(content, position, `Invalid command file frontmatter: ${reason}`, {
                from: 0,
                to: Math.min(3, content.length)
            })
        ]);
    }

    const matterFrom = getMatterFrom(content, parsed.matter);
    const issues: CommandFileValidationIssue[] = [];

    for (const field of COMMAND_FRONTMATTER_FIELDS) {
        if (field.dataKey === "invokeLocations") continue;
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

    issues.push(
        ...validateInvokeLocations(
            content,
            parsed.matter,
            matterFrom,
            parsed.data[INVOKE_LOCATION_KEY]
        )
    );

    if (issues.length > 0) return invalidResult(issues);

    const values = readCommandFrontmatterValues(parsed.data);
    return {
        valid: true,
        commandFile: {
            name: values.name as string,
            invokeLocations: values.invokeLocations as CommandInvokeLocation[],
            userInvocable: values.userInvocable !== false,
            commandInvokeInNewThread: values.commandInvokeInNewThread !== false,
            commandAppearSeparatelyInContextMenu:
                values.commandAppearSeparatelyInContextMenu === true,
            builtInCommand: values.builtInCommand,
            builtInCommandUserControllable: values.builtInCommandUserControllable,
            content
        },
        issues: []
    };
}

function validateInvokeLocations(
    content: string,
    rawMatter: string,
    matterFrom: number,
    value: unknown
): CommandFileValidationIssue[] {
    if (!Array.isArray(value) || value.length === 0) {
        const message = Array.isArray(value)
            ? "Invalid command file metadata: invoke-location must contain at least one value"
            : "Invalid command file metadata: invoke-location must be a non-empty array";
        return [
            createMetadataIssue(
                content,
                rawMatter,
                matterFrom,
                INVOKE_LOCATION_KEY,
                message,
                value !== undefined
            )
        ];
    }

    const occurrenceCounts = new Map<string, number>();
    const issues: CommandFileValidationIssue[] = [];
    for (const location of value) {
        const locationKey = String(location);
        const occurrence = (occurrenceCounts.get(locationKey) ?? 0) + 1;
        occurrenceCounts.set(locationKey, occurrence);
        if (typeof location !== "string" || !invokeLocationSet.has(location)) {
            issues.push(
                createArrayValueIssue(
                    content,
                    rawMatter,
                    matterFrom,
                    location,
                    `Invalid command file metadata: unsupported invoke location: ${locationKey}`,
                    occurrence
                )
            );
            continue;
        }
        if (occurrence > 1) {
            issues.push(
                createArrayValueIssue(
                    content,
                    rawMatter,
                    matterFrom,
                    location,
                    `Invalid command file metadata: duplicate invoke location: ${location}`,
                    occurrence
                )
            );
        }
    }
    return issues;
}

function getInvalidFieldMessage(
    field: CommandFrontmatterFieldDefinition,
    value: unknown
): string | null {
    if (field.valueType === "boolean") {
        return value === undefined || typeof value === "boolean"
            ? null
            : `Invalid command file metadata: ${field.key} must be a boolean`;
    }
    if (field.valueType === "string-array") return null;
    if (typeof value === "string" && value.trim().length > 0) return null;
    if (!field.required && value === undefined) return null;
    return field.required
        ? `Invalid command file metadata: ${field.key} is required`
        : `Invalid command file metadata: ${field.key} must be a non-empty string`;
}

function invalidResult(issues: CommandFileValidationIssue[]): CommandFileValidationResult {
    return {valid: false, commandFile: null, issues};
}

function createArrayValueIssue(
    content: string,
    rawMatter: string,
    matterFrom: number,
    value: unknown,
    message: string,
    occurrence = 1
): CommandFileValidationIssue {
    const escapedValue = escapeRegex(String(value));
    const sequenceRange = getSequenceRange(rawMatter, INVOKE_LOCATION_KEY);
    if (!sequenceRange) {
        return createMetadataIssue(content, rawMatter, matterFrom, INVOKE_LOCATION_KEY, message);
    }
    const valuePattern = new RegExp(
        `^[ \\t]*-[ \\t]+(?:${escapedValue}|["']${escapedValue}["'])[ \\t]*\\r?$`,
        "gm"
    );
    const sequence = rawMatter.slice(sequenceRange.from, sequenceRange.to);
    const matches = Array.from(sequence.matchAll(valuePattern));
    const match = matches[Math.min(occurrence - 1, matches.length - 1)];
    if (!match) {
        return createMetadataIssue(content, rawMatter, matterFrom, INVOKE_LOCATION_KEY, message);
    }
    return createLineIssue(content, matterFrom + sequenceRange.from + match.index, message, {
        from: 0,
        to: Math.min(3, content.length)
    });
}

function getSequenceRange(rawMatter: string, key: string): {from: number; to: number} | null {
    const keyPattern = new RegExp(
        `^([ \\t]*)(?:${escapeRegex(key)}|["']${escapeRegex(key)}["'])\\s*:.*(?:\\r?\\n|$)`,
        "gm"
    );
    const keyMatch = Array.from(rawMatter.matchAll(keyPattern)).reduce<RegExpMatchArray | null>(
        (topLevelMatch, match) =>
            !topLevelMatch || match[1].length < topLevelMatch[1].length ? match : topLevelMatch,
        null
    );
    if (!keyMatch) return null;

    const keyIndent = keyMatch[1].length;
    const from = keyMatch.index + keyMatch[0].length;
    let to = rawMatter.length;
    const followingLines = rawMatter.slice(from).matchAll(/^([ \t]*)(.*?)(?:\r?\n|$)/gm);
    for (const line of followingLines) {
        if (!line[2].trim() || line[2].trimStart().startsWith("#")) continue;
        if (line[1].length <= keyIndent) {
            to = from + line.index;
            break;
        }
    }
    return {from, to};
}

function createMetadataIssue(
    content: string,
    rawMatter: string,
    matterFrom: number,
    key: string,
    message: string,
    locateKey = true
): CommandFileValidationIssue {
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
): CommandFileValidationIssue {
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
