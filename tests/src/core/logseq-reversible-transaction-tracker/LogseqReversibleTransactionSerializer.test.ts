import {describe, expect, test} from "vitest";
import {
    LogseqReversibleTransactionCommandSerializer,
    LogseqReversibleTransactionTrackerSerializer,
    UpdateBlockCommand
} from "../../../../src/core/logseq-reversible-transaction-tracker";

describe("LogseqReversibleTransactionCommandSerializer", () => {
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
