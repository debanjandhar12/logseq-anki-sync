import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity
} from "@logseq/libs/dist/LSPlugin";
import type {LogseqTransactionExecutor} from "./executor/LogseqTransactionExecutor";
import type {InsertBlockOptions, MoveBlockOptions} from "./executor/LogseqTransactionExecutor";

export type LogseqEntityIdentity = PageIdentity | BlockIdentity | EntityID;

export type InMemoryEntityReference = {uuid: string};

type InMemoryEntityBaseKeys =
    | "uuid"
    | "format"
    | "title"
    | "fullTitle"
    | "content"
    | "createdAt"
    | "updatedAt"
    | "properties";

type InMemoryEntityBase = Pick<BlockEntity, "uuid"> &
    Partial<Pick<BlockEntity, Exclude<InMemoryEntityBaseKeys, "uuid">>>;

export type InMemoryBlockEntity = Omit<
    Pick<BlockEntity, InMemoryEntityBaseKeys | "parent" | "page" | "children">,
    "parent" | "page" | "children"
> & {
    type?: "block";
    parent?: InMemoryEntityReference;
    page?: InMemoryEntityReference;
    children?: InMemoryLogseqEntity[];
};

export type InMemoryPageEntity = InMemoryEntityBase &
    Pick<PageEntity, "name" | "journal?"> & {
        type: "page";
        originalName?: PageEntity["originalName"];
        children?: InMemoryLogseqEntity[];
    };

export type InMemoryLogseqEntity = InMemoryPageEntity | InMemoryBlockEntity;

export type InMemoryDB = Map<string, InMemoryPageEntity>;

export type LogseqTransactionResult = InMemoryLogseqEntity | BlockEntity | PageEntity | boolean;

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
          options?: InsertBlockOptions;
      }
    | {
          type: "MoveBlock";
          srcBlockUuid: LogseqEntityIdentity;
          destBlockUuid: LogseqEntityIdentity;
          options?: MoveBlockOptions;
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
