import {describe, expect, test, vi} from "vitest";
import {LogseqCommitChangesTool} from "../../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";
import {
    LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
    type ToolResponseArtifact
} from "../../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    BaseReversibleCommand,
    LogseqPageDataPrinter,
    type LogseqReversibleTransactionResult,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
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

const getArtifactTracker = (response: {artifact?: unknown}) => {
    const artifact = response.artifact as ToolResponseArtifact;
    return LogseqReversibleTransactionTrackerSerializer.deserialize(
        artifact[LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE]
            .LogseqReversibleTransactionTracker
    );
};

describe("LogseqCommitChangesTool", () => {
    test("reports when no uncommitted changes are available to review or commit", async () => {
        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined);

        expect(response.result).toEqual({
            success: true,
            changes: "No uncommitted changes are available to review or commit.",
            outcome: "no-changes"
        });
    });

    test("commits uncommitted changes as committed changes", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        const command = new TestMutationCommand();
        tracker.addCommand(command);

        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined, tracker);

        expect(command.executeMock).toHaveBeenCalledOnce();
        expect(response.result).toEqual({
            success: true,
            changes: "Committed changes successfully. They are now committed changes.",
            outcome: "committed"
        });
        expect(tracker.getCommands()).toEqual([]);
        expect(getArtifactTracker(response).getCommands()).toEqual([]);
    });

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

    test("discards uncommitted changes when the user declines the commit", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new TestMutationCommand());

        const response = await new LogseqCommitChangesTool().executeCancel(tracker);

        expect(response.result).toEqual({
            success: false,
            error: "The commit was declined. Uncommitted changes were discarded."
        });
        expect(tracker.getCommands()).toEqual([]);
        expect(getArtifactTracker(response).getCommands()).toEqual([]);
    });

    test("prepares ordered page changes after execution and reversion", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        const command = new TestMutationCommand({changedPages: ["page-uuid"]});
        tracker.addCommand(command);
        const printSpy = vi
            .spyOn(LogseqPageDataPrinter, "print")
            .mockResolvedValueOnce([
                {
                    identityKey: "page-uuid",
                    resolvedPageUuid: "page-uuid",
                    exists: true,
                    pageName: "Page",
                    content: "* After",
                    pageType: "logseq-tag-page"
                }
            ])
            .mockResolvedValueOnce([
                {
                    identityKey: "page-uuid",
                    resolvedPageUuid: "page-uuid",
                    exists: true,
                    pageName: "Page",
                    content: "* Before",
                    pageType: "logseq-tag-page"
                }
            ]);

        const prepared = await new LogseqCommitChangesTool().prepareReview(tracker);

        expect(command.executeMock).toHaveBeenCalledOnce();
        expect(command.revertMock).toHaveBeenCalledOnce();
        expect(printSpy).toHaveBeenNthCalledWith(1, ["page-uuid"]);
        expect(printSpy).toHaveBeenNthCalledWith(2, ["page-uuid"]);
        expect(prepared).toEqual({
            kind: "reviewable-page-changes",
            changes: [
                {
                    key: "changed-page-0",
                    before: {
                        pageName: "Page",
                        content: "* Before",
                        pageType: "logseq-tag-page"
                    },
                    after: {
                        pageName: "Page",
                        content: "* After",
                        pageType: "logseq-tag-page"
                    }
                }
            ]
        });
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
