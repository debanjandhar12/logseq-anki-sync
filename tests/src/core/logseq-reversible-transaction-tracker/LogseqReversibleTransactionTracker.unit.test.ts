import {describe, expect, test, vi} from "vitest";
import {
    BaseReversibleCommand,
    LogseqReversibleTransactionTracker
} from "../../../../src/core/logseq-reversible-transaction-tracker";

class TestCommand extends BaseReversibleCommand<{status: "new" | "executed"}> {
    public readonly args = {};
    public readonly executeMock: ReturnType<typeof vi.fn<() => Promise<unknown>>>;
    public readonly revertMock: ReturnType<typeof vi.fn<() => Promise<void>>>;

    public constructor(options?: {
        execute?: () => Promise<unknown>;
        revert?: () => Promise<void>;
        changedPage?: string;
    }) {
        super({status: "new"});
        this.executeMock = vi.fn(options?.execute ?? (async () => null));
        this.revertMock = vi.fn(options?.revert ?? (async () => {}));
        if (options?.changedPage) this.changedPages.push(options.changedPage);
    }

    public async execute() {
        this.assertCanExecute();
        const result = await this.executeMock();
        this.commandState.status = "executed";
        return result as any;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        await this.revertMock();
        this.commandState.status = "new";
    }

    public resetChangedPages(): void {}
}

describe("LogseqReversibleTransactionTracker", () => {
    test("executes only newly appended commands and reverts the applied prefix in reverse", async () => {
        const order: string[] = [];
        const first = new TestCommand({
            execute: async () => order.push("execute-first"),
            revert: async () => {
                order.push("revert-first");
            },
            changedPage: "page-1"
        });
        const second = new TestCommand({
            execute: async () => order.push("execute-second"),
            revert: async () => {
                order.push("revert-second");
            },
            changedPage: "page-2"
        });
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(first);

        await tracker.execute();
        await tracker.execute();
        tracker.addCommand(second);
        await tracker.execute();
        await tracker.revertImmediately();

        expect(order).toEqual(["execute-first", "execute-second", "revert-second", "revert-first"]);
        expect(first.executeMock).toHaveBeenCalledOnce();
        expect(second.executeMock).toHaveBeenCalledOnce();
        expect(tracker.getAppliedCommandCount()).toBe(0);
        expect(tracker.getChangedPages()).toEqual(["page-1", "page-2"]);
    });

    test("rolls back only commands applied by a failed incremental execute", async () => {
        const applied = new TestCommand();
        const newlyApplied = new TestCommand();
        const failure = new Error("execute failed");
        const failing = new TestCommand({execute: async () => Promise.reject(failure)});
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(applied);
        await tracker.execute();
        tracker.addCommand(newlyApplied);
        tracker.addCommand(failing);

        await expect(tracker.execute()).rejects.toBe(failure);

        expect(applied.revertMock).not.toHaveBeenCalled();
        expect(newlyApplied.revertMock).toHaveBeenCalledOnce();
        expect(tracker.getAppliedCommandCount()).toBe(1);
        expect(applied.getCommandState().status).toBe("executed");
        expect(newlyApplied.getCommandState().status).toBe("new");
    });

    test("serializes operations across tracker instances with the global lock", async () => {
        let releaseFirst: (() => void) | undefined;
        const firstStarted = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        let allowFirstToFinish: (() => void) | undefined;
        const firstCanFinish = new Promise<void>((resolve) => {
            allowFirstToFinish = resolve;
        });
        const order: string[] = [];
        const firstTracker = new LogseqReversibleTransactionTracker();
        firstTracker.addCommand(
            new TestCommand({
                execute: async () => {
                    order.push("first-start");
                    releaseFirst?.();
                    await firstCanFinish;
                    order.push("first-end");
                }
            })
        );
        const secondTracker = new LogseqReversibleTransactionTracker();
        secondTracker.addCommand(
            new TestCommand({execute: async () => order.push("second-start")})
        );

        const firstExecution = firstTracker.execute();
        await firstStarted;
        const secondExecution = secondTracker.execute();
        await Promise.resolve();
        expect(order).toEqual(["first-start"]);

        allowFirstToFinish?.();
        await Promise.all([firstExecution, secondExecution]);
        expect(order).toEqual(["first-start", "first-end", "second-start"]);
    });
});
