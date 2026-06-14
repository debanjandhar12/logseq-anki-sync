import {describe, expect, test} from "vitest";
import {
    CreatePageCommand,
    InsertBlockCommand,
    LogseqReversibleTransactionCommandSerializer,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer,
    UpdateBlockCommand
} from "../../../../src/core/logseq-reversible-transaction-tracker";

describe("LogseqReversibleTransactionCommandSerializer", () => {
    test("round trips a command", () => {
        const command = new CreatePageCommand({pageName: "Codec Test"});

        const serialized = LogseqReversibleTransactionCommandSerializer.serialize(command);
        const deserialized = LogseqReversibleTransactionCommandSerializer.deserialize(serialized);

        expect(serialized).toEqual({type: "CreatePage", pageName: "Codec Test"});
        expect(deserialized).toBeInstanceOf(CreatePageCommand);
        expect(deserialized).toEqual(command);
    });

    test("rejects malformed command fields", () => {
        expect(() =>
            LogseqReversibleTransactionCommandSerializer.deserialize({
                type: "UpdateBlock",
                blockUuid: "block-uuid",
                content: 123
            })
        ).toThrow();
    });

    test("rejects unknown command types", () => {
        expect(() =>
            LogseqReversibleTransactionCommandSerializer.deserialize({
                type: "UnknownCommand",
                pageName: "Codec Test"
            })
        ).toThrow();
    });
});

describe("LogseqReversibleTransactionTrackerSerializer", () => {
    test("round trips a tracker with nested commands", () => {
        const tracker = new LogseqReversibleTransactionTracker(
            "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d"
        );
        tracker.addCommand(new CreatePageCommand({pageName: "Tracker Test"}));
        tracker.addCommand(
            new InsertBlockCommand({
                parentUuid: "Tracker Test",
                content: "Inserted content",
                options: {sibling: false}
            })
        );
        tracker.addCommand(
            new UpdateBlockCommand({blockUuid: {uuid: "block-uuid"}, content: "Updated"})
        );

        const serialized = LogseqReversibleTransactionTrackerSerializer.serialize(tracker);
        const deserialized = LogseqReversibleTransactionTrackerSerializer.deserialize(serialized);

        expect(serialized).toEqual({
            uuidGenerationSeed: "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d",
            commands: [
                {type: "CreatePage", pageName: "Tracker Test"},
                {
                    type: "InsertBlock",
                    parentUuid: "Tracker Test",
                    content: "Inserted content",
                    options: {sibling: false}
                },
                {type: "UpdateBlock", blockUuid: {uuid: "block-uuid"}, content: "Updated"}
            ]
        });
        expect(deserialized).toBeInstanceOf(LogseqReversibleTransactionTracker);
        expect(deserialized.getCommands()[0]).toBeInstanceOf(CreatePageCommand);
        expect(deserialized.getCommands()[1]).toBeInstanceOf(InsertBlockCommand);
        expect(deserialized.getCommands()[2]).toBeInstanceOf(UpdateBlockCommand);
    });

    test("rejects invalid tracker artifacts", () => {
        expect(() =>
            LogseqReversibleTransactionTrackerSerializer.deserialize({
                uuidGenerationSeed: "not-a-uuid",
                commands: []
            })
        ).toThrow();
    });
});
