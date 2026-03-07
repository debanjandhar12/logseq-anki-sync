import '@logseq/libs';
import {SyncResult} from "../sync/types";

export {};

declare global {
    interface Window {
        LogseqAnkiSync: any;
        fabric: any;
        lastSyncLogseqToAnkiResult: SyncResult | null;
        AnkiConnect: any;
    }
}
