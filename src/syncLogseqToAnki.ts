import "@logseq/libs";
import * as AnkiConnect from "./anki-connect/AnkiConnect";
import {LazyAnkiNoteManager} from "./anki-connect/LazyAnkiNoteManager";
import {
    getTemplateFront,
    getTemplateBack, getTemplateMediaFiles
} from "./templates/AnkiCardTemplates";
import {Note} from "./notes/Note";
import {ClozeNote} from "./notes/ClozeNote";
import {MultilineCardNote} from "./notes/MultilineCardNote";
import _ from "lodash";
import {
    escapeClozesAndMacroDelimiters,
    handleAnkiError,
    getCaseInsensitive,
    sortAsync,
    splitNamespace, getLogseqBlockPropSafe
} from "./utils/utils";
import path from "path-browserify";
import {ANKI_CLOZE_REGEXP, MD_PROPERTIES_REGEXP, SUCCESS_ICON, WARNING_ICON} from "./constants";
import {convertToHTMLFile} from "./logseq/LogseqToHtmlConverter";
import {LogseqProxy} from "./logseq/LogseqProxy";
import pkg from "../package.json";
import {SwiftArrowNote} from "./notes/SwiftArrowNote";
import {ProgressNotification} from "./ui/customized/ProgressNotification";
import {Confirm} from "./ui/general/Confirm";
import {ImageOcclusionNote} from "./notes/ImageOcclusionNote";
import NoteHashCalculator from "./notes/NoteHashCalculator";
import {cancelable, CancelablePromise} from "cancelable-promise";
import {DepGraph} from "dependency-graph";
import {NoteUtils} from "./notes/NoteUtils";
import {ActionNotification} from "./ui/general/ActionNotification";
import {showModelWithButtons} from "./ui/general/ModelWithBtns";
import {SyncSelectionDialog} from "./ui/customized/SyncSelectionDialog";
import {SyncResultDialog} from "./ui/customized/SyncResultDialog";
import {BlockEntity, PageEntity, PageIdentity} from "@logseq/libs/dist/LSPlugin";
export class LogseqToAnkiSync {
    static isSyncing: boolean;
    graphName: string;
    modelName: string;

    public async sync(): Promise<void> {
        if (typeof logseq?.App?.checkCurrentIsDbGraph === 'function' && await logseq.App.checkCurrentIsDbGraph() === true) {
            await logseq.UI.showMsg("Anki sync not supported in DB Graphs yet", "error");
            return;
        }
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
        this.graphName = _.get(await logseq.App.getCurrentGraph(), "name") || "Default";
        this.modelName = `${this.graphName}Model`.replace(/\s/g, "_");
        console.log(
            `%cStarting Logseq to Anki Sync V${pkg.version} for graph ${this.graphName}`,
            "color: green; font-size: 1.5em;",
        );

        // -- Request Access --
        await AnkiConnect.requestPermission();

        // -- Create models if it doesn't exists --
        await AnkiConnect.createModel(
            this.modelName,
            ["uuid-type", "uuid", "Text", "Extra", "Breadcrumb", "Config"],
            getTemplateFront(),
            getTemplateBack(),
            getTemplateMediaFiles()
        );

        // -- Prepare Anki Note Manager --
        const ankiNoteManager = new LazyAnkiNoteManager(this.modelName);
        await ankiNoteManager.init();
        Note.setAnkiNoteManager(ankiNoteManager);

        // -- Get the notes that are to be synced from logseq --
        const scanNotification = new ProgressNotification(
            `Scanning Logseq Graph <span style="opacity: 0.8">[${this.graphName}]</span>:`,
            5,
            "graph",
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
        await new Promise((resolve) => setTimeout(resolve, 1000)); // wait 1 sec
        scanNotification.increment();

        for (const note of notes) {
            // Force persistance of note's logseq block uuid across re-index by adding id property to block in logseq
            if (!note.properties["id"]) {
                try {
                    await LogseqProxy.Editor.upsertBlockProperty(note.uuid, "id", note.uuid);
                } catch (e) {
                    console.error(e);
                }
            }
        }

        notes = await sortAsync(notes, async (a) => {
            return _.get(await LogseqProxy.Editor.getBlock(a.uuid), "id", 0); // Sort by db/id
        });
        //scanNotification.increment();

        // -- Declare some variables to keep track of different operations performed --
        const failedCreated: { [key: string]: any } = {};
        const failedUpdated: { [key: string]: any } = {};
        const failedDeleted: { [key: string]: any } = {};
        const toCreateNotesOriginal = new Array<Note>(),
            toUpdateNotesOriginal = new Array<Note>(),
            toDeleteNotesOriginal = new Array<number>();
        for (const note of notes) {
            const ankiId = await note.getAnkiId();
            if (ankiId == null || isNaN(ankiId)) toCreateNotesOriginal.push(note);
            else toUpdateNotesOriginal.push(note);
        }
        const noteAnkiIds: Array<number> = await Promise.all(
            notes.map((block) => block.getAnkiId()),
        ); // Flatten current logseq block's anki ids
        const AnkiIds: Array<number> = [...ankiNoteManager.noteInfoMap.keys()];
        for (const ankiId of AnkiIds) {
            if (!noteAnkiIds.includes(ankiId)) {
                toDeleteNotesOriginal.push(ankiId);
            }
        }

        // -- Prompt the user what actions are going to be performed --
        // Perform caching while user is reading the prompt
        let buildNoteHashes: any = {
            dontCreateCancelable: false,
            cancel: () => {
                buildNoteHashes.dontCreateCancelable = true;
            },
        };
        setTimeout(() => {
            if (buildNoteHashes.dontCreateCancelable == false) {
                buildNoteHashes = new CancelablePromise(async (resolve, reject, onCancel) => {
                    await new Promise((resolve) => setTimeout(resolve, 10000));
                    for (const note of notes) {
                        await NoteHashCalculator.getHash(note, ["", [], "", "", [], ""]);
                        if (buildNoteHashes.isCanceled()) break;
                    }
                });
            }
        }, 4000);

        const noteSelection = await SyncSelectionDialog(
            toCreateNotesOriginal,
            toUpdateNotesOriginal,
            toDeleteNotesOriginal,
        );
        if (!noteSelection) {
            buildNoteHashes.cancel();
            window.parent.LogseqAnkiSync.dispatchEvent("syncLogseqToAnkiComplete");
            console.log("Sync Aborted by user!");
            return;
        }
        const {toCreateNotes, toUpdateNotes, toDeleteNotes} = noteSelection;
        console.log(
            "toCreateNotes",
            toCreateNotes,
            "toUpdateNotes",
            toUpdateNotes,
            "toDeleteNotes",
            toDeleteNotes,
        );

        if (
            toCreateNotes.length == 0 &&
            toUpdateNotes.length == 0 &&
            toDeleteNotes.length >= 10
        ) {
            // Prompt the user again if they are about to delete a lot of notes
            const confirm_msg = `<b class="text-red-600">This will delete all your notes in anki that are generated from this graph.</b><br/>Are you sure you want to continue?`;
            if (!(await Confirm(confirm_msg))) {
                buildNoteHashes.cancel();
                window.parent.LogseqAnkiSync.dispatchEvent("syncLogseqToAnkiComplete");
                console.log("Sync Aborted by user!");
                return;
            }
        }
        buildNoteHashes.cancel();

        // -- Sync --
        const start_time = performance.now();
        const twentyPercent = Math.ceil(
            (toCreateNotes.length + toUpdateNotes.length + toDeleteNotes.length) / 20,
        );
        const syncNotificationMsg = "Syncing logseq notes to anki...";
        const syncNotificationObj = new ProgressNotification(
            syncNotificationMsg,
            toCreateNotes.length +
                toUpdateNotes.length +
                toDeleteNotes.length +
                twentyPercent +
                1,
            "anki",
        );
        await this.createNotes(toCreateNotes, failedCreated, ankiNoteManager, syncNotificationObj);
        await this.updateNotes(toUpdateNotes, failedUpdated, ankiNoteManager, syncNotificationObj);
        await this.deleteNotes(toDeleteNotes, failedDeleted, ankiNoteManager, syncNotificationObj);
        await syncNotificationObj.updateMessage("Syncing logseq assets to anki...");
        await this.updateAssets(ankiNoteManager);
        await syncNotificationObj.increment(twentyPercent);
        await AnkiConnect.invoke("reloadCollection", {});
        await syncNotificationObj.increment();
        window.parent.LogseqAnkiSync.dispatchEvent("syncLogseqToAnkiComplete");

        // Save logseq graph if any changes were made
        if (toCreateNotes.some((note) => !note.properties["id"])) {
            try {
                await window.parent.logseq.api.force_save_graph();
                await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (e) {
            }
        }

        // -- Show Result / Summery --
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
        // logseq.UI.showMsg(summery, status, {
        //     timeout: status == "success" ? 1200 : 4000,
        // });
        ActionNotification(
            [
                {
                    name: "View Details",
                    func: () => {
                        SyncResultDialog(
                            toCreateNotes,
                            toUpdateNotes,
                            toDeleteNotes,
                            failedCreated,
                            failedUpdated,
                            failedDeleted,
                        );
                    },
                },
            ],
            summery,
            20000,
            failedCreated.size > 0 || failedUpdated.size > 0 || failedDeleted.size > 0
                ? WARNING_ICON
                : SUCCESS_ICON,
        );
        console.log(summery);
        if (failedCreated.size > 0) console.log("\nFailed Created:", failedCreated);
        if (failedUpdated.size > 0) console.log("\nFailed Updated:", failedUpdated);
        if (failedDeleted.size > 0) console.log("\nFailed Deleted:", failedDeleted);
        console.log(
            "syncLogseqToAnki() Time Taken:",
            (performance.now() - start_time).toFixed(2),
            "ms",
        );
    }

    private async createNotes(
        toCreateNotes: Note[],
        failedCreated: { [key: string]: any },
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification,
    ): Promise<void> {
        for (const note of toCreateNotes) {
            try {
                const [html, assets, deck, breadcrumb, tags, extra] = await this.parseNote(
                    note,
                );
                const dependencyHash = await NoteHashCalculator.getHash(note, [
                    html,
                    Array.from(assets),
                    deck,
                    breadcrumb,
                    tags,
                    extra,
                ]);
                // Add assets
                const graphPath = (await logseq.App.getCurrentGraph()).path;
                assets.forEach((asset) => {
                    ankiNoteManager.storeAsset(
                        path.basename(asset),
                        path.join(graphPath, path.resolve(asset)),
                    );
                });
                // Create note
                ankiNoteManager.addNote(
                    deck,
                    this.modelName,
                    {
                        "uuid-type": `${note.uuid}-${note.type}`,
                        uuid: note.uuid,
                        Text: html,
                        Extra: extra,
                        Breadcrumb: breadcrumb,
                        Config: JSON.stringify({
                            dependencyHash,
                            assets: [...assets],
                        }),
                    },
                    tags,
                );
            } catch (e) {
                console.error(e);
                failedCreated[`${note.uuid}-${note.type}`] = e;
            }
            syncNotificationObj.increment();
        }

        let [addedNoteAnkiIdUUIDPairs, subOperationResults] = await ankiNoteManager.execute(
            "addNotes",
        );
        for (const addedNoteAnkiIdUUIDPair of addedNoteAnkiIdUUIDPairs) {
            // update ankiId of added blocks
            const uuidtype = addedNoteAnkiIdUUIDPair["uuid-type"];
            const uuid = uuidtype.split("-").slice(0, -1).join("-");
            const type = uuidtype.split("-").slice(-1)[0];
            const note = _.find(toCreateNotes, {uuid: uuid, type: type});
            note["ankiId"] = addedNoteAnkiIdUUIDPair["ankiId"];
            console.log(note);
        }

        for (const subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.log(subOperationResult.error);
                failedCreated[subOperationResult["uuid-type"]] = subOperationResult.error;
            }
        }

        subOperationResults = await ankiNoteManager.execute("addNotes");
        for (const subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
            }
        }
    }

    private async updateNotes(
        toUpdateNotes: Note[],
        failedUpdated: { [key: string]: any },
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification,
    ): Promise<void> {
        const graphPath = (await logseq.App.getCurrentGraph()).path;
        for (const note of toUpdateNotes) {
            try {
                const ankiId = note.getAnkiId();
                // Calculate Dependency Hash - It is the hash of all dependencies of the note
                // (dependencies include related logseq blocks, related logseq pages, plugin version, current note content in anki etc)
                const ankiNodeInfo = ankiNoteManager.noteInfoMap.get(ankiId);
                const oldConfig = ((configString) => {
                    try {
                        return JSON.parse(configString);
                    } catch (e) {
                        return {};
                    }
                })(ankiNodeInfo.fields.Config.value);
                const [oldHtml, oldAssets, oldDeck, oldBreadcrumb, oldTags, oldExtra] = [
                    ankiNodeInfo.fields.Text.value,
                    oldConfig.assets,
                    ankiNodeInfo.deck,
                    ankiNodeInfo.fields.Breadcrumb.value,
                    ankiNodeInfo.tags,
                    ankiNodeInfo.fields.Extra.value,
                ];
                let dependencyHash = await NoteHashCalculator.getHash(note, [
                    oldHtml,
                    oldAssets,
                    oldDeck,
                    oldBreadcrumb,
                    oldTags,
                    oldExtra,
                ]);
                if (
                    logseq.settings.skipOnDependencyHashMatch != true ||
                    oldConfig.dependencyHash != dependencyHash
                ) {
                    // Reparse Note + update assets + update                    // Parse Note
                    const [html, assets, deck, breadcrumb, tags, extra] = await this.parseNote(
                        note,
                    );
                    dependencyHash = await NoteHashCalculator.getHash(note, [
                        html,
                        Array.from(assets),
                        deck,
                        breadcrumb,
                        tags,
                        extra,
                    ]);
                    // Add or update assets
                    const graphPath = (await logseq.App.getCurrentGraph()).path;
                    assets.forEach((asset) => {
                        ankiNoteManager.storeAsset(
                            path.basename(asset),
                            path.join(graphPath, path.resolve(asset)),
                        );
                    });
                    // Update note
                    if (logseq.settings.debug.includes("syncLogseqToAnki.ts"))
                        console.log(
                            `dependencyHash mismatch for note with id ${note.uuid}-${note.type}`,
                        );
                    ankiNoteManager.updateNote(
                        ankiId,
                        deck,
                        this.modelName,
                        {
                            "uuid-type": `${note.uuid}-${note.type}`,
                            uuid: note.uuid,
                            Text: html,
                            Extra: extra,
                            Breadcrumb: breadcrumb,
                            Config: JSON.stringify({
                                dependencyHash,
                                assets: [...assets],
                            }),
                        },
                        tags,
                    );
                } else {
                    // Just update old assets
                    oldConfig.assets.forEach((asset) => {
                        if (ankiNoteManager.mediaInfo.has(path.basename(asset))) return;
                        ankiNoteManager.storeAsset(
                            path.basename(asset),
                            path.join(graphPath, path.resolve(asset)),
                        );
                    });
                }
            } catch (e) {
                console.error(e);
                failedUpdated[`${note.uuid}-${note.type}`] = e;
            }
            syncNotificationObj.increment();
        }

        let subOperationResults = await ankiNoteManager.execute("updateNotes");
        for (const subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
                failedUpdated[subOperationResult["uuid-type"]] = subOperationResult.error;
            }
        }
    }

    private async updateAssets(
        ankiNoteManager: LazyAnkiNoteManager
    ): Promise<void> {
        let subOperationResults = await ankiNoteManager.execute("storeAssets");
        for (const subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
            }
        }
    }

    private async deleteNotes(
        toDeleteNotes: number[],
        failedDeleted : { [key: string]: any },
        ankiNoteManager: LazyAnkiNoteManager,
        syncNotificationObj: ProgressNotification,
    ) {
        for (const ankiId of toDeleteNotes) {
            ankiNoteManager.deleteNote(ankiId);
            syncNotificationObj.increment();
        }
        const subOperationResults = await ankiNoteManager.execute("deleteNotes");
        for (const subOperationResult of subOperationResults) {
            if (subOperationResult != null && subOperationResult.error != null) {
                console.error(subOperationResult.error);
                failedDeleted[subOperationResult.error.ankiId] = subOperationResult.error;
            }
        }
    }

    private async parseNote(
        note: Note,
    ): Promise<[string, Set<string>, string, string, string[], string]> {
        let {html, assets, tags} = await note.getClozedContentHTML();

        if (logseq.settings.includeParentContent) {
            let newHtml = "";
            const parentBlocks = [];
            let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
            let parent;
            while ((parent = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                parentBlocks.push({
                    content: escapeClozesAndMacroDelimiters(parent.content),
                    format: parent.format,
                    uuid: parent.uuid,
                    hiddenParent: (
                        await NoteUtils.matchTagNamesWithTagIds(
                            _.get(parent, "refs", []).map((ref) => ref.id),
                            ["hide-when-card-parent"],
                        )
                    ).includes("hide-when-card-parent") || Array.from(tags).includes("hide-all-card-parent"),
                    properties: parent.properties,
                });
                parentID = parent.parent.id;
            }
            for await (const parentBlock of parentBlocks.reverse()) {
                const parentBlockConverted = _.clone(
                    await convertToHTMLFile(parentBlock.content, parentBlock.format),
                );
                if (parentBlock.hiddenParent)
                    parentBlockConverted.html = `<span class="hidden-parent">${parentBlockConverted.html}</span>`;
                parentBlockConverted.assets.forEach((asset) => assets.add(asset));
                newHtml += `<ul class="children-list"><li class="children ${_.get(parentBlock, "properties['logseq.orderListType']") == "number" ? 'numbered' : ''}">
                                ${parentBlockConverted.html}`;
            }
            newHtml += `<ul class="children-list"><li class="children ${_.get(note, "properties['logseq.orderListType']") == "number" ? 'numbered' : ''}">
                            ${html}</li></ul>`;
            parentBlocks.reverse().forEach((parentBlock) => {
                newHtml += `</li></ul>`;
            });
            html = newHtml;
        }

        // Parse useNamespaceAsDefaultDeck value (based on https://github.com/debanjandhar12/logseq-anki-sync/pull/143)
        let useNamespaceAsDefaultDeck = null;
        try {
            let parentNamespaceID : number = note.page.id;
            while (parentNamespaceID != null) {
                let parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                if(!parentNamespacePage) break;
                if ([true, "true"].includes(getLogseqBlockPropSafe(parentNamespacePage, "properties.use-namespace-as-default-deck"))) {
                    useNamespaceAsDefaultDeck = true;
                    break;
                }
                else if ([false, "false"].includes(getLogseqBlockPropSafe(parentNamespacePage, "properties.use-namespace-as-default-deck"))) {
                    useNamespaceAsDefaultDeck = false;
                    break;
                }

                parentNamespaceID = _.get(parentNamespacePage, 'namespace.id', null);
            }
        } catch (e) {
            console.error(e);
        }
        if (useNamespaceAsDefaultDeck == null) useNamespaceAsDefaultDeck = logseq.settings.useNamespaceAsDefaultDeck;

        // Parse deck using logic described at https://github.com/debanjandhar12/logseq-anki-sync/wiki/How-to-set-or-change-the-deck-for-cards%3F
        let deck: any = null;
        try {
            let parentBlockUUID : string | number = note.uuid;
            while (parentBlockUUID != null) {
                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                if (getLogseqBlockPropSafe(parentBlock, "properties.deck") != null) {
                    deck = getLogseqBlockPropSafe(parentBlock, "properties.deck");
                    break;
                }
                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) { console.error(e); }

        if (deck === null) {
            try {
                let parentNamespaceID : number = note.page.id;
                while (parentNamespaceID != null) {
                    let parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                    if(!parentNamespacePage) break;
                    if (getLogseqBlockPropSafe(parentNamespacePage, "properties.deck") != null) {
                        deck = getLogseqBlockPropSafe(parentNamespacePage, "properties.deck");
                        break;
                    }
                    parentNamespaceID = _.get(parentNamespacePage, 'namespace.id', null);
                }
            } catch (e) { console.error(e); }
        }

        if (deck === null && useNamespaceAsDefaultDeck == true) {
            deck = splitNamespace(
                _.get(note, "page.originalName", "") ||
                _.get(note, "page.properties.title", ""),
            ).slice(0, -1).join("/");
        }

        deck = deck || logseq.settings.defaultDeck || "Default";

        if (typeof deck != "string") deck = deck[0];

        deck = splitNamespace(deck).join("::");

        // Parse breadcrumb
        let breadcrumb = `<a href="logseq://graph/${encodeURIComponent(
            this.graphName,
        )}?page=${encodeURIComponent(note.page.originalName)}" class="hidden">${
            note.page.originalName
        }</a>`;
        if (logseq.settings.breadcrumbDisplay.includes("Show Page name"))
            breadcrumb = `<a href="logseq://graph/${encodeURIComponent(
                this.graphName,
            )}?page=${encodeURIComponent(note.page.originalName)}" title="${
                note.page.originalName
            }">${note.page.originalName}</a>`;
        if (logseq.settings.breadcrumbDisplay == "Show Page name and parent blocks context") {
            try {
                const parentBlocks = [];
                let parentID = (await LogseqProxy.Editor.getBlock(note.uuid)).parent.id;
                let parentBlock : BlockEntity;
                while ((parentBlock = await LogseqProxy.Editor.getBlock(parentID)) != null) {
                    parentBlocks.push({
                        content: parentBlock.content
                            .replaceAll(MD_PROPERTIES_REGEXP, "")
                            .replaceAll(ANKI_CLOZE_REGEXP, "$3"),
                        uuid: parentBlock.uuid,
                    });
                    parentID = parentBlock.parent.id;
                }
                while (parentBlocks.length > 0) {
                    const parentBlock = parentBlocks.pop();
                    const parentBlockContentFirstLine = parentBlock.content.split("\n")[0];
                    breadcrumb += ` > <a href="logseq://graph/${encodeURIComponent(
                        this.graphName,
                    )}?block-id=${encodeURIComponent(parentBlock.uuid)}" title="${
                        parentBlock.content
                    }">${parentBlockContentFirstLine}</a>`;
                }
            } catch (e) {
                console.error(e);
            }
        }

        // Parse tags
        tags = [...Array.from(tags)];
        try {
            let parentBlockUUID : string | number = note.uuid;
            while (parentBlockUUID != null) {
                const parentBlock = await LogseqProxy.Editor.getBlock(parentBlockUUID);
                tags = [...tags, ...getCaseInsensitive(parentBlock, "properties.tags", [])];
                parentBlockUUID = _.get(parentBlock, "parent.id", null);
            }
        } catch (e) {
            console.error(e);
        }
        try {
            let parentNamespaceID : number = _.get(note, "page.id", null);
            while (parentNamespaceID != null) {
                const parentNamespacePage = await LogseqProxy.Editor.getPage(parentNamespaceID);
                tags = [...tags, ...getCaseInsensitive(parentNamespacePage, "properties.tags", [])];
                parentNamespaceID = _.get(parentNamespacePage, "namespace.id", null);
            }
        } catch (e) {
            console.error(e);
        }
        tags = tags.map((tag) => tag.replace(/\//g, "::"));
        tags = tags.map((tag) => tag.replace(/\s/g, "_")); // Anki doesn't like spaces in tags
        tags = _.uniq(tags);
        tags = tags.filter((tag) => {
            const otherTags = (tags as string[]).filter((otherTag) => otherTag != tag);
            const otherTagsStartingWithThisName = otherTags.filter((otherTag) =>
                otherTag.startsWith(tag + "::"),
            );
            return otherTagsStartingWithThisName.length == 0;
        });

        let extra =
            _.get(note, "properties.extra") || _.get(note, "page.properties.extra") || "";
        if (Array.isArray(extra)) extra = extra.join(" ");
        extra = await convertToHTMLFile(
            extra,
            (await LogseqProxy.Editor.getBlock(note.uuid)).format,
        );
        assets = new Set([...assets, ...extra.assets]);
        extra = extra.html;

        return [html, assets, deck, breadcrumb, tags, extra];
    }
}
