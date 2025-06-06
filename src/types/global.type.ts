import '@logseq/libs';

export {};

declare global {
    interface Window {
        LogseqAnkiSync: any;
        fabric: any;
        AnkiConnect: any;
    }
}
