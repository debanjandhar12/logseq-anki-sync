import type {PropertySchema} from "@logseq/libs/dist/LSPlugin";
import type {DeterminesticUUIDGenerator} from "../DeterminesticUUIDGenerator";
import type {LogseqEntityIdentity, LogseqTransactionResult} from "../types";

export type InsertBlockOptions = Partial<{
    before: boolean;
    sibling: boolean;
    start: boolean;
    end: boolean;
}>;

export type MoveBlockOptions = Partial<{
    before: boolean;
    children: boolean;
}>;

export const DEFAULT_INSERT_BLOCK_OPTIONS = {
    before: false,
    sibling: false,
    start: false,
    end: false
} as const satisfies Required<InsertBlockOptions>;

export const DEFAULT_MOVE_BLOCK_OPTIONS = {
    before: false,
    children: true
} as const satisfies Required<MoveBlockOptions>;

export abstract class LogseqTransactionExecutor {
    protected readonly results: LogseqTransactionResult[] = [];

    public constructor(protected readonly uuidGenerator: DeterminesticUUIDGenerator) {}

    public getLastResult(): LogseqTransactionResult | undefined {
        return this.results.at(-1);
    }

    public getResults(): readonly LogseqTransactionResult[] {
        return this.results;
    }

    protected pushAndReturn<TReturn>(
        result: LogseqTransactionResult,
        returnValue: TReturn
    ): TReturn {
        this.results.push(result);
        return returnValue;
    }

    public abstract insertBlock(
        parentBlockUUID: LogseqEntityIdentity,
        content: string,
        options?: InsertBlockOptions
    ): Promise<boolean>;

    public abstract moveBlock(
        srcBlockUUID: LogseqEntityIdentity,
        destBlockUUID: LogseqEntityIdentity,
        options?: MoveBlockOptions
    ): Promise<boolean>;

    public abstract updateBlock(blockUUID: LogseqEntityIdentity, content: string): Promise<boolean>;

    public abstract createPage(
        pageName: string,
        properties?: Record<string, any>
    ): Promise<boolean>;

    public abstract deletePage(pageIdentity: LogseqEntityIdentity): Promise<boolean>;

    public abstract renamePage(
        pageIdentity: LogseqEntityIdentity,
        newName: string
    ): Promise<boolean>;

    public abstract upsertProperty(
        key: string,
        schema?: Partial<PropertySchema>,
        options?: {name?: string}
    ): Promise<boolean>;

    public abstract removeProperty(key: string): Promise<boolean>;

    public abstract upsertBlockProperty(
        block: LogseqEntityIdentity,
        key: string,
        value: any,
        options?: Partial<{reset: boolean}>
    ): Promise<boolean>;

    public abstract removeBlockProperty(block: LogseqEntityIdentity, key: string): Promise<boolean>;
}
