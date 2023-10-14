export class UI {
    public static init() {
        logseq.provideStyle(`
        .reduce-opacity-when-disabled:disabled {
            opacity: 0.5;
        }
        .not-allowed-cursor-when-disabled:disabled {
            cursor: not-allowed;
        }
        `);
    }
}