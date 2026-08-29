import matter from "gray-matter";
import {COMMAND_FRONTMATTER_KEYS, parseCommandFile} from "src/core/command-parser";
import type {CommandFileData} from "src/core/stores/command-file-store/types";
import type {MustacheTemplateIssue} from "src/core/template-engine";
import {validateFrontmatterTemplate} from "src/core/template-engine";
import {getErrorMessage} from "../../SkillEditorModal/utils/getErrorMessage";
import type {EditableCommandFile, OriginalBuiltInCommandFile} from "../types";
import {getCommandFileDisplayName} from "./getCommandFileDisplayName";
import {getCommandFileName} from "./getCommandFileName";

const INVALID_FILE_NAME_CHARACTERS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?"]);

export type CommandFileSaveIssueKind =
    | "invalid-template"
    | "invalid-file-name"
    | "duplicate-name"
    | "parse-error"
    | "built-in-modified"
    | "built-in-deleted";

export interface CommandFileSaveIssue {
    kind: CommandFileSaveIssueKind;
    fileId: string;
    fileName: string;
    message: string;
}

export interface ValidatedCommandFilesForSave {
    issue: CommandFileSaveIssue | null;
    parsedFiles: CommandFileData[];
}

export async function getFirstInvalidCommandTemplate(
    files: readonly Pick<EditableCommandFile, "id" | "content">[]
): Promise<{fileId: string; issue: MustacheTemplateIssue} | null> {
    for (const file of files) {
        const issue = (await validateFrontmatterTemplate(file.content))[0];
        if (issue) return {fileId: file.id, issue};
    }
    return null;
}

export async function validateCommandFilesForSave(
    files: readonly EditableCommandFile[],
    originalBuiltIns: readonly OriginalBuiltInCommandFile[] = []
): Promise<ValidatedCommandFilesForSave> {
    const invalidTemplate = await getFirstInvalidCommandTemplate(files);
    if (invalidTemplate) {
        const file = files.find(({id}) => id === invalidTemplate.fileId);
        if (file) {
            return invalid({
                kind: "invalid-template",
                fileId: file.id,
                fileName: getCommandFileDisplayName(file.content),
                message: invalidTemplate.issue.message
            });
        }
    }

    const parsedFiles: CommandFileData[] = [];
    const usedNames = new Set<string>();

    for (const file of files) {
        const displayFileName = getCommandFileDisplayName(file.content);
        try {
            const parsedFile = parseCommandFile(file.content);
            const parsedFileName = getCommandFileName(parsedFile);
            if (!isValidFileName(parsedFileName)) {
                return invalid({
                    kind: "invalid-file-name",
                    fileId: file.id,
                    fileName: displayFileName,
                    message: `"${parsedFileName}" is not a valid file name.`
                });
            }

            const normalizedName = parsedFile.name.toLocaleLowerCase();
            if (usedNames.has(normalizedName)) {
                return invalid({
                    kind: "duplicate-name",
                    fileId: file.id,
                    fileName: displayFileName,
                    message: `another command file already uses name "${parsedFile.name}".`
                });
            }

            if (file.originalContent && parseCommandFile(file.originalContent).builtInCommand) {
                if (!isAllowedBuiltInChange(file.originalContent, file.content)) {
                    return invalid({
                        kind: "built-in-modified",
                        fileId: file.id,
                        fileName: displayFileName,
                        message:
                            "built-in commands are read-only except for an explicitly controllable Enabled setting."
                    });
                }
            }

            usedNames.add(normalizedName);
            parsedFiles.push(parsedFile);
        } catch (error) {
            return invalid({
                kind: "parse-error",
                fileId: file.id,
                fileName: displayFileName,
                message: getErrorMessage(error)
            });
        }
    }

    const currentOriginalNames = new Set(files.map(({originalFileName}) => originalFileName));
    const deletedBuiltIn = originalBuiltIns.find(
        ({fileName}) => !currentOriginalNames.has(fileName)
    );
    if (deletedBuiltIn) {
        return invalid({
            kind: "built-in-deleted",
            fileId: "",
            fileName: deletedBuiltIn.fileName,
            message: "built-in commands cannot be deleted."
        });
    }

    return {issue: null, parsedFiles};
}

function isAllowedBuiltInChange(originalSource: string, nextSource: string): boolean {
    const original = parseCommandFile(originalSource);
    const next = parseCommandFile(nextSource);
    if (!original.builtInCommand || !next.builtInCommand) return false;

    const originalMatter = matter(originalSource);
    const nextMatter = matter(nextSource);
    if (original.builtInCommandUserControllable) {
        delete originalMatter.data[COMMAND_FRONTMATTER_KEYS.userInvocable];
        delete nextMatter.data[COMMAND_FRONTMATTER_KEYS.userInvocable];
    }

    return (
        originalMatter.content === nextMatter.content &&
        JSON.stringify(originalMatter.data) === JSON.stringify(nextMatter.data)
    );
}

function invalid(issue: CommandFileSaveIssue): ValidatedCommandFilesForSave {
    return {issue, parsedFiles: []};
}

function isValidFileName(fileName: string): boolean {
    return (
        fileName.trim() === fileName &&
        fileName.length > 0 &&
        fileName !== "." &&
        fileName !== ".." &&
        Array.from(fileName).every(
            (character) =>
                character.charCodeAt(0) >= 32 && !INVALID_FILE_NAME_CHARACTERS.has(character)
        )
    );
}
