import {describe, expect, test} from "vitest";
import {
    CreatePageCommand,
    LogseqReversibleTransactionCommandSerializer,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer,
    UpdateBlockCommand
} from "../../../../src/core/logseq-reversible-transaction-tracker";

describe("LogseqReversibleTransactionCommandSerializer", () => {
    test("round trips nested args and stable command state", () => {
        const command = new CreatePageCommand(
            {pageName: "Codec Test"},
            {
                status: "executed",
                pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"
            }
        );

        const serialized = LogseqReversibleTransactionCommandSerializer.serialize(command);
        const deserialized = LogseqReversibleTransactionCommandSerializer.deserialize(serialized);

        expect(serialized).toEqual({
            type: "CreatePage",
            args: {pageName: "Codec Test"},
            commandState: {
                status: "executed",
                pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"
            }
        });
        expect(deserialized).toBeInstanceOf(CreatePageCommand);
        expect(LogseqReversibleTransactionCommandSerializer.serialize(deserialized)).toEqual(
            serialized
        );
    });

    test("round trips runtime rollback state", () => {
        const command = new UpdateBlockCommand(
            {
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f30",
                content: "Updated"
            },
            {status: "executed", originalContent: "Original"}
        );

        expect(LogseqReversibleTransactionCommandSerializer.serialize(command)).toEqual({
            type: "UpdateBlock",
            args: {
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f30",
                content: "Updated"
            },
            commandState: {status: "executed", originalContent: "Original"}
        });
    });

    test("migrates legacy flattened commands as reverted", () => {
        const command = LogseqReversibleTransactionCommandSerializer.deserialize({
            type: "InsertBlock",
            parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
            content: "Inserted",
            sibling: true,
            blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
        });

        expect(LogseqReversibleTransactionCommandSerializer.serialize(command)).toEqual({
            type: "InsertBlock",
            args: {
                parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                content: "Inserted",
                sibling: true
            },
            commandState: {
                status: "new",
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
            }
        });
    });
});

describe("LogseqReversibleTransactionTrackerSerializer", () => {
    test("round trips progress and changed pages", () => {
        const tracker = new LogseqReversibleTransactionTracker({
            appliedCommandCount: 1,
            changedPages: ["page-uuid"]
        });
        tracker.addCommand(
            new CreatePageCommand(
                {pageName: "Tracker Test"},
                {
                    status: "executed",
                    pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"
                }
            )
        );

        const serialized = LogseqReversibleTransactionTrackerSerializer.serialize(tracker);
        const deserialized = LogseqReversibleTransactionTrackerSerializer.deserialize(serialized);

        expect(serialized).toEqual({
            version: 2,
            commands: [
                {
                    type: "CreatePage",
                    args: {pageName: "Tracker Test"},
                    commandState: {
                        status: "executed",
                        pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"
                    }
                }
            ],
            appliedCommandCount: 1,
            changedPages: ["page-uuid"]
        });
        expect(deserialized.getAppliedCommandCount()).toBe(1);
        expect(deserialized.getChangedPages()).toEqual(["page-uuid"]);
    });

    test("migrates legacy trackers to safe reverted progress", () => {
        const tracker = LogseqReversibleTransactionTrackerSerializer.deserialize({
            commands: [
                {
                    type: "CreatePage",
                    pageName: "Legacy",
                    pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"
                }
            ]
        });

        expect(LogseqReversibleTransactionTrackerSerializer.serialize(tracker)).toMatchObject({
            version: 2,
            appliedCommandCount: 0,
            changedPages: [],
            commands: [{commandState: {status: "new"}}]
        });
    });

    test("rejects progress and command status mismatches", () => {
        expect(() =>
            LogseqReversibleTransactionTrackerSerializer.deserialize({
                version: 2,
                appliedCommandCount: 1,
                changedPages: [],
                commands: [
                    {
                        type: "CreatePage",
                        args: {pageName: "Mismatch"},
                        commandState: {
                            status: "new",
                            pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"
                        }
                    }
                ]
            })
        ).toThrow("Tracker command status does not match applied command count");
    });
});
