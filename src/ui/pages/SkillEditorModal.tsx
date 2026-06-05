import {markdown} from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import matter from "gray-matter";
import {Plus, Trash} from "lucide-react";
import React from "react";
import {parseSkillFile} from "src/core/skill-parser/parseSkillFile";
import {SkillFileStore} from "src/core/stores/skill-file-store/SkillFileStore";
import type {SkillFileData} from "src/core/stores/skill-file-store/types";
import {LogseqButton} from "../components/LogseqButton";
import {LogseqCheckbox} from "../components/LogseqCheckbox";
import {Modal} from "../modals/core/Modal";
import {ModalFooter} from "../modals/core/ModalFooter";
import {ModalHeader} from "../modals/core/ModalHeader";
import {useModal} from "../modals/hooks/useModal";
import {UI} from "../UI";

const UNTITLED_FILE_NAME = "Untitled.md";
const INVALID_FILE_NAME_CHARACTERS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?"]);
const NEW_SKILL_CONTENT = `---
name: New skill
description: Describe what this skill does
disable-model-invocation: false
---

# New skill
`;

interface EditableSkillFile {
    id: string;
    content: string;
    originalFileName?: string;
}

export interface SkillEditorModalProps {
    resolve: (value: boolean | null) => void;
    reject: (error: any) => void;
    modalContext?: {modalId: string | null};
}

export const SkillEditorModalComponent: React.FC<SkillEditorModalProps> = ({
    resolve,
    modalContext
}) => {
    const [files, setFiles] = React.useState<EditableSkillFile[]>([]);
    const [originalFileNames, setOriginalFileNames] = React.useState<Set<string>>(new Set());
    const [activeFileId, setActiveFileId] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    const {open, setOpen, returnResult} = useModal<boolean | null>(resolve, {
        onClose: () => UI.hideModal(modalContext?.modalId),
        enableEscapeKey: false,
        enableEnterKey: false,
        enableOutsideClickClose: false,
        defaultResult: null,
        modalId: modalContext?.modalId
    });

    React.useEffect(() => {
        let isMounted = true;

        const loadFiles = async () => {
            const storedFiles = await SkillFileStore.getAllSkillFile();
            if (!isMounted) return;

            const editableFiles = storedFiles.map((file) => ({
                id: crypto.randomUUID(),
                content: file.content,
                originalFileName: getSkillFileName(file)
            }));

            setFiles(editableFiles);
            setOriginalFileNames(
                new Set(
                    editableFiles
                        .map((file) => file.originalFileName)
                        .filter((fileName): fileName is string => fileName != null)
                )
            );
            setActiveFileId(editableFiles[0]?.id ?? null);
            setIsLoading(false);
        };

        loadFiles().catch(async (error) => {
            if (!isMounted) return;
            setIsLoading(false);
            await logseq.UI.showMsg(
                `Failed to load skill files: ${getErrorMessage(error)}`,
                "error"
            );
        });

        return () => {
            isMounted = false;
        };
    }, []);

    const activeFile = files.find((file) => file.id === activeFileId) ?? files[0] ?? null;
    const activeFileMetadata = activeFile ? getSkillFileMetadata(activeFile.content) : null;
    const isActiveFileDefault = activeFileMetadata?.defaultInstalledSkill === true;
    const isModelInvocationEnabled = activeFileMetadata?.disableModelInvocation !== true;

    const handleAddFile = React.useCallback(() => {
        const newFile = {
            id: crypto.randomUUID(),
            content: NEW_SKILL_CONTENT
        };
        setFiles((currentFiles) => [...currentFiles, newFile]);
        setActiveFileId(newFile.id);
    }, []);

    const handleDeleteFile = React.useCallback(() => {
        if (!activeFile || isActiveFileDefault) return;

        setFiles((currentFiles) => {
            const activeIndex = currentFiles.findIndex((file) => file.id === activeFile.id);
            const nextFiles = currentFiles.filter((file) => file.id !== activeFile.id);

            if (activeFileId === activeFile.id) {
                if (nextFiles.length === 0) {
                    setActiveFileId(null);
                } else {
                    const nextActiveIndex = activeIndex > 0 ? activeIndex - 1 : 0;
                    setActiveFileId(nextFiles[nextActiveIndex].id);
                }
            }
            return nextFiles;
        });
    }, [activeFile, activeFileId, isActiveFileDefault]);

    const handleContentChange = React.useCallback(
        (content: string) => {
            if (!activeFile) return;

            setFiles((currentFiles) =>
                currentFiles.map((file) =>
                    file.id === activeFile.id
                        ? {
                              ...file,
                              content
                          }
                        : file
                )
            );
        },
        [activeFile]
    );

    const handleToggleModelInvocation = React.useCallback(() => {
        if (!activeFile || isActiveFileDefault) return;

        const nextEnabled = !isModelInvocationEnabled;
        handleContentChange(updateDisableModelInvocation(activeFile.content, !nextEnabled));
    }, [activeFile, handleContentChange, isActiveFileDefault, isModelInvocationEnabled]);

    const handleSave = React.useCallback(async () => {
        setIsSaving(true);

        try {
            const parsedFiles: SkillFileData[] = [];
            const usedNames = new Set<string>();

            for (const file of files) {
                const fileName = getDisplayFileName(file.content);

                try {
                    const parsedFile = parseSkillFile(file.content);
                    const parsedFileName = getSkillFileName(parsedFile);
                    const normalizedName = parsedFile.name.toLocaleLowerCase();

                    if (!isValidFileName(parsedFileName)) {
                        await logseq.UI.showMsg(
                            `Validation failed in ${fileName}: "${parsedFileName}" is not a valid file name.`,
                            "error"
                        );
                        return;
                    }

                    if (usedNames.has(normalizedName)) {
                        await logseq.UI.showMsg(
                            `Validation failed in ${fileName}: another skill file already uses name "${parsedFile.name}".`,
                            "error"
                        );
                        return;
                    }

                    usedNames.add(normalizedName);
                    parsedFiles.push(parsedFile);
                } catch (error) {
                    await logseq.UI.showMsg(
                        `Validation failed in ${fileName}: ${getErrorMessage(error)}`,
                        "error"
                    );
                    return;
                }
            }

            const nextFileNames = new Set(parsedFiles.map(getSkillFileName));

            for (const originalFileName of originalFileNames) {
                if (!nextFileNames.has(originalFileName)) {
                    await SkillFileStore.deleteSkillFile(originalFileName);
                }
            }

            for (const parsedFile of parsedFiles) {
                await SkillFileStore.saveSkillFile(parsedFile.content);
            }

            returnResult(true);
        } finally {
            setIsSaving(false);
        }
    }, [files, originalFileNames, returnResult]);

    const handleCancel = React.useCallback(() => {
        returnResult(null);
    }, [returnResult]);

    return (
        <Modal
            open={open}
            setOpen={setOpen}
            onClose={() => UI.hideModal(modalContext?.modalId)}
            size="large"
            zDepth="high"
            hasCloseButton={false}
            className="overflow-hidden">
            <div className="flex max-h-[90vh] min-h-[70vh] flex-col text-text">
                <ModalHeader title="Skills Editor" showCloseButton={true} onClose={handleCancel} />

                <div className="min-h-0 flex-1 flex flex-row overflow-hidden border-border border-t">
                    {isLoading ? (
                        <div className="p-4 text-sm opacity-80">Loading skill files...</div>
                    ) : (
                        <>
                            <aside className="w-[220px] flex min-h-0 flex-shrink-0 flex-col border-border border-r bg-secondary-background">
                                <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
                                    <span className="text-sm font-medium">Files</span>
                                    <LogseqButton
                                        onClick={handleAddFile}
                                        color="primary"
                                        size="xs"
                                        title="New skill file">
                                        <Plus size={16} />
                                    </LogseqButton>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                    {files.length === 0 ? (
                                        <div className="px-2 py-3 text-sm opacity-70">
                                            No skill files yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {files.map((file) => {
                                                const isActive = file.id === activeFile?.id;
                                                return (
                                                    <button
                                                        key={file.id}
                                                        type="button"
                                                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                            isActive
                                                                ? "bg-primary-background font-medium shadow-sm border border-border"
                                                                : "bg-transparent text-text hover:bg-tertiary/50"
                                                        }`}
                                                        onClick={() => setActiveFileId(file.id)}>
                                                        <span className="block truncate">
                                                            {getDisplayFileName(file.content)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </aside>

                            <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-primary-background">
                                {activeFile ? (
                                    <>
                                        <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-2 bg-secondary-background">
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-medium">
                                                    {getDisplayFileName(activeFile.content)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <LogseqCheckbox
                                                    checked={isModelInvocationEnabled}
                                                    disabled={isActiveFileDefault}
                                                    onChange={handleToggleModelInvocation}>
                                                    Enabled
                                                </LogseqCheckbox>
                                                <LogseqButton
                                                    onClick={handleDeleteFile}
                                                    color="failed"
                                                    disabled={isActiveFileDefault}
                                                    size="xs"
                                                    title="Delete skill file">
                                                    <Trash size={16} />
                                                </LogseqButton>
                                            </div>
                                        </div>

                                        <div className="min-h-0 flex-1 overflow-hidden">
                                            <CodeMirror
                                                value={activeFile.content}
                                                height="100%"
                                                className="h-full [&>.cm-editor]:h-full"
                                                extensions={[markdown()]}
                                                editable={!isActiveFileDefault}
                                                basicSetup={{
                                                    foldGutter: true,
                                                    lineNumbers: true
                                                }}
                                                onChange={handleContentChange}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-full items-center justify-center bg-primary-background p-4 text-sm text-text opacity-70">
                                        Create a new skill file to start editing.
                                    </div>
                                )}
                            </section>
                        </>
                    )}
                </div>

                <ModalFooter
                    onConfirm={handleSave}
                    onCancel={handleCancel}
                    confirmText={isSaving ? "Saving..." : "Save"}
                    cancelText="Cancel"
                    confirmShortcut=""
                    className="border-border border-t px-4 pb-2 pt-1 !mt-0"
                />
            </div>
        </Modal>
    );
};

function getSkillFileMetadata(
    content: string
): Pick<SkillFileData, "name" | "defaultInstalledSkill" | "disableModelInvocation"> | null {
    try {
        if (!matter.test(content)) {
            return null;
        }

        const parsed = matter(content);
        const name = parsed.data.name;
        const defaultInstalledSkill = parsed.data["default-installed-skill"];
        const disableModelInvocation = parsed.data["disable-model-invocation"];

        return {
            name: typeof name === "string" ? name.trim() : "",
            defaultInstalledSkill:
                typeof defaultInstalledSkill === "boolean" ? defaultInstalledSkill : undefined,
            disableModelInvocation:
                typeof disableModelInvocation === "boolean" ? disableModelInvocation : undefined
        };
    } catch {
        return null;
    }
}

function getDisplayFileName(content: string): string {
    const metadata = getSkillFileMetadata(content);
    return metadata?.name ? `${metadata.name}.md` : UNTITLED_FILE_NAME;
}

function getSkillFileName(skillFileData: Pick<SkillFileData, "name">): string {
    return `${skillFileData.name}.md`;
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

function updateDisableModelInvocation(content: string, disableModelInvocation: boolean): string {
    if (!matter.test(content)) {
        return matter.stringify(content, {
            "disable-model-invocation": disableModelInvocation
        });
    }

    const parsed = matter(content);
    return matter.stringify(parsed.content, {
        ...parsed.data,
        "disable-model-invocation": disableModelInvocation
    });
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
