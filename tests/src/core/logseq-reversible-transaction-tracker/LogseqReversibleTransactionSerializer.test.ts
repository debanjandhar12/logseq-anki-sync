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

    test("rejects progress and command status mismatches", () => {
        expect(() =>
            LogseqReversibleTransactionTrackerSerializer.deserialize({
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
