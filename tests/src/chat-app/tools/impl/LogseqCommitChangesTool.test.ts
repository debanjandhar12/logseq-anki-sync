import {afterEach, describe, expect, test, vi} from "vitest";
import {LogseqCommitChangesTool} from "../../../../../src/chat-app/tools/impl/LogseqCommitChangesTool";
import {
    BaseReversibleCommand,
    LogseqAssetDataPrinter,
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

afterEach(() => vi.restoreAllMocks());

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
            kind: "no-reviewable-changes"
        });
    });

    test("reviews asset-only changes and captures both sides around rollback", async () => {
        const tracker = new LogseqReversibleTransactionTracker({
            changedAssets: ["assets/image.png"]
        });
        const command = new TestMutationCommand();
        tracker.addCommand(command);
        const events: string[] = [];
        command.revertMock.mockImplementation(async () => {
            events.push("revert");
        });
        vi.spyOn(LogseqPageDataPrinter, "print").mockResolvedValue([]);
        vi.spyOn(LogseqAssetDataPrinter, "print").mockImplementation(async () => {
            events.push("capture");
            return [
                {
                    assetPath: "assets/image.png",
                    side: events.includes("revert")
                        ? {exists: false}
                        : {
                              exists: true,
                              byteLength: 3,
                              sizeIsExact: true,
                              preview: {kind: "image", mimeType: "image/png", contentBase64: "YWJj"}
                          },
                    comparisonBase64: events.includes("revert") ? undefined : "YWJj"
                }
            ];
        });
        const result = await new LogseqCommitChangesTool().prepareReview(tracker);
        expect(result).toMatchObject({
            kind: "reviewable-changes",
            pageChanges: [],
            assetChanges: [{status: "added", assetPath: "assets/image.png"}]
        });
        expect(events).toEqual(["capture", "revert", "capture"]);
        expect(tracker.getAppliedCommandCount()).toBe(0);
    });

    test("reverts and retains the transaction when asset capture fails", async () => {
        const tracker = new LogseqReversibleTransactionTracker({changedAssets: ["assets/file"]});
        const command = new TestMutationCommand();
        tracker.addCommand(command);
        vi.spyOn(LogseqPageDataPrinter, "print").mockResolvedValue([]);
        vi.spyOn(LogseqAssetDataPrinter, "print").mockRejectedValue(new Error("read failed"));
        await expect(new LogseqCommitChangesTool().prepareReview(tracker)).rejects.toThrow(
            "read failed"
        );
        expect(command.revertMock).toHaveBeenCalledOnce();
        expect(tracker.getCommands()).toHaveLength(1);
        expect(tracker.getAppliedCommandCount()).toBe(0);
    });

    test("includes mixed page and asset changes", async () => {
        const tracker = new LogseqReversibleTransactionTracker({changedAssets: ["assets/file"]});
        tracker.addCommand(new TestMutationCommand({changedPages: ["page"]}));
        const page = {
            identityKey: "page",
            resolvedPageUuid: "page",
            exists: true,
            pageName: "Page",
            content: "after",
            pageType: "logseq-page" as const
        };
        vi.spyOn(LogseqPageDataPrinter, "print")
            .mockResolvedValueOnce([page])
            .mockResolvedValueOnce([{...page, content: "before"}]);
        vi.spyOn(LogseqAssetDataPrinter, "print")
            .mockResolvedValueOnce([
                {
                    assetPath: "assets/file",
                    comparisonBase64: "YQ==",
                    side: {
                        exists: true,
                        byteLength: 1,
                        sizeIsExact: true,
                        preview: {kind: "text", content: "a"}
                    }
                }
            ])
            .mockResolvedValueOnce([{assetPath: "assets/file", side: {exists: false}}]);
        const result = await new LogseqCommitChangesTool().prepareReview(tracker);
        expect(result.kind).toBe("reviewable-changes");
        if (result.kind !== "reviewable-changes") throw new Error("Expected review");
        expect(result.pageChanges).toHaveLength(1);
        expect(result.assetChanges).toHaveLength(1);
    });

    test("retains an already-reverted tracker on before-capture failure", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        const command = new TestMutationCommand();
        tracker.addCommand(command);
        vi.spyOn(LogseqPageDataPrinter, "print").mockResolvedValue([]);
        vi.spyOn(LogseqAssetDataPrinter, "print")
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error("before failed"));
        await expect(new LogseqCommitChangesTool().prepareReview(tracker)).rejects.toThrow(
            "before failed"
        );
        expect(tracker.getAppliedCommandCount()).toBe(0);
        expect(tracker.getCommands()).toHaveLength(1);
    });

    test("reports the dedicated rollback failure when capture and revert fail", async () => {
        const tracker = new LogseqReversibleTransactionTracker();
        const command = new TestMutationCommand();
        command.revertMock.mockRejectedValue(new Error("rollback failed"));
        tracker.addCommand(command);
        vi.spyOn(LogseqPageDataPrinter, "print").mockResolvedValue([]);
        vi.spyOn(LogseqAssetDataPrinter, "print").mockRejectedValue(new Error("capture failed"));
        await expect(new LogseqCommitChangesTool().prepareReview(tracker)).rejects.toMatchObject({
            name: "DiffRevertFailedError",
            cause: new Error("rollback failed")
        });
    });
});
