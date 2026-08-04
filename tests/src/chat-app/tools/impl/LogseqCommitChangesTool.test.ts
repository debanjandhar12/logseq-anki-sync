import {describe, expect, test, vi} from "vitest";
import {LogseqCommitChangesTool} from "../../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";
import {
    LOGSEQ_REVERSIBLE_TRANSACTION_TRACKER_ARTIFACT_TYPE,
    type ToolResponseArtifact
} from "../../../../../src/chat-app/tools/transaction/createLogseqReversibleTransactionTrackerArtifact";
import {
    BaseReversibleCommand,
    type LogseqReversibleTransactionResult,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer
} from "../../../../../src/core/logseq-reversible-transaction-tracker";

class TestMutationCommand extends BaseReversibleCommand<{status: "new" | "executed"}> {
    public readonly args = {};
    public readonly executeMock: ReturnType<
        typeof vi.fn<() => Promise<LogseqReversibleTransactionResult>>
    >;

    public constructor(options?: {execute?: () => Promise<LogseqReversibleTransactionResult>}) {
        super({status: "new"});
        this.executeMock = vi.fn(options?.execute ?? (async () => undefined));
    }

    public async execute(): Promise<LogseqReversibleTransactionResult> {
        this.assertCanExecute();
        const result = await this.executeMock();
        this.commandState.status = "executed";
        return result;
    }

    public async revert(): Promise<void> {
        this.assertCanRevert();
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
    test("reports when no changes are ready to review or commit", async () => {
        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined);

        expect(response.result).toEqual({
            success: true,
            changes: "No changes are ready to review or commit."
        });
    });

    test("commits queued review changes as permanent changes", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        const command = new TestMutationCommand();
        tracker.addCommand(command);

        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined, tracker);

        expect(command.executeMock).toHaveBeenCalledOnce();
        expect(response.result).toEqual({
            success: true,
            changes: "Changes committed successfully. They are now permanent."
        });
        expect(tracker.getCommands()).toEqual([]);
        expect(getArtifactTracker(response).getCommands()).toEqual([]);
    });

    test("retains review changes when commit execution fails", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(
            new TestMutationCommand({execute: async () => Promise.reject(new Error("failed"))})
        );

        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined, tracker);

        expect(response.result).toEqual({
            success: false,
            error: "Failed to commit Logseq changes: Failed to execute TestMutationCommand: failed. Review changes remain available."
        });
        expect(tracker.getCommands()).toEqual([]);
    });

    test("discards queued review changes when the user declines the commit", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new TestMutationCommand());

        const response = await new LogseqCommitChangesTool().executeCancel(tracker);

        expect(response.result).toEqual({
            success: false,
            error: "The commit was declined. Review changes were discarded."
        });
        expect(tracker.getCommands()).toEqual([]);
        expect(getArtifactTracker(response).getCommands()).toEqual([]);
    });
});
