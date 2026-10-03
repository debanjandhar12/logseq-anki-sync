import {Plus, Trash} from "lucide-react";
import React from "react";
import {SkillStore} from "src/core/stores/skill-store/SkillStore";
import {LogseqButton} from "../../components/LogseqButton";
import {LogseqCheckbox} from "../../components/LogseqCheckbox";
import {LogseqCodeEditor} from "../../components/LogseqCodeEditor";
import {showConfirmModal} from "../../launchers/showConfirmModal";
import {Modal} from "../../modals/core/Modal";
import {ModalFooter} from "../../modals/core/ModalFooter";
import {ModalHeader} from "../../modals/core/ModalHeader";
import {useModal} from "../../modals/hooks/useModal";
import {UI} from "../../UI";
import {createSkillEditorExtensions} from "./createSkillEditorExtensions";
import type {EditableSkillFile} from "./types";
import {createNewSkillContent} from "./utils/createNewSkillContent";
import {getErrorMessage} from "./utils/getErrorMessage";
import {getSkillFileDisplayName} from "./utils/getSkillFileDisplayName";
import {getSkillFileMetadata} from "./utils/getSkillFileMetadata";
import {getFilesSnapshot} from "./utils/skillFilesSnapshot";
import {updateDisableModelInvocation} from "./utils/updateSkillMetadata";
import {validateSkillFilesForSave} from "./utils/validateSkillFiles";

const SKILL_EDITOR_EXTENSIONS = createSkillEditorExtensions();

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
    const [initialFilesSnapshot, setInitialFilesSnapshot] = React.useState("");
    const [originalSkillNames, setOriginalSkillNames] = React.useState<Set<string>>(new Set());
    const [activeFileId, setActiveFileId] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const saveInProgress = React.useRef(false);

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
            const storedFiles = await SkillStore.getAllSkills();
            if (!isMounted) return;

            const editableFiles = storedFiles.map((file) => ({
                id: crypto.randomUUID(),
                content: file.content,
                originalSkillName: file.folderName,
                originalContent: file.content
            }));

            setFiles(editableFiles);
            setInitialFilesSnapshot(getFilesSnapshot(editableFiles));
            setOriginalSkillNames(
                new Set(
                    editableFiles
                        .map((file) => file.originalSkillName)
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
    const originalMetadata = activeFile?.originalContent
        ? getSkillFileMetadata(activeFile.originalContent)
        : null;
    const isActiveFileBuiltIn = originalMetadata?.builtInSkill === true;
    const isActiveFileBuiltInUserControllable =
        isActiveFileBuiltIn && originalMetadata?.builtInSkillUserControllable === true;
    const isModelInvocationEnabled = activeFileMetadata?.disableModelInvocation !== true;
    const hasUnsavedChanges = getFilesSnapshot(files) !== initialFilesSnapshot;

    const handleAddFile = React.useCallback(() => {
        const newFile = {
            id: crypto.randomUUID(),
            content: createNewSkillContent(
                files.map((file) => file.content),
                originalSkillNames
            )
        };
        setFiles((currentFiles) => [...currentFiles, newFile]);
        setActiveFileId(newFile.id);
    }, [files, originalSkillNames]);

    const handleDeleteFile = React.useCallback(() => {
        if (!activeFile || isActiveFileBuiltIn) return;

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
    }, [activeFile, activeFileId, isActiveFileBuiltIn]);

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
        if (!activeFile || (isActiveFileBuiltIn && !isActiveFileBuiltInUserControllable)) return;

        const nextEnabled = !isModelInvocationEnabled;
        handleContentChange(updateDisableModelInvocation(activeFile.content, !nextEnabled));
    }, [
        activeFile,
        handleContentChange,
        isActiveFileBuiltIn,
        isActiveFileBuiltInUserControllable,
        isModelInvocationEnabled
    ]);

    const handleSave = React.useCallback(async () => {
        if (saveInProgress.current || isLoading) return;
        saveInProgress.current = true;
        setIsSaving(true);

        try {
            const {issue} = await validateSkillFilesForSave(files);

            if (issue) {
                setActiveFileId(issue.fileId);
                await logseq.UI.showMsg(
                    `Validation failed in ${issue.fileName}: ${issue.message}`,
                    "error"
                );
                return;
            }

            await SkillStore.saveEditedSkills(files, [...originalSkillNames]);

            returnResult(true);
        } catch (error) {
            await logseq.UI.showMsg(
                `Failed to save skill files: ${getErrorMessage(error)}`,
                "error"
            );
        } finally {
            saveInProgress.current = false;
            setIsSaving(false);
        }
    }, [files, originalSkillNames, returnResult, isLoading]);

    const handleCancel = React.useCallback(async () => {
        if (saveInProgress.current) return;
        if (hasUnsavedChanges) {
            const shouldClose = await showConfirmModal(
                "You have unsaved skill changes. Close without saving?",
                {
                    confirmText: "Close without saving",
                    cancelText: "Keep editing"
                }
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
                <ModalHeader title="Skills Editor" showCloseButton={false} onClose={handleCancel} />

                <div className="min-h-0 flex-1 flex flex-row overflow-hidden border-border border-t">
                    {isLoading ? (
                        <div className="p-4 text-sm opacity-80">Loading skill files...</div>
                    ) : (
                        <>
                            <aside className="w-[220px] flex min-h-0 flex-shrink-0 flex-col border-border border-r bg-secondary-background">
                                <div className="flex items-center justify-between gap-2 border-border border-b px-4 py-2">
                                    <span className="text-sm font-medium">Skills</span>
                                    <LogseqButton
                                        onClick={handleAddFile}
                                        disabled={isSaving}
                                        color="primary"
                                        size="xs"
                                        title="New skill">
                                        <Plus size={16} />
                                    </LogseqButton>
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                    {files.length === 0 ? (
                                        <div className="px-2 py-3 text-sm opacity-70">
                                            No skills yet.
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
                                                            {getSkillFileDisplayName(file.content)}
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
                                                    {getSkillFileDisplayName(activeFile.content)}
                                                </div>
                                                <div className="text-xs opacity-70">
                                                    Name: 1–64 lowercase letters, digits, and single
                                                    separating hyphens.
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <LogseqCheckbox
                                                    checked={isModelInvocationEnabled}
                                                    disabled={
                                                        isSaving ||
                                                        (isActiveFileBuiltIn &&
                                                            !isActiveFileBuiltInUserControllable)
                                                    }
                                                    onChange={handleToggleModelInvocation}>
                                                    Enabled
                                                </LogseqCheckbox>
                                                <LogseqButton
                                                    onClick={handleDeleteFile}
                                                    color="failed"
                                                    disabled={isSaving || isActiveFileBuiltIn}
                                                    size="xs"
                                                    title="Delete skill and its resources">
                                                    <Trash size={16} />
                                                </LogseqButton>
                                            </div>
                                        </div>

                                        <div className="min-h-0 flex-1 overflow-hidden">
                                            <LogseqCodeEditor
                                                key={activeFile.id}
                                                value={activeFile.content}
                                                height="100%"
                                                extensions={SKILL_EDITOR_EXTENSIONS}
                                                basicSetup={{autocompletion: false}}
                                                editable={!isSaving && !isActiveFileBuiltIn}
                                                onChange={handleContentChange}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex h-full items-center justify-center bg-primary-background p-4 text-sm text-text opacity-70">
                                        Create a new skill to start editing SKILL.md.
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
                    confirmDisabled={isSaving || isLoading}
                    cancelDisabled={isSaving}
                    cancelText="Cancel"
                    confirmShortcut=""
                    className="border-border border-t px-4 pb-2 pt-1 !mt-0"
                />
            </div>
        </Modal>
    );
};
