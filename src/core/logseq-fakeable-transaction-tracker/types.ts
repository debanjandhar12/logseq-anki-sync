import type {
    BlockEntity,
    BlockIdentity,
    EntityID,
    PageEntity,
    PageIdentity,
    PropertySchema
} from "@logseq/libs/dist/LSPlugin";
import type {
    InsertBlockOptions,
    LogseqTransactionExecutor,
    MoveBlockOptions
} from "./executor/LogseqTransactionExecutor";

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
    | "ident"
    | "properties";

type InMemoryEntityBase = Pick<BlockEntity, "uuid"> &
    Partial<Pick<BlockEntity, Exclude<InMemoryEntityBaseKeys, "uuid">>>;

export type InMemoryBlockEntity = Omit<
    Pick<BlockEntity, InMemoryEntityBaseKeys | "parent" | "page" | "children">,
    "parent" | "page" | "children"
> & {
    id?: EntityID;
    type?: "block";
    parent?: InMemoryEntityReference;
    page?: InMemoryEntityReference;
    children?: InMemoryLogseqEntity[];
};

export type InMemoryPageEntity = InMemoryEntityBase &
    Pick<PageEntity, "name" | "journal?"> & {
        id?: EntityID;
        type: "page";
        pageType?: PageEntity["type"];
        originalName?: PageEntity["originalName"];
        children?: InMemoryLogseqEntity[];
    };

export type InMemoryLogseqEntity = InMemoryPageEntity | InMemoryBlockEntity;

export type InMemoryDB = Map<string, InMemoryPageEntity>;

export type CreateTagOptions = Partial<{
    uuid: string;
    tagProperties: Array<{
        name: string;
        schema?: Partial<PropertySchema>;
        properties?: Record<string, any>;
    }>;
}>;

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
      }
    | {
          type: "UpsertProperty";
          key: string;
          schema?: Partial<PropertySchema>;
          options?: {name?: string};
      }
    | {
          type: "RemoveProperty";
          key: string;
      }
    | {
          type: "UpsertBlockProperty";
          blockUuid: LogseqEntityIdentity;
          key: string;
          value: any;
          options?: Partial<{reset: boolean}>;
      }
    | {
          type: "RemoveBlockProperty";
          blockUuid: LogseqEntityIdentity;
          key: string;
      }
    | {
          type: "CreateTag";
          tagName: string;
          options?: CreateTagOptions;
      }
    | {
          type: "AddTagProperty" | "RemoveTagProperty";
          tagId: LogseqEntityIdentity;
          propertyIdOrName: LogseqEntityIdentity;
      }
    | {
          type: "AddTagExtends" | "RemoveTagExtends";
          tagId: LogseqEntityIdentity;
          parentTagIdOrName: LogseqEntityIdentity;
      }
    | {
          type: "AddBlockTag" | "RemoveBlockTag";
          blockId: LogseqEntityIdentity;
          tagId: LogseqEntityIdentity;
      };

export type SerializedLogseqFakeableTransactionTracker = {
    uuidGenerationSeed: string;
    commands: SerializedLogseqFakeableCommand[];
};
