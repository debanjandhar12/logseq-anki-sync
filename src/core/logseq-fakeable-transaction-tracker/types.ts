import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity
} from "@logseq/libs/dist/LSPlugin";

export type LogseqEntityIdentity = PageIdentity | BlockIdentity | EntityID;

export type InMemoryBlockEntity = BlockEntity;

export type InMemoryPageEntity = Pick<
    PageEntity,
    | "id"
    | "uuid"
    | "name"
    | "format"
    | "type"
    | "updatedAt"
    | "createdAt"
    | "journal?"
    | "title"
    | "file"
    | "originalName"
    | "namespace"
    | "properties"
    | "journalDay"
    | "ident"
> & {
    children?: InMemoryLogseqEntity[];
    [key: string]: unknown;
};

export type InMemoryLogseqEntity = InMemoryPageEntity | InMemoryBlockEntity;

export type InMemoryDB = Map<string, InMemoryPageEntity>;

export type LogseqTransactionResult = InMemoryLogseqEntity | BlockEntity | PageEntity | boolean;

export interface LogseqTransactionExecutor {
    insertBlock(parentBlockUUID: LogseqEntityIdentity, content: string): Promise<boolean>;
    moveBlock(
        srcBlockUUID: LogseqEntityIdentity,
        destBlockUUID: LogseqEntityIdentity
    ): Promise<boolean>;
    updateBlock(blockUUID: LogseqEntityIdentity, content: string): Promise<boolean>;
    createPage(pageName: string, properties?: Record<string, any>): Promise<boolean>;
    deletePage(pageIdentity: LogseqEntityIdentity): Promise<boolean>;
    renamePage(pageIdentity: LogseqEntityIdentity, newName: string): Promise<boolean>;
    getLastResult(): LogseqTransactionResult | undefined;
    getResults(): readonly LogseqTransactionResult[];
}

export interface LogseqFakeableCommand {
    execute(executor: LogseqTransactionExecutor): Promise<void>;
}

export type SerializedLogseqFakeableCommand =
    | {
          type: "CreatePage";
          pageName: string;
          properties?: Record<string, any>;
      }
    | {
          type: "DeletePage";
          pageUuid: LogseqEntityIdentity;
      }
    | {
          type: "InsertBlock";
          parentUuid: LogseqEntityIdentity;
          content: string;
      }
    | {
          type: "MoveBlock";
          srcBlockUuid: LogseqEntityIdentity;
          destBlockUuid: LogseqEntityIdentity;
      }
    | {
          type: "RenamePage";
          pageUuid: LogseqEntityIdentity;
          newName: string;
      }
    | {
          type: "UpdateBlock";
          blockUuid: LogseqEntityIdentity;
          content: string;
      };

export type SerializedLogseqFakeableTransactionTracker = {
    uuidGenerationSeed: string;
    commands: SerializedLogseqFakeableCommand[];
};
