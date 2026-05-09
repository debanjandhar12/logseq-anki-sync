import "@logseq/libs";
import type {SyncResult} from "../sync/types";

declare global {
    interface Window {
        LogseqAnkiSync: any;
        fabric: any;
        lastSyncLogseqToAnkiResult: SyncResult | null;
        AnkiConnect: any;
    }
}
