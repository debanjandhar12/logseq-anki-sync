import "@logseq/libs";
import type {SyncResult} from "../sync/types";

declare global {
    interface Window {
        LogseqAiChat: any;
    }
}
