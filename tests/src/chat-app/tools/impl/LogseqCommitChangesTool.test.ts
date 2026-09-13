import {describe, expect, test, vi} from "vitest";
import {LogseqCommitChangesTool} from "../../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";
import {
    BaseReversibleCommand,
    LogseqPageDataPrinter,
    type LogseqReversibleTransactionResult,
    LogseqReversibleTransactionTracker
} from "../../../../../src/core/logseq-reversible-transaction-tracker";

class TestMutationCommand extends BaseReversibleCommand<{status: "new" | "executed"}> {
    public readonly args = {};
    public readonly executeMock: ReturnType<
        typeof vi.fn<() => Promise<LogseqReversibleTransactionResult>>
    >;
    public readonly revertMock = vi.fn<() => Promise<void>>();

    public constructor(options?: {
        execute?: () => Promise<LogseqReversibleTransactionResult>;
        changedPages?: string[];
    }) {
        super({status: "new"});
        this.executeMock = vi.fn(options?.execute ?? (async () => undefined));
        this.changedPages = options?.changedPages ?? [];
    }

    public async execute(): Promise<LogseqReversibleTransactionResult> {
        this.assertCanExecute();
        const result = await this.executeMock();
        this.commandState.status = "executed";
        return result;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
        await this.revertMock();
        this.commandState.status = "new";
    }

    public resetChangedPages(): void {}
}

describe("LogseqCommitChangesTool", () => {
    test("retains uncommitted changes when commit execution fails", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(
            new TestMutationCommand({execute: async () => Promise.reject(new Error("failed"))})
        );

        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined, tracker);

        expect(response.result).toEqual({
            success: false,
            error: "Failed to commit Logseq changes: Failed to execute TestMutationCommand: failed. Uncommitted changes remain available."
        });
        expect(tracker.getCommands()).toEqual([]);
    });

    test("does not prepare a modal review for equal page snapshots", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new TestMutationCommand({changedPages: ["page-uuid"]}));
        vi.spyOn(LogseqPageDataPrinter, "print").mockResolvedValue([
            {
                identityKey: "page-uuid",
                resolvedPageUuid: "page-uuid",
                exists: true,
                pageName: "Page",
                content: "* Same",
                pageType: "logseq-page"
            }
        ]);

        await expect(new LogseqCommitChangesTool().prepareReview(tracker)).resolves.toEqual({
            kind: "no-reviewable-page-changes"
        });
    });
});
