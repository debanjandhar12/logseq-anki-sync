export class SandboxSnapshotError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SandboxSnapshotError";
    }
}
