import {describe, expect, test, vi} from "vitest";
import {
    BaseReversibleCommand,
    DataScriptQueryCommand,
    LogseqReversibleTransactionExecutionError,
    LogseqReversibleTransactionTracker
} from "../../../../src/core/logseq-reversible-transaction-tracker";
import {ReadBlockCommand} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/ReadBlockCommand";
import {TextSearchCommand} from "../../../../src/core/logseq-reversible-transaction-tracker/commands/TextSearchCommand";

class TestCommand extends BaseReversibleCommand<{status: "new" | "executed"}> {
    public readonly args = {};
    public readonly executeMock: ReturnType<typeof vi.fn<() => Promise<unknown>>>;
    public readonly revertMock: ReturnType<typeof vi.fn<() => Promise<void>>>;

    public constructor(options?: {
        execute?: () => Promise<unknown>;
        revert?: () => Promise<void>;
        changedPage?: string;
        doesGraphMutations?: boolean;
    }) {
        super({status: "new"});
        this.executeMock = vi.fn(options?.execute ?? (async () => null));
        this.revertMock = vi.fn(options?.revert ?? (async () => {}));
        this.doesGraphMutationsMock = vi.fn(() => options?.doesGraphMutations ?? true);
        if (options?.changedPage) this.changedPages.push(options.changedPage);
    }

    public readonly doesGraphMutationsMock: ReturnType<typeof vi.fn<() => boolean>>;

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

    public doesGraphMutations(): boolean {
        return this.doesGraphMutationsMock();
    }
}

describe("LogseqReversibleTransactionTracker", () => {
    test("defaults commands to graph mutations and marks read-only commands as non-mutating", () => {
        expect(new TestCommand().doesGraphMutations()).toBe(true);
        expect(new ReadBlockCommand({uuid: "block-uuid"}).doesGraphMutations()).toBe(false);
        expect(
            new DataScriptQueryCommand({
                datalogString: "[:find ?b :where [?b :block/uuid]]"
            }).doesGraphMutations()
        ).toBe(false);
        expect(new TextSearchCommand({searchString: "needle"}).doesGraphMutations()).toBe(false);
    });

    test("counts queued and applied graph mutation commands separately", async () => {
        const first = new TestCommand({changedPage: "page-1"});
        const readOnly = new TestCommand({doesGraphMutations: false});
        const second = new TestCommand({changedPage: "page-2"});
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(first);
        tracker.addCommand(readOnly);
        tracker.addCommand(second);

        expect(tracker.getGraphMutationCommandCount()).toBe(2);
        expect(tracker.getAppliedGraphMutationCommandCount()).toBe(0);
        expect(tracker.hasAppliedGraphMutations()).toBe(false);

        await tracker.execute();

        expect(tracker.getAppliedCommandCount()).toBe(3);
        expect(tracker.getGraphMutationCommandCount()).toBe(2);
        expect(tracker.getAppliedGraphMutationCommandCount()).toBe(2);
        expect(tracker.hasAppliedGraphMutations()).toBe(true);
        expect(tracker.getChangedPages()).toEqual(["page-1", "page-2"]);
    });

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
        await tracker.revertAppliedCommands();

        expect(order).toEqual(["execute-first", "execute-second", "revert-second", "revert-first"]);
        expect(first.executeMock).toHaveBeenCalledOnce();
        expect(second.executeMock).toHaveBeenCalledOnce();
        expect(tracker.getAppliedCommandCount()).toBe(0);
        expect(tracker.getChangedPages()).toEqual(["page-1", "page-2"]);
    });

    test("keeps successful commands and removes only the command whose execute fails", async () => {
        const applied = new TestCommand();
        const newlyApplied = new TestCommand();
        const failure = new Error("execute failed");
        const failing = new TestCommand({execute: async () => Promise.reject(failure)});
        const pending = new TestCommand();
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(applied);
        await tracker.execute();
        tracker.addCommand(newlyApplied);
        tracker.addCommand(failing);
        tracker.addCommand(pending);

        await expect(tracker.execute()).rejects.toMatchObject({
            name: "LogseqReversibleTransactionExecutionError",
            cause: failure,
            tracker
        });

        expect(applied.revertMock).not.toHaveBeenCalled();
        expect(newlyApplied.revertMock).not.toHaveBeenCalled();
        expect(failing.revertMock).not.toHaveBeenCalled();
        expect(pending.executeMock).not.toHaveBeenCalled();
        expect(tracker.getAppliedCommandCount()).toBe(2);
        expect(tracker.getCommands()).toEqual([applied, newlyApplied, pending]);
        expect(applied.getCommandState().status).toBe("executed");
        expect(newlyApplied.getCommandState().status).toBe("executed");
        expect(failing.getCommandState().status).toBe("new");
        expect(pending.getCommandState().status).toBe("new");
    });

    test("exposes the original execute error and updated tracker", async () => {
        const executeFailure = new Error("execute failed");
        const successful = new TestCommand();
        const failing = new TestCommand({execute: async () => Promise.reject(executeFailure)});
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(successful);
        tracker.addCommand(failing);

        const error = await tracker.execute().catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(LogseqReversibleTransactionExecutionError);
        expect(error).toMatchObject({cause: executeFailure, tracker});
        expect(successful.revertMock).not.toHaveBeenCalled();
        expect(failing.revertMock).not.toHaveBeenCalled();
        expect(tracker.getAppliedCommandCount()).toBe(1);
        expect(tracker.getCommands()).toEqual([successful]);
    });

    test("stops reverting at the first failure and preserves the applied prefix", async () => {
        const order: string[] = [];
        const first = new TestCommand({
            execute: async () => order.push("execute-first"),
            revert: async () => {
                order.push("revert-first");
            }
        });
        const second = new TestCommand({
            execute: async () => order.push("execute-second"),
            revert: async () => {
                order.push("revert-second");
                throw new Error("second revert failed");
            }
        });
        const third = new TestCommand({
            execute: async () => order.push("execute-third"),
            revert: async () => {
                order.push("revert-third");
            }
        });
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(first);
        tracker.addCommand(second);
        tracker.addCommand(third);

        await tracker.execute();
        await expect(tracker.revertAppliedCommands()).rejects.toThrow("second revert failed");

        expect(order).toEqual([
            "execute-first",
            "execute-second",
            "execute-third",
            "revert-third",
            "revert-second"
        ]);
        expect(first.revertMock).not.toHaveBeenCalled();
        expect(second.revertMock).toHaveBeenCalledOnce();
        expect(third.revertMock).toHaveBeenCalledOnce();
        expect(tracker.getAppliedCommandCount()).toBe(2);
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
