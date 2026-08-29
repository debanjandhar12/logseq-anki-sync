import {Plus, Trash} from "lucide-react";
import React from "react";
import {CommandFileStore} from "src/core/stores/command-file-store/CommandFileStore";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";
import {LogseqCodeEditor} from "../../components/LogseqCodeEditor";
import {showConfirmModal} from "../../launchers/showConfirmModal";
import {Modal} from "../../modals/core/Modal";
import {ModalFooter} from "../../modals/core/ModalFooter";
import {ModalHeader} from "../../modals/core/ModalHeader";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";
import {getErrorMessage} from "../SkillEditorModal/utils/getErrorMessage";
import {createCommandEditorExtensions} from "./createCommandEditorExtensions";
import {InvokeConditionTreePopover} from "./InvokeConditionTreePopover";
import type {EditableCommandFile, OriginalBuiltInCommandFile} from "./types";
import {getCommandFilesSnapshot} from "./utils/commandFilesSnapshot";
import {getCommandFileDisplayName} from "./utils/getCommandFileDisplayName";
import {getCommandFileMetadata} from "./utils/getCommandFileMetadata";
import {getCommandFileName} from "./utils/getCommandFileName";
import {
    updateCommandInvokeConditions,
    updateCommandUserInvocable
} from "./utils/updateCommandMetadata";
import {validateCommandFilesForSave} from "./utils/validateCommandFiles";

const NEW_COMMAND_CONTENT = `---
name: New command
invoke-condition:
  - Block Context Menu/Other Blocks
user-invocable: true
command-invoke-in-new-thread: true
---

Write the prompt for this command.
`;
const COMMAND_EDITOR_EXTENSIONS = createCommandEditorExtensions();

export interface CommandEditorModalProps {
    resolve: (value: boolean | null) => void;
    reject: (error: unknown) => void;
    modalContext?: {modalId: string | null};
}

export const CommandEditorModalComponent: React.FC<CommandEditorModalProps> = ({
    resolve,
    modalContext
}) => {
    const [files, setFiles] = React.useState<EditableCommandFile[]>([]);
    const [initialFilesSnapshot, setInitialFilesSnapshot] = React.useState("");
    const [originalFileNames, setOriginalFileNames] = React.useState<Set<string>>(new Set());
    const [originalBuiltIns, setOriginalBuiltIns] = React.useState<OriginalBuiltInCommandFile[]>(
        []
    );
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
        CommandFileStore.getAllCommandFiles()
            .then((storedFiles) => {
                if (!isMounted) return;
                const editableFiles = storedFiles.map((file) => {
                    const fileName = getCommandFileName(file);
                    return {
                        id: crypto.randomUUID(),
                        content: file.content,
                        originalContent: file.content,
                        originalFileName: fileName
                    };
                });
                setFiles(editableFiles);
                setInitialFilesSnapshot(getCommandFilesSnapshot(editableFiles));
                setOriginalFileNames(
                    new Set(editableFiles.map(({originalFileName}) => originalFileName))
                );
                setOriginalBuiltIns(
                    storedFiles
                        .filter(({builtInCommand}) => builtInCommand)
                        .map((file) => ({
                            fileName: getCommandFileName(file),
                            content: file.content
                        }))
                );
                setActiveFileId(editableFiles[0]?.id ?? null);
                setIsLoading(false);
            })
            .catch(async (error) => {
                if (!isMounted) return;
                setIsLoading(false);
                await logseq.UI.showMsg(
                    `Failed to load command files: ${getErrorMessage(error)}`,
                    "error"
                );
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const activeFile = files.find(({id}) => id === activeFileId) ?? files[0] ?? null;
    const activeMetadata = activeFile ? getCommandFileMetadata(activeFile.content) : null;
    const originalMetadata = activeFile?.originalContent
        ? getCommandFileMetadata(activeFile.originalContent)
        : null;
    const isActiveFileBuiltIn = originalMetadata?.builtInCommand === true;
    const canToggleEnabled =
        !isActiveFileBuiltIn || originalMetadata?.builtInCommandUserControllable === true;
    const isUserInvocable = activeMetadata?.userInvocable !== false;
    const hasUnsavedChanges = getCommandFilesSnapshot(files) !== initialFilesSnapshot;

    const handleContentChange = React.useCallback(
        (content: string) => {
            if (!activeFile) return;
            setFiles((current) =>
                current.map((file) => (file.id === activeFile.id ? {...file, content} : file))
            );
        },
        [activeFile]
    );

    const handleAddFile = React.useCallback(() => {
        const newFile = {id: crypto.randomUUID(), content: NEW_COMMAND_CONTENT};
        setFiles((current) => [...current, newFile]);
        setActiveFileId(newFile.id);
    }, []);

    const handleDeleteFile = React.useCallback(() => {
        if (!activeFile || isActiveFileBuiltIn) return;
        setFiles((current) => {
            const activeIndex = current.findIndex(({id}) => id === activeFile.id);
            const next = current.filter(({id}) => id !== activeFile.id);
            setActiveFileId(next[Math.max(0, activeIndex - 1)]?.id ?? null);
            return next;
        });
    }, [activeFile, isActiveFileBuiltIn]);

    const handleToggleEnabled = React.useCallback(() => {
        if (!activeFile || !canToggleEnabled) return;
        handleContentChange(updateCommandUserInvocable(activeFile.content, !isUserInvocable));
    }, [activeFile, canToggleEnabled, handleContentChange, isUserInvocable]);

    const handleSave = React.useCallback(async () => {
        setIsSaving(true);
        try {
            const {issue, parsedFiles} = await validateCommandFilesForSave(files, originalBuiltIns);
            if (issue) {
                if (issue.fileId) setActiveFileId(issue.fileId);
                await logseq.UI.showMsg(
                    `Validation failed in ${issue.fileName}: ${issue.message}`,
                    "error"
                );
                return;
            }

            const nextFileNames = new Set(parsedFiles.map(getCommandFileName));
            for (const originalFileName of originalFileNames) {
                if (!nextFileNames.has(originalFileName)) {
                    await CommandFileStore.deleteCommandFile(originalFileName);
                }
            }
            for (const parsedFile of parsedFiles) {
                await CommandFileStore.saveCommandFile(parsedFile.content);
            }
            returnResult(true);
        } catch (error) {
            await logseq.UI.showMsg(
                `Failed to save command files: ${getErrorMessage(error)}`,
                "error"
            );
        } finally {
            setIsSaving(false);
        }
    }, [files, originalBuiltIns, originalFileNames, returnResult]);

    const handleCancel = React.useCallback(async () => {
        if (hasUnsavedChanges) {
            const shouldClose = await showConfirmModal(
                "You have unsaved command changes. Close without saving?",
                {confirmText: "Close without saving", cancelText: "Keep editing"}
            );
            if (!shouldClose) return;
        }
        returnResult(null);
    }, [hasUnsavedChanges, returnResult]);

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
                <ModalHeader
                    title="Command Editor"
                    showCloseButton={false}
                    onClose={handleCancel}
                />
                <div className="min-h-0 flex-1 flex flex-row overflow-hidden border-border border-t">
                    {isLoading ? (
                        <div className="p-4 text-sm opacity-80">Loading command files...</div>
                    ) : (
                        <>
                            <aside className="w-[220px] flex min-h-0 flex-shrink-0 flex-col border-border border-r bg-secondary-background">
                                <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
                                    <span className="text-sm font-medium">Files</span>
                                    <LogseqButton
                                        onClick={handleAddFile}
                                        color="primary"
                                        size="xs"
                                        title="New command file">
                                        <Plus size={16} />
                                    </LogseqButton>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                    {files.length === 0 ? (
                                        <div className="px-2 py-3 text-sm opacity-70">
                                            No command files yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {files.map((file) => (
                                                <button
                                                    key={file.id}
                                                    type="button"
                                                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                        file.id === activeFile?.id
                                                            ? "bg-primary-background font-medium shadow-sm border border-border"
                                                            : "bg-transparent text-text hover:bg-tertiary/50"
                                                    }`}
                                                    onClick={() => setActiveFileId(file.id)}>
                                                    <span className="block truncate">
                                                        {getCommandFileDisplayName(file.content)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </aside>
                            <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-primary-background">
                                {activeFile ? (
                                    <>
                                        <div className="flex items-center justify-between gap-3 border-border border-b bg-secondary-background px-4 py-2">
                                            <div className="min-w-0 truncate text-sm font-medium">
                                                {getCommandFileDisplayName(activeFile.content)}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <LogseqCheckbox
                                                    checked={isUserInvocable}
                                                    disabled={!canToggleEnabled}
                                                    onChange={handleToggleEnabled}>
                                                    Enabled
                                                </LogseqCheckbox>
                                                <InvokeConditionTreePopover
                                                    value={activeMetadata?.invokeConditions ?? []}
                                                    readOnly={isActiveFileBuiltIn}
                                                    onValueChange={(conditions) => {
                                                        if (isActiveFileBuiltIn) return;
                                                        handleContentChange(
                                                            updateCommandInvokeConditions(
                                                                activeFile.content,
                                                                conditions
                                                            )
                                                        );
                                                    }}
                                                />
                                                <LogseqButton
                                                    onClick={handleDeleteFile}
                                                    color="failed"
                                                    disabled={isActiveFileBuiltIn}
                                                    size="xs"
                                                    title="Delete command file">
                                                    <Trash size={16} />
                                                </LogseqButton>
                                            </div>
                                        </div>
                                        <div className="min-h-0 flex-1 overflow-hidden">
                                            <LogseqCodeEditor
                                                value={activeFile.content}
                                                height="100%"
                                                extensions={COMMAND_EDITOR_EXTENSIONS}
                                                basicSetup={{autocompletion: false}}
                                                editable={!isActiveFileBuiltIn}
                                                onChange={handleContentChange}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-full items-center justify-center p-4 text-sm opacity-70">
                                        Create a new command file to start editing.
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
