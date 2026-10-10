export class SandboxWriteBackAbortedError extends Error {
    constructor() {
        super("execution aborted before filesystem write-back");
        this.name = "SandboxWriteBackAbortedError";
    }
}
