import "@logseq/libs";
import {LazyAnkiNoteManager} from "../anki-connect/LazyAnkiNoteManager";
import {HTMLFile} from "../converter/Converter";
import {DependencyEntity} from "../converter/getContentDirectDependencies";
import _ from "lodash";
import {LogseqProxy} from "../logseq/LogseqProxy";
import {NoteUtils} from "./NoteUtils";

export abstract class Note {
    public uuid: string;
    public content: string;
    public format: string;
    public properties: any;
    public page: any;
    public type: string;
    public ankiId: number;
    public tagIds: number[];
    static ankiNoteManager: LazyAnkiNoteManager;

    public constructor(
        uuid: string,
        content: string,
        format: string,
        properties: any,
        page: any,
        refs: number[],
    ) {
        this.uuid = uuid;
        this.content = content;
        this.format = format;
        this.properties = properties;
        this.page = page;
        this.page.originalName =
            _.get(this, "page.originalName", null) || _.get(this, "page.name", null); // Just in case the page doesn't have an originalName
        this.tagIds = refs;
    }

    public static setAnkiNoteManager(ankiNoteManager: LazyAnkiNoteManager) {
        Note.ankiNoteManager = ankiNoteManager;
    }

    public abstract getClozedContentHTML(): Promise<HTMLFile>;

    public getContent(): string {
        return this.content;
    }

    public getAnkiId(): number {
        if (this.ankiId) return this.ankiId;
        const ankiNotesArr = Array.from(Note.ankiNoteManager.noteInfoMap.values());
        const filteredankiNotesArr = ankiNotesArr.filter(
            (note) => note.fields["uuid-type"].value == `${this.uuid}-${this.type}`,
        );
        if (filteredankiNotesArr.length == 0) this.ankiId = null;
        else this.ankiId = parseInt(filteredankiNotesArr[0].noteId);
        return this.ankiId;
    }

    public getBlockDependencies(): DependencyEntity[] {
        return [this.uuid].map((block) => ({type: "Block", value: block}) as DependencyEntity);
    }

    public static initLogseqOperations = () => {
        logseq.provideStyle(`
            .page-reference[data-ref=no-anki-sync], a[data-ref=no-anki-sync] {
                opacity: .3;
            }
        `);
        LogseqProxy.Editor.createPageSilentlyIfNotExists("no-anki-sync");
        LogseqProxy.Editor.createPageSilentlyIfNotExists("hide-when-card-parent"); // TODO: relocate this
    };

    public static async removeUnwantedNotes(notes: Note[]): Promise<Note[]> {
        let newNotes = notes;
        newNotes = _.uniqBy(newNotes, "uuid");
        newNotes = _.without(newNotes, undefined, null);
        newNotes = _.filter(newNotes, (note) => {
            // Remove template blocks and blocks without uuid
            return (
                _.get(note, "properties.template") == null ||
                _.get(note, "properties.template") == undefined ||
                _.get(note, "uuid") == null
            );
        });
        newNotes = (
            await Promise.all(
                newNotes.map(async (note) =>
                    (
                        await NoteUtils.matchTagNamesWithTagIds(note.tagIds, ["no-anki-sync"])
                    ).includes("no-anki-sync")
                        ? null
                        : note,
                ),
            )
        ).filter((note) => note !== null);
        return newNotes;
    }

    // public static async abstract getBlocksFromLogseq(): Block[];
}
