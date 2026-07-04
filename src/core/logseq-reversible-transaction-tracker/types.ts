import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";

export type LogseqReversibleTransactionResult =
    | BlockEntity
    | PageEntity
    | {
          type: "block" | "page";
          block: BlockEntity | (Omit<PageEntity, "children"> & {children?: BlockEntity[]}) | null;
      }
    | boolean
    | undefined;
