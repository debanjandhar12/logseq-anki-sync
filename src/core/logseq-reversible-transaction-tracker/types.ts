import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import type {LogseqEditor} from "src/logseq/LogseqEditor";

export type LogseqReversibleTransactionResult =
    | BlockEntity
    | PageEntity
    | {
          type: "block" | "page" | "tag" | "property";
          block:
              | BlockEntity
              | PageEntity
              | (Omit<PageEntity, "children"> & {children?: BlockEntity[]})
              | Awaited<ReturnType<typeof LogseqEditor.getProperty>>
              | null;
      }
    | boolean
    | undefined;
