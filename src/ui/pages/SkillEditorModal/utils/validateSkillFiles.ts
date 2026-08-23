import {parseSkillFile} from "src/core/skill-parser/parseSkillFile";
import type {SkillFileData} from "src/core/stores/skill-file-store/types";
import {validateMustacheTemplate} from "src/core/template-engine";
import type {EditableSkillFile} from "../types";
import {getErrorMessage} from "./getErrorMessage";
import {getDisplayFileName, getSkillFileName} from "./skillFileFrontmatter";

const INVALID_FILE_NAME_CHARACTERS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?"]);

export function getFirstInvalidSkillTemplate(
    files: readonly Pick<EditableSkillFile, "id" | "content">[]
): {fileId: string; issue: ReturnType<typeof validateMustacheTemplate>[number]} | null {
    for (const file of files) {
        const issue = validateMustacheTemplate(file.content)[0];
        if (issue) return {fileId: file.id, issue};
    }

    return null;
}

export type SkillFileSaveIssueKind =
    | "invalid-template"
    | "invalid-file-name"
    | "duplicate-name"
    | "parse-error";

export interface SkillFileSaveIssue {
    kind: SkillFileSaveIssueKind;
    fileId: string;
    fileName: string;
    message: string;
}

export interface ValidatedSkillFilesForSave {
    issue: SkillFileSaveIssue | null;
    parsedFiles: SkillFileData[];
}

export function validateSkillFilesForSave(
    files: readonly Pick<EditableSkillFile, "id" | "content">[]
): ValidatedSkillFilesForSave {
    const invalidTemplate = getFirstInvalidSkillTemplate(files);

    if (invalidTemplate) {
        const invalidFile = files.find((file) => file.id === invalidTemplate.fileId);
        if (invalidFile) {
            return {
                issue: {
                    kind: "invalid-template",
                    fileId: invalidFile.id,
                    fileName: getDisplayFileName(invalidFile.content),
                    message: invalidTemplate.issue.message
                },
                parsedFiles: []
            };
        }
    }

    const parsedFiles: SkillFileData[] = [];
    const usedNames = new Set<string>();

    for (const file of files) {
        const displayFileName = getDisplayFileName(file.content);

        try {
            const parsedFile = parseSkillFile(file.content);
            const parsedFileName = getSkillFileName(parsedFile);
            const normalizedName = parsedFile.name.toLocaleLowerCase();

            if (!isValidFileName(parsedFileName)) {
                return {
                    issue: {
                        kind: "invalid-file-name",
                        fileId: file.id,
                        fileName: displayFileName,
                        message: `"${parsedFileName}" is not a valid file name.`
                    },
                    parsedFiles: []
                };
            }

            if (usedNames.has(normalizedName)) {
                return {
                    issue: {
                        kind: "duplicate-name",
                        fileId: file.id,
                        fileName: displayFileName,
                        message: `another skill file already uses name "${parsedFile.name}".`
                    },
                    parsedFiles: []
                };
            }

            usedNames.add(normalizedName);
            parsedFiles.push(parsedFile);
        } catch (error) {
            return {
                issue: {
                    kind: "parse-error",
                    fileId: file.id,
                    fileName: displayFileName,
                    message: getErrorMessage(error)
                },
                parsedFiles: []
            };
        }
    }

    return {issue: null, parsedFiles};
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
