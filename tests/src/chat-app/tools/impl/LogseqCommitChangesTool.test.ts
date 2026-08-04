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
    test("reports that absent temporary changes were not discarded", async () => {
        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined);

        expect(response.result).toEqual({
            success: true,
            changes: "No temporary changes to commit. Temporary changes were not discarded."
        });
    });

    test("commits queued changes without reporting them as discarded", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        const command = new TestMutationCommand();
        tracker.addCommand(command);

        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined, tracker);

        expect(command.executeMock).toHaveBeenCalledOnce();
        expect(response.result).toEqual({
            success: true,
            changes:
                "All temporary Logseq changes committed successfully. Temporary changes were not discarded."
        });
        expect(tracker.getCommands()).toEqual([]);
        expect(getArtifactTracker(response).getCommands()).toEqual([]);
    });

    test("retains temporary changes when commit execution fails", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(
            new TestMutationCommand({execute: async () => Promise.reject(new Error("failed"))})
        );

        const response = await new LogseqCommitChangesTool().executeApprove({}, undefined, tracker);

        expect(response.result).toEqual({
            success: false,
            error: "Failed to commit Logseq changes: Failed to execute TestMutationCommand: failed. Temporary changes were not discarded."
        });
        expect(tracker.getCommands()).toEqual([]);
    });

    test("discards queued temporary changes when the user rejects the commit", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(new TestMutationCommand());

        const response = await new LogseqCommitChangesTool().executeCancel(tracker);

        expect(response.result).toEqual({
            success: false,
            error: "User rejected the commit operation. Temporary changes were discarded."
        });
        expect(tracker.getCommands()).toEqual([]);
        expect(getArtifactTracker(response).getCommands()).toEqual([]);
    });
});
