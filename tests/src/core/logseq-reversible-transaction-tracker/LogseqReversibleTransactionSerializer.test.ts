import {describe, expect, test} from "vitest";
import {z} from "zod";
import {
    CreatePageCommand,
    DeleteBlockCommand,
    InsertBlockCommand,
    InsertBlockCommandArgsSchema,
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

    test("accepts a non-RFC Logseq UUID", () => {
        const command = new InsertBlockCommand({
            parentUuid: "00000001-2026-0614-0000-000000000000",
            content: "Inserted content"
        });

        expect(command.args.parentUuid).toBe("00000001-2026-0614-0000-000000000000");
    });

    test("round trips a delete block command", () => {
        const command = new DeleteBlockCommand({
            blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
        });

        const serialized = LogseqReversibleTransactionCommandSerializer.serialize(command);
        const deserialized = LogseqReversibleTransactionCommandSerializer.deserialize(serialized);

        expect(serialized).toEqual({
            type: "DeleteBlock",
            blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
        });
        expect(deserialized).toBeInstanceOf(DeleteBlockCommand);
        expect(deserialized).toEqual(command);
    });

    test("does not serialize delete block execution snapshots", () => {
        const command = new DeleteBlockCommand({
            blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
        });

        expect(LogseqReversibleTransactionCommandSerializer.serialize(command)).toEqual({
            type: "DeleteBlock",
            blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
        });
    });

    test("rejects a value that does not have the Logseq UUID shape", () => {
        expect(
            () =>
                new InsertBlockCommand({
                    parentUuid: "00000001-2026-0614-0000",
                    content: "Inserted content"
                })
        ).toThrow("Invalid Logseq UUID");
    });

    test("includes the command-level Logseq UUID description", () => {
        const jsonSchema = z.toJSONSchema(InsertBlockCommandArgsSchema);

        expect(jsonSchema.properties?.parentUuid).toMatchObject({
            type: "string",
            pattern:
                "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
            description: "UUID of the parent Logseq page or block."
        });
        expect(jsonSchema.properties?.parentUuid).not.toHaveProperty("format");
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
                parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                content: "Inserted content",
                sibling: false
            })
        );
        tracker.addCommand(
            new UpdateBlockCommand({
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29",
                content: "Updated"
            })
        );

        const serialized = LogseqReversibleTransactionTrackerSerializer.serialize(tracker);
        const deserialized = LogseqReversibleTransactionTrackerSerializer.deserialize(serialized);

        expect(serialized).toEqual({
            uuidGenerationSeed: "5f9c57d6-3466-4ba3-b6bf-01e12f11c91d",
            commands: [
                {type: "CreatePage", pageName: "Tracker Test"},
                {
                    type: "InsertBlock",
                    parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                    content: "Inserted content",
                    sibling: false
                },
                {
                    type: "UpdateBlock",
                    blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29",
                    content: "Updated"
                }
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
