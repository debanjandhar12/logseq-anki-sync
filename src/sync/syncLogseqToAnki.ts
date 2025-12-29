import "@logseq/libs";
import * as AnkiConnect from "../anki-connect/AnkiConnect";
import {LazyAnkiNoteManager} from "../anki-connect/LazyAnkiNoteManager";
import {
    getTemplateFront,
    getTemplateBack, getTemplateMediaFiles
} from "../anki-template/AnkiCardTemplates";
import {Note} from "../anki-notes/Note";
import {ClozeNote} from "../anki-notes/ClozeNote";
import {MultilineCardNote} from "../anki-notes/MultilineCardNote";
import _ from "lodash";
import {ParsedNoteData} from "./types";
import {
    handleAnkiError,
    sortAsync
} from "../utils/utils";
import path from "path-browserify";
import {SUCCESS_ICON, WARNING_ICON} from "../constants";
import {LogseqProxy} from "../logseq/LogseqProxy";
import pkg from "../../package.json";
import {SwiftArrowNote} from "../anki-notes/SwiftArrowNote";
import {ProgressNotification} from "../ui";
import {showConfirmModal} from "../ui";
import {ImageOcclusionNote} from "../anki-notes/ImageOcclusionNote";
import { NoteHashCalculator } from "./cache";
import {CancelablePromise} from "cancelable-promise";
import {ActionNotification} from "../ui/common/ActionNotification";
import {showSyncSelectionDialog} from "../ui";
import {showSyncResultDialog} from "../ui";
import { WindowParentBridge } from "../logseq/WindowParentBridge";
import { parseNote } from "./parsers";
import { CreateNotesOperation } from "./operations/CreateNotesOperation";
import { UpdateNotesOperation } from "./operations/UpdateNotesOperation";
import { DeleteNotesOperation } from "./operations/DeleteNotesOperation";

export class LogseqToAnkiSync {
    static isSyncing: boolean;
    graphName: string;
    modelName: string;

    public async sync(): Promise<void> {
        // if (await LogseqProxy.App.checkCurrentIsDbGraph()  === true) {
        //     await logseq.UI.showMsg("Anki sync not supported in DB Graphs yet.\nDevelopment to support it is going on in db branch.", "error");
        //     return;
        // }
        if (LogseqToAnkiSync.isSyncing) {
            console.log(`Syncing already in process...`);
            return;
        }
        LogseqToAnkiSync.isSyncing = true;
        try {
            await this.performSync();
        } catch (e) {
            handleAnkiError(e.toString());
            logseq.provideUI({
                key: `logseq-anki-sync-progress-notification-${logseq.baseInfo.id}`,
                template: ``,
            });
            console.error(e);
        }
        LogseqToAnkiSync.isSyncing = false;
    }

    private async performSync(): Promise<void> {
        this.graphName = await this.getGraphName();
        this.modelName = this.getModelName();
        console.log(
            `%cStarting Logseq to Anki Sync V${pkg.version} for graph ${this.graphName}`,
            "color: green; font-size: 1.5em;"
        );

        await this.setupAnkiModel();
        const ankiNoteManager = await this.initializeAnkiNoteManager();

        const notes = await this.collectAllNotes();
        await this.persistLogseqBlockIds(notes);

        const syncPlan = await this.createSyncPlan(notes, ankiNoteManager);
        const { toCreateNotesOriginal, toUpdateNotesOriginal, toDeleteNotesOriginal } = syncPlan;

        const confirmation = await this.getUserConfirmation(
            toCreateNotesOriginal,
            toUpdateNotesOriginal,
            toDeleteNotesOriginal,
            notes
        );
        
        if (!confirmation) {
            this.completeSyncCleanup();
            return;
        }

        const { toCreateNotes, toUpdateNotes, toDeleteNotes } = confirmation;
        const results = await this.executeSyncPlan(toCreateNotes, toUpdateNotes, toDeleteNotes, ankiNoteManager);

        WindowParentBridge.dispatchLogseqAnkiSyncEvent("syncLogseqToAnkiComplete");
        await this.performPostSyncCleanup(results.toCreateNotes);
        this.displayResults(
            results.toCreateNotes,
            results.toUpdateNotes,
            results.toDeleteNotes,
            results.failedCreated,
            results.failedUpdated,
            results.failedDeleted
        );
    }

    private async createNotes(
        toCreateNotes: Note[],
        failedCreated: { [key: string]: Error },
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification,
    ): Promise<void> {
        const graphPath = (await LogseqProxy.App.getCurrentGraph()).path;
        const operation = new CreateNotesOperation();
        const result = await operation.execute(
            toCreateNotes,
            this.modelName,
            graphPath,
            ankiNoteManager,
            (note) => this.parseNote(note),
            syncNotificationObj
        );
        Object.assign(failedCreated, result.failed);
    }

    private async updateNotes(
        toUpdateNotes: Note[],
        failedUpdated: { [key: string]: Error },
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification,
    ): Promise<void> {
        const graphPath = (await LogseqProxy.App.getCurrentGraph()).path;
        const operation = new UpdateNotesOperation();
        const result = await operation.execute(
            toUpdateNotes,
            this.modelName,
            graphPath,
            ankiNoteManager,
            (note) => this.parseNote(note),
            syncNotificationObj
        );
        Object.assign(failedUpdated, result.failed);
    }

    private async updateAssets(
        ankiNoteManager: LazyAnkiNoteManager
    ): Promise<void> {
        await ankiNoteManager.executeAssets();
    }

    private async deleteNotes(
        toDeleteNotes: number[],
        failedDeleted: { [key: string]: Error },
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification,
    ) {
        const operation = new DeleteNotesOperation();
        const result = await operation.execute(
            toDeleteNotes,
            ankiNoteManager,
            syncNotificationObj
        );
        Object.assign(failedDeleted, result.failed);
    }

    private async parseNote(
        note: Note,
    ): Promise<ParsedNoteData> {
        return await parseNote(note, this.graphName);
    }

    private async getGraphName(): Promise<string> {
        return (await LogseqProxy.App.getCurrentGraph())?.name || "Default";
    }

    private getModelName(): string {
        return `${this.graphName}Model`.replace(/\s/g, "_");
    }

    private async setupAnkiModel(): Promise<void> {
        await AnkiConnect.requestPermission();
        await AnkiConnect.createModel(
            this.modelName,
            ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"],
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
            5,
            "graph"
        );
        
        let notes: Array<Note> = [];
        notes = [...notes, ...(await ClozeNote.getNotesFromLogseqBlocks())];
        scanNotification.increment();
        notes = [...notes, ...(await SwiftArrowNote.getNotesFromLogseqBlocks())];
        scanNotification.increment();
        notes = [...notes, ...(await ImageOcclusionNote.getNotesFromLogseqBlocks())];
        scanNotification.increment();
        notes = [...notes, ...(await MultilineCardNote.getNotesFromLogseqBlocks(notes))];
        scanNotification.increment();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        scanNotification.increment();

        return await sortAsync(notes, async (a) => {
            return (await LogseqProxy.Editor.getBlock(a.uuid))?.id ?? 0;
        });
    }

    private async persistLogseqBlockIds(notes: Note[]): Promise<void> {
        if (await LogseqProxy.App.checkCurrentIsDbGraph() === true) return; // DB graphs don't have reindex feature.

        // Need to persist id inside logseq blocks (which makeup notes) to prevent uuid from changing on re-index
        for (const note of notes) {
            if (!note.properties["id"]) {
                try {
                    await LogseqProxy.Editor.upsertBlockProperty(note.uuid, "id", note.uuid);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }

    private async createSyncPlan(notes: Note[], ankiNoteManager: LazyAnkiNoteManager) {
        const toCreateNotesOriginal = new Array<Note>();
        const toUpdateNotesOriginal = new Array<Note>();
        const toDeleteNotesOriginal = new Array<number>();

        for (const note of notes) {
            const ankiId = await note.getAnkiId();
            if (ankiId == null || isNaN(ankiId)) toCreateNotesOriginal.push(note);
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

        return { toCreateNotesOriginal, toUpdateNotesOriginal, toDeleteNotesOriginal };
    }

    private async getUserConfirmation(
        toCreateNotesOriginal: Note[],
        toUpdateNotesOriginal: Note[],
        toDeleteNotesOriginal: number[],
        notes: Note[]
    ): Promise<{ toCreateNotes: Note[], toUpdateNotes: Note[], toDeleteNotes: number[] } | null> {
        let buildNoteHashes: CancelablePromise | null = null;
        setTimeout(() => {
            buildNoteHashes = new CancelablePromise(async (resolve, reject, onCancel) => {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                for (const note of notes) {
                    await NoteHashCalculator.getHash(note, ["", new Set([]), "", "", [], ""]);
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

        const { toCreateNotes, toUpdateNotes, toDeleteNotes } = noteSelection;
        console.log("toCreateNotes", toCreateNotes, "toUpdateNotes", toUpdateNotes, "toDeleteNotes", toDeleteNotes);

        if (toCreateNotes.length == 0 && toUpdateNotes.length == 0 && toDeleteNotes.length >= 10) {
            const confirm_msg = `<b class="text-red-600">This will delete all your notes in anki that are generated from this graph.</b><br/>Are you sure you want to continue?`;
            if (!(await showConfirmModal(confirm_msg))) {
                buildNoteHashes?.cancel();
                return null;
            }
        }
        
        buildNoteHashes?.cancel();
        return { toCreateNotes, toUpdateNotes, toDeleteNotes };
    }

    private async executeSyncPlan(
        toCreateNotes: Note[],
        toUpdateNotes: Note[],
        toDeleteNotes: number[],
        ankiNoteManager: LazyAnkiNoteManager
    ) {
        const failedCreated: { [key: string]: Error } = {};
        const failedUpdated: { [key: string]: Error } = {};
        const failedDeleted: { [key: string]: Error } = {};

        const start_time = performance.now();
        const twentyPercent = Math.ceil(
            (toCreateNotes.length + toUpdateNotes.length + toDeleteNotes.length) / 20
        );
        const syncNotificationObj = new ProgressNotification(
            "Syncing logseq notes to anki...",
            toCreateNotes.length + toUpdateNotes.length + toDeleteNotes.length + twentyPercent + 1,
            "anki"
        );

        await this.createNotes(toCreateNotes, failedCreated, ankiNoteManager, syncNotificationObj);
        await this.updateNotes(toUpdateNotes, failedUpdated, ankiNoteManager, syncNotificationObj);
        await this.deleteNotes(toDeleteNotes, failedDeleted, ankiNoteManager, syncNotificationObj);
        
        syncNotificationObj.updateMessage("Syncing logseq assets to anki...");
        await this.updateAssets(ankiNoteManager);
        syncNotificationObj.increment(twentyPercent);
        await AnkiConnect.invoke("reloadCollection", {});
        syncNotificationObj.increment();

        console.log(
            "syncLogseqToAnki() Time Taken:",
            (performance.now() - start_time).toFixed(2),
            "ms"
        );

        return { toCreateNotes, toUpdateNotes, toDeleteNotes, failedCreated, failedUpdated, failedDeleted };
    }

    private async performPostSyncCleanup(toCreateNotes: Note[]): Promise<void> {
        if (toCreateNotes.some((note) => !note.properties["id"])) {
            try {
                //@ts-ignore
                await WindowParentBridge.getInternalLogseqAPI().api.force_save_graph();
                await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (e) {
            }
        }
    }

    private displayResults(
        toCreateNotes: Note[],
        toUpdateNotes: Note[],
        toDeleteNotes: number[],
        failedCreated: { [key: string]: Error },
        failedUpdated: { [key: string]: Error },
        failedDeleted: { [key: string]: Error }
    ): void {
        let summery = `Sync Completed! \n Created Blocks: ${
            toCreateNotes.length - Object.keys(failedCreated).length
        } \n Updated Blocks: ${
            toUpdateNotes.length - Object.keys(failedUpdated).length
        } \n Deleted Blocks: ${
            toDeleteNotes.length - Object.keys(failedDeleted).length
        }`;
        
        if (Object.keys(failedCreated).length > 0)
            summery += `\nFailed Created: ${Object.keys(failedCreated).length} `;
        if (Object.keys(failedUpdated).length > 0)
            summery += `\nFailed Updated: ${Object.keys(failedUpdated).length} `;
        if (Object.keys(failedDeleted).length > 0)
            summery += `\nFailed Deleted: ${Object.keys(failedDeleted).length} `;

        console.log(toCreateNotes, toUpdateNotes, toDeleteNotes);
        ActionNotification(
            [
                {
                    name: "View Details",
                    func: () => {
                        showSyncResultDialog(
                            toCreateNotes,
                            toUpdateNotes,
                            toDeleteNotes,
                            failedCreated,
                            failedUpdated,
                            failedDeleted
                        );
                    },
                },
            ],
            summery,
            20000,
            Object.keys(failedCreated).length > 0 || Object.keys(failedUpdated).length > 0 || Object.keys(failedDeleted).length > 0
                ? WARNING_ICON
                : SUCCESS_ICON
        );
        
        console.log(summery);
        if (Object.keys(failedCreated).length > 0) console.error("\nFailed Created:", failedCreated);
        if (Object.keys(failedUpdated).length > 0) console.error("\nFailed Updated:", failedUpdated);
        if (Object.keys(failedDeleted).length > 0) console.error("\nFailed Deleted:", failedDeleted);
    }

    private completeSyncCleanup(): void {
        WindowParentBridge.dispatchLogseqAnkiSyncEvent("syncLogseqToAnkiComplete");
        console.log("Sync Aborted by user!");
    }
}
