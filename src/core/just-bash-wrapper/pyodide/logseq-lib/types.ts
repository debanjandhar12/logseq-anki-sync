/** The only host capability exposed to the Python Logseq module. */
export interface LogseqLibBridge {
    methods: string[];
    call(method: string, args: Record<string, unknown>): Promise<unknown>;
}

export type CreateLogseqBridge = () => {
    bridge: LogseqLibBridge;
    close(): Promise<void>;
};
