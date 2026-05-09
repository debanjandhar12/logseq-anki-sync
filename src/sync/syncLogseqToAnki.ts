import "@logseq/libs";
import {CancelablePromise} from "cancelable-promise";
import WARNING_ICON from "../../node_modules/@tabler/icons/icons/outline/alert-circle.svg?raw";
import SUCCESS_ICON from "../../node_modules/@tabler/icons/icons/outline/circle-check.svg?raw";
import pkg from "../../package.json";
import * as AnkiConnect from "../anki-connect/AnkiConnect";
import {LazyAnkiNoteManager} from "../anki-connect/LazyAnkiNoteManager";
import {ClozeNote} from "../anki-notes/ClozeNote";
import {HighlightMaskNote} from "../anki-notes/HighlightMaskNote";
import {ImageOcclusionNote} from "../anki-notes/ImageOcclusionNote";
import {MultilineCardNote} from "../anki-notes/MultilineCardNote";
import {Note} from "../anki-notes/Note";
import {SwiftArrowNote} from "../anki-notes/SwiftArrowNote";
import {
    getTemplateBack,
    getTemplateFront,
    getTemplateMediaFiles
} from "../anki-template/AnkiCardTemplates";
import {createLogger, LoggerCategory} from "../logger";
import {LogseqAppInfoFetcher} from "../logseq/LogseqAppInfoFetcher";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {WindowParentBridge} from "../logseq/WindowParentBridge";
import {
    ProgressNotification,
    showConfirmModal,
    showSyncResultDialog,
    showSyncSelectionDialog
} from "../ui";
import {ActionNotification} from "../ui/notifications/ActionNotification";
import {handleAnkiError, sortAsync} from "../utils/utils";
import {NoteHashCalculator} from "./cache";
import {CreateNotesTask} from "./tasks/CreateNotesTask";
import {DeleteNotesTask} from "./tasks/DeleteNotesTask";
import {SuspendUnsuspendNotesTask} from "./tasks/SuspendUnsuspendNotesTask";
import {UpdateNotesTask} from "./tasks/UpdateNotesTask";
import type {SyncResult} from "./types";

const logger = createLogger(LoggerCategory.SyncMain);

export class LogseqToAnkiSync {
    static isSyncing: boolean;
    graphName: string;
    modelName: string;

    public async sync(): Promise<void> {
        // if (await LogseqProxy.App.checkCurrentIsDbGraph()  === true) {
        //     await logseq.UI.showMsg("Anki sync not supported in DB Graphs yet.\nDevelopment to support it is going on in db branch.", "error");
        //     return;
        // }
        if (!LogseqAppInfoFetcher.checkHostAccess()) {
            const settings = LogseqProxy.Settings.getPluginSettings();
            if (!settings.enableExperimentalWebSync) {
                await logseq.UI.showMsg(
                    "Syncing is not supported in Logseq Web since plugin cannot read image files at the moment.",
                    "error"
                );
                return;
            }
        }
        if (LogseqToAnkiSync.isSyncing) {
            logger.info("Syncing already in process");
            return;
        }
        LogseqToAnkiSync.isSyncing = true;
        try {
            await this.performSync();
        } catch (e) {
            handleAnkiError(e.toString());
            logseq.provideUI({
                key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`,
                template: ``
            });
            logger.error("Sync failed", e);
        } finally {
            this.completeSyncCleanup();
            LogseqToAnkiSync.isSyncing = false;
        }
    }

    private async performSync(): Promise<void> {
        this.graphName = await this.getGraphName();
        this.modelName = this.getModelName();
        logger.success(`Starting Logseq to Anki Sync V${pkg.version} for graph ${this.graphName}`);

        await this.setupAnkiModel();
        const ankiNoteManager = await this.initializeAnkiNoteManager();

        const notes = await this.collectAllNotes();
        await this.persistLogseqBlockIds(notes);

        const syncPlan = await this.createSyncPlan(notes, ankiNoteManager);
        const {toCreateNotesOriginal, toUpdateNotesOriginal, toDeleteNotesOriginal} = syncPlan;

        const confirmation = await this.getUserConfirmation(
            toCreateNotesOriginal,
            toUpdateNotesOriginal,
            toDeleteNotesOriginal,
            notes
        );

        if (!confirmation) return;

        const {toCreateNotes, toUpdateNotes, toDeleteNotes} = confirmation;
        const syncResult = await this.executeSyncPlan(
            toCreateNotes,
            toUpdateNotes,
            toDeleteNotes,
            ankiNoteManager
        );

        await this.performPostSyncCleanup(syncResult.toCreateNotes);

        WindowParentBridge.dispatchLogseqAnkiSyncEvent("syncLogseqToAnkiComplete");
        WindowParentBridge.setGlobalObject("lastSyncLogseqToAnkiResult", syncResult);
        this.displayResults(syncResult);
    }

    private async createNotes(
        toCreateNotes: Note[],
        failedCreated: {[key: string]: Error},
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification
    ): Promise<void> {
        const graphPath = (await LogseqProxy.App.getCurrentGraph()).path;
        const task = new CreateNotesTask();
        const result = await task.execute(
            toCreateNotes,
            this.modelName,
            this.graphName,
            graphPath,
            ankiNoteManager,
            syncNotificationObj
        );
        Object.assign(failedCreated, result.failed);
    }

    private async updateNotes(
        toUpdateNotes: Note[],
        failedUpdated: {[key: string]: Error},
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification
    ): Promise<void> {
        const graphPath = (await LogseqProxy.App.getCurrentGraph()).path;
        const task = new UpdateNotesTask();
        const result = await task.execute(
            toUpdateNotes,
            this.modelName,
            this.graphName,
            graphPath,
            ankiNoteManager,
            syncNotificationObj
        );
        Object.assign(failedUpdated, result.failed);
    }

    private async updateAssets(ankiNoteManager: LazyAnkiNoteManager): Promise<void> {
        await ankiNoteManager.executeAssets();
    }

    private async deleteNotes(
        toDeleteNotes: number[],
        failedDeleted: {[key: string]: Error},
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification
    ) {
        const task = new DeleteNotesTask();
        const result = await task.execute(toDeleteNotes, ankiNoteManager, syncNotificationObj);
        Object.assign(failedDeleted, result.failed);
    }

    private async suspendUnsuspendNotes(
        notes: Note[],
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification
    ): Promise<void> {
        const task = new SuspendUnsuspendNotesTask();
        const result = await task.execute(notes, ankiNoteManager, syncNotificationObj);
        logger.info(`Suspended ${result.suspended} cards, Unsuspended ${result.unsuspended} cards`);
    }

    private async getGraphName(): Promise<string> {
        return (await LogseqProxy.App.getCurrentGraph())?.name || "Default";
    }

    private getModelName(): string {
        return `${this.graphName}Model`.replace(/\s/g, "_");
    }

    private async setupAnkiModel(): Promise<void> {
        await AnkiConnect.requestPermission();
        await AnkiConnect.upsertModel(
            this.modelName,
            [
                "uuid-type",
                "Logseq Block UUID",
                "Logseq Page Id",
                "Text",
                "Breadcrumb",
                "User Controlled Field (Front)",
                "User Controlled Field (Back)",
                "User Controlled Field (Both)",
                "Config"
            ],
            getTemplateFront(),
            getTemplateBack(),
            getTemplateMediaFiles()
        );
    }

    private async initializeAnkiNoteManager(): Promise<LazyAnkiNoteManager> {
        const ankiNoteManager = new LazyAnkiNoteManager(this.modelName);
        await ankiNoteManager.init();
        Note.setAnkiNoteManager(ankiNoteManager);
        return ankiNoteManager;
    }

    private async collectAllNotes(): Promise<Note[]> {
        const scanNotification = new ProgressNotification(
            `Scanning Logseq Graph <span style="opacity: 0.8">[${this.graphName}]</span>:`,
            6,
            "graph"
        );

        let notes: Array<Note> = [];
        const [clozeNotes, swiftArrowNotes, imageOcclusionNotes, highlightMaskNotes] =
            await Promise.all([
                ClozeNote.getNotesFromLogseqBlocks().then((r) => {
                    scanNotification.increment();
                    return r;
                }),
                SwiftArrowNote.getNotesFromLogseqBlocks().then((r) => {
                    scanNotification.increment();
                    return r;
                }),
                ImageOcclusionNote.getNotesFromLogseqBlocks().then((r) => {
                    scanNotification.increment();
                    return r;
                }),
                HighlightMaskNote.getNotesFromLogseqBlocks().then((r) => {
                    scanNotification.increment();
                    return r;
                })
            ]);
        notes = [
            ...notes,
            ...clozeNotes,
            ...swiftArrowNotes,
            ...imageOcclusionNotes,
            ...highlightMaskNotes
        ];
        notes = [...notes, ...(await MultilineCardNote.getNotesFromLogseqBlocks(notes))];
        scanNotification.increment();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        scanNotification.increment();

        return await sortAsync(notes, async (a) => {
            return (await LogseqProxy.Editor.getBlock(a.uuid))?.id ?? 0;
        });
    }

    private async persistLogseqBlockIds(notes: Note[]): Promise<void> {
        if ((await LogseqProxy.App.checkCurrentIsDbGraph()) === true) return; // DB graphs don't have reindex feature.

        // Need to persist id inside logseq blocks (which makeup notes) to prevent uuid from changing on re-index
        for (const note of notes) {
            if (!note.properties["id"]) {
                try {
                    await LogseqProxy.Editor.upsertBlockProperty(note.uuid, "id", note.uuid);
                } catch (e) {
                    logger.error("Failed to persist block ID", e);
                }
            }
        }
    }

    private async createSyncPlan(notes: Note[], ankiNoteManager: LazyAnkiNoteManager) {
        const toCreateNotesOriginal: Note[] = [];
        const toUpdateNotesOriginal: Note[] = [];
        const toDeleteNotesOriginal: number[] = [];

        for (const note of notes) {
            const ankiId = await note.getAnkiId();
            if (ankiId == null || Number.isNaN(ankiId)) toCreateNotesOriginal.push(note);
            else toUpdateNotesOriginal.push(note);
        }

        const noteAnkiIds: Array<number> = await Promise.all(
            notes.map((block) => block.getAnkiId())
        );
        const AnkiIds: Array<number> = [...ankiNoteManager.noteInfoMap.keys()];
        for (const ankiId of AnkiIds) {
            if (!noteAnkiIds.includes(ankiId)) {
                toDeleteNotesOriginal.push(ankiId);
            }
        }

        return {toCreateNotesOriginal, toUpdateNotesOriginal, toDeleteNotesOriginal};
    }

    private async getUserConfirmation(
        toCreateNotesOriginal: Note[],
        toUpdateNotesOriginal: Note[],
        toDeleteNotesOriginal: number[],
        notes: Note[]
    ): Promise<{toCreateNotes: Note[]; toUpdateNotes: Note[]; toDeleteNotes: number[]} | null> {
        let buildNoteHashes: CancelablePromise | null = null;
        setTimeout(() => {
            buildNoteHashes = new CancelablePromise(async (_resolve, _reject, _onCancel) => {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                for (const note of notes) {
                    await NoteHashCalculator.getHash(note, ["", new Set([]), "", "", []]);
                    if (buildNoteHashes.isCanceled()) break;
                }
            });
        }, 1000);

        const noteSelection = await showSyncSelectionDialog(
            toCreateNotesOriginal,
            toUpdateNotesOriginal,
            toDeleteNotesOriginal
        );

        if (!noteSelection) {
            buildNoteHashes?.cancel();
            return null;
        }

        const {toCreateNotes, toUpdateNotes, toDeleteNotes} = noteSelection;
        logger.info("Sync plan created", {
            toCreate: toCreateNotes.length,
            toUpdate: toUpdateNotes.length,
            toDelete: toDeleteNotes.length
        });

        if (
            toCreateNotes.length === 0 &&
            toUpdateNotes.length === 0 &&
            toDeleteNotes.length >= 10
        ) {
            const confirm_msg = `<b class="text-red-600">This will delete all your notes in anki that are generated from this graph.</b><br/>Are you sure you want to continue?`;
            if (!(await showConfirmModal(confirm_msg))) {
                buildNoteHashes?.cancel();
                return null;
            }
        }

        buildNoteHashes?.cancel();
        return {toCreateNotes, toUpdateNotes, toDeleteNotes};
    }

    private async executeSyncPlan(
        toCreateNotes: Note[],
        toUpdateNotes: Note[],
        toDeleteNotes: number[],
        ankiNoteManager: LazyAnkiNoteManager
    ): Promise<SyncResult> {
        const failedCreated: {[key: string]: Error} = {};
        const failedUpdated: {[key: string]: Error} = {};
        const failedDeleted: {[key: string]: Error} = {};

        const start_time = performance.now();
        const twentyPercent = Math.ceil(
            (toCreateNotes.length + toUpdateNotes.length + toDeleteNotes.length) / 20
        );

        // Add 1 for suspend/unsuspend task if enabled
        const {syncOverwriteList} = LogseqProxy.Settings.getPluginSettings();
        const suspendTaskIncrement = syncOverwriteList?.includes("Suspended") ? 1 : 0;

        const syncNotificationObj = new ProgressNotification(
            "Syncing logseq notes to anki...",
            toCreateNotes.length +
                toUpdateNotes.length +
                toDeleteNotes.length +
                twentyPercent +
                1 +
                suspendTaskIncrement,
            "anki"
        );

        await this.createNotes(toCreateNotes, failedCreated, ankiNoteManager, syncNotificationObj);
        await this.updateNotes(toUpdateNotes, failedUpdated, ankiNoteManager, syncNotificationObj);
        await this.deleteNotes(toDeleteNotes, failedDeleted, ankiNoteManager, syncNotificationObj);

        if (syncOverwriteList?.includes("Suspended")) {
            await this.suspendUnsuspendNotes(
                [...toCreateNotes, ...toUpdateNotes],
                ankiNoteManager,
                syncNotificationObj
            );
        }

        syncNotificationObj.updateMessage("Syncing logseq assets to anki...");
        await this.updateAssets(ankiNoteManager);
        syncNotificationObj.increment(twentyPercent);
        await AnkiConnect.invoke("reloadCollection", {});
        syncNotificationObj.increment();

        logger.info("Sync completed", {
            timeTaken: `${(performance.now() - start_time).toFixed(2)}ms`
        });

        return {
            toCreateNotes,
            toUpdateNotes,
            toDeleteNotes,
            failedCreated,
            failedUpdated,
            failedDeleted
        };
    }

    private async performPostSyncCleanup(toCreateNotes: Note[]): Promise<void> {
        if (toCreateNotes.some((note) => !note.properties["id"])) {
            try {
                //@ts-ignore
                await WindowParentBridge.getInternalLogseqAPI().api.force_save_graph();
                await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (_e) {}
        }
    }

    private displayResults(syncResult: SyncResult): void {
        const {
            toCreateNotes,
            toUpdateNotes,
            toDeleteNotes,
            failedCreated,
            failedUpdated,
            failedDeleted
        } = syncResult;

        let summery = `Sync Completed! \n Created Blocks: ${
            toCreateNotes.length - Object.keys(failedCreated).length
        } \n Updated Blocks: ${
            toUpdateNotes.length - Object.keys(failedUpdated).length
        } \n Deleted Blocks: ${toDeleteNotes.length - Object.keys(failedDeleted).length}`;

        if (Object.keys(failedCreated).length > 0)
            summery += `\nFailed Created: ${Object.keys(failedCreated).length} `;
        if (Object.keys(failedUpdated).length > 0)
            summery += `\nFailed Updated: ${Object.keys(failedUpdated).length} `;
        if (Object.keys(failedDeleted).length > 0)
            summery += `\nFailed Deleted: ${Object.keys(failedDeleted).length} `;

        logger.info("Sync summary", {
            created: toCreateNotes,
            updated: toUpdateNotes,
            deleted: toDeleteNotes
        });

        ActionNotification(
            [
                {
                    name: "View Details",
                    func: () => {
                        showSyncResultDialog(syncResult);
                    }
                }
            ],
            summery,
            12000,
            Object.keys(failedCreated).length > 0 ||
                Object.keys(failedUpdated).length > 0 ||
                Object.keys(failedDeleted).length > 0
                ? `<span class="text-warning">${WARNING_ICON}</span>`
                : `<span class="text-success">${SUCCESS_ICON}</span>`
        );

        logger.info(summery);
        if (Object.keys(failedCreated).length > 0) logger.error("Failed Created", failedCreated);
        if (Object.keys(failedUpdated).length > 0) logger.error("Failed Updated", failedUpdated);
        if (Object.keys(failedDeleted).length > 0) logger.error("Failed Deleted", failedDeleted);
    }

    private completeSyncCleanup(): void {
        WindowParentBridge.dispatchLogseqAnkiSyncEvent("syncLogseqToAnkiComplete");
        logger.info("Sync cleanup completed");
    }
}
