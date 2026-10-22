import "@logseq/libs";

declare global {
    interface Window {
        LogseqAstroBox: {showAIChat: () => Promise<void>};
    }
}
