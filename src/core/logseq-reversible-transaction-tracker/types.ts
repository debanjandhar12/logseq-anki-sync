import type {BlockEntity, PageEntity} from "@logseq/libs/dist/LSPlugin";
import type {LogseqEditor} from "src/logseq/LogseqEditor";

export type LogseqReversibleTransactionResult =
    | {stdout: string; stderr: string; exitCode: number}
    | {exists: boolean; content: string | null}
    | {exists: boolean; contentBase64: string | null}
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
