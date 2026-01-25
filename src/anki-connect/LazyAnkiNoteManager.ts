import { AnkiNoteCache } from "./internal/AnkiNoteCache";
import { AddNoteOperation } from "./operations/AddNoteOperation";
import { UpdateNoteOperation } from "./operations/UpdateNoteOperation";
import { DeleteNoteOperation } from "./operations/DeleteNoteOperation";
import { AssetOperation } from "./operations/AssetOperation";
import { AnkiNoteFields, AnkiNoteInfo, AddNotesResult, UpdateNotesResult, DeleteNotesResult } from "./types";

export class LazyAnkiNoteManager {
    public modelName: string;
    private cache: AnkiNoteCache;
    private addOperation: AddNoteOperation;
    private updateOperation: UpdateNoteOperation;
    private deleteOperation: DeleteNoteOperation;
    private assetOperation: AssetOperation;

    constructor(modelName: string) {
        this.modelName = modelName;
        this.cache = new AnkiNoteCache();
        this.addOperation = new AddNoteOperation();
        this.updateOperation = new UpdateNoteOperation(this.cache);
        this.deleteOperation = new DeleteNoteOperation();
        this.assetOperation = new AssetOperation();
    }

    async init(): Promise<void> {
        await this.cache.buildNoteInfoMap(this.modelName);
        await this.cache.buildMediaInfo();
    }

    get noteInfoMap(): Map<number, AnkiNoteInfo> {
        return this.cache.noteInfoMapRaw;
    }

    get mediaInfo(): Set<string> {
        return this.cache["mediaInfo"];
    }

    addNote(deckName: string, modelName: string, fields: AnkiNoteFields, tags: string[]): void {
        this.addOperation.addNote(deckName, modelName, fields, tags);
    }

    updateNote(
        ankiId: number,
        deckName: string,
        modelName: string,
        fields: AnkiNoteFields,
        tags: string[]
    ): void {
        this.updateOperation.updateNote(ankiId, deckName, modelName, fields, tags);
    }

    deleteNote(ankiId: number): void {
        this.deleteOperation.deleteNote(ankiId);
    }

    storeAsset(filename: string, path: string): void {
        this.assetOperation.storeAsset(filename, path);
    }

    async executeAddNotes(): Promise<AddNotesResult> {
        return await this.addOperation.execute();
    }

    async executeUpdateNotes(): Promise<UpdateNotesResult> {
        return await this.updateOperation.execute();
    }

    async executeDeleteNotes(): Promise<DeleteNotesResult> {
        return await this.deleteOperation.execute();
    }

    async executeAssets(): Promise<void> {
        await this.assetOperation.execute();
    }
}
