import {describe, expect, test} from "vitest";
import {z} from "zod";
import {
    CreatePageCommand,
    DeleteBlockCommand,
    DeletePageCommand,
    InsertBlockCommand,
    InsertBlockCommandArgsSchema,
    LogseqReversibleTransactionCommandSerializer,
    LogseqReversibleTransactionTracker,
    LogseqReversibleTransactionTrackerSerializer,
    MoveBlockCommand,
    RenamePageCommand,
    UpdateBlockCommand
} from "../../../../src/core/logseq-reversible-transaction-tracker";

describe("LogseqReversibleTransactionCommandSerializer", () => {
    test("round trips a command", () => {
        const command = new CreatePageCommand({pageName: "Codec Test"});

        const serialized = LogseqReversibleTransactionCommandSerializer.serialize(command);
        const deserialized = LogseqReversibleTransactionCommandSerializer.deserialize(serialized);

        expect(serialized).toEqual({
            type: "CreatePage",
            pageName: "Codec Test",
            pageUuid: expect.any(String)
        });
        expect(deserialized).toBeInstanceOf(CreatePageCommand);
        expect(deserialized).toEqual(command);
    });

    test("round trips generated create page UUID state", () => {
        const command = new CreatePageCommand({pageName: "UUID State Test"});
        const serialized = LogseqReversibleTransactionCommandSerializer.serialize(command);

        const deserialized = LogseqReversibleTransactionCommandSerializer.deserialize(serialized);
        const reserialized = LogseqReversibleTransactionCommandSerializer.serialize(deserialized);

        expect(reserialized).toEqual(serialized);
    });

    test("round trips generated insert block UUID state", () => {
        const command = new InsertBlockCommand({
            parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
            content: "Inserted content"
        });
        const serialized = LogseqReversibleTransactionCommandSerializer.serialize(command);

        const deserialized = LogseqReversibleTransactionCommandSerializer.deserialize(serialized);
        const reserialized = LogseqReversibleTransactionCommandSerializer.serialize(deserialized);

        expect(serialized).toEqual({
            type: "InsertBlock",
            parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
            content: "Inserted content",
            sibling: true,
            blockUuid: expect.any(String)
        });
        expect(reserialized).toEqual(serialized);
    });

    test("rejects serialized create commands without UUID state", () => {
        expect(() =>
            LogseqReversibleTransactionCommandSerializer.deserialize({
                type: "CreatePage",
                pageName: "Legacy Codec Test"
            })
        ).toThrow();
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

    test("serializes every command shape without runtime snapshots", () => {
        const commands = [
            new CreatePageCommand(
                {pageName: "Codec Test"},
                {pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"}
            ),
            new InsertBlockCommand(
                {
                    parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                    content: "Inserted content"
                },
                {blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"}
            ),
            new UpdateBlockCommand({
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f30",
                content: "Updated content"
            }),
            new DeleteBlockCommand({
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f31"
            }),
            new DeletePageCommand({
                pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f32"
            }),
            new MoveBlockCommand({
                srcBlockUuid: "018f38a5-df13-74d1-bf02-14c17f252f33",
                destBlockUuid: "018f38a5-df13-74d1-bf02-14c17f252f34"
            }),
            new RenamePageCommand({
                pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f35",
                newName: "Renamed Page"
            })
        ];

        expect(commands.map(LogseqReversibleTransactionCommandSerializer.serialize)).toEqual([
            {
                type: "CreatePage",
                pageName: "Codec Test",
                pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f28"
            },
            {
                type: "InsertBlock",
                parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                content: "Inserted content",
                sibling: true,
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"
            },
            {
                type: "UpdateBlock",
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f30",
                content: "Updated content"
            },
            {
                type: "DeleteBlock",
                blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f31"
            },
            {
                type: "DeletePage",
                pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f32"
            },
            {
                type: "MoveBlock",
                srcBlockUuid: "018f38a5-df13-74d1-bf02-14c17f252f33",
                destBlockUuid: "018f38a5-df13-74d1-bf02-14c17f252f34",
                children: false
            },
            {
                type: "RenamePage",
                pageUuid: "018f38a5-df13-74d1-bf02-14c17f252f35",
                newName: "Renamed Page"
            }
        ]);
    });

    test("round trips defaulted command args", () => {
        const insertBlockCommand = new InsertBlockCommand(
            {
                parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                content: "Inserted content"
            },
            {blockUuid: "018f38a5-df13-74d1-bf02-14c17f252f29"}
        );
        const moveBlockCommand = new MoveBlockCommand({
            srcBlockUuid: "018f38a5-df13-74d1-bf02-14c17f252f33",
            destBlockUuid: "018f38a5-df13-74d1-bf02-14c17f252f34"
        });

        expect(
            LogseqReversibleTransactionCommandSerializer.serialize(insertBlockCommand)
        ).toMatchObject({sibling: true});
        expect(
            LogseqReversibleTransactionCommandSerializer.serialize(moveBlockCommand)
        ).toMatchObject({children: false});
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
        const tracker = new LogseqReversibleTransactionTracker();
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
            commands: [
                {type: "CreatePage", pageName: "Tracker Test", pageUuid: expect.any(String)},
                {
                    type: "InsertBlock",
                    parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
                    content: "Inserted content",
                    sibling: false,
                    blockUuid: expect.any(String)
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

    test("keeps serialized command UUIDs stable when command order changes", () => {
        const createPageCommand = new CreatePageCommand({pageName: "Tracker Test"});
        const insertBlockCommand = new InsertBlockCommand({
            parentUuid: "018f38a5-df13-74d1-bf02-14c17f252f28",
            content: "Inserted content",
            sibling: false
        });
        const tracker = new LogseqReversibleTransactionTracker();
        tracker.addCommand(createPageCommand);
        tracker.addCommand(insertBlockCommand);

        const originalSerialized = LogseqReversibleTransactionTrackerSerializer.serialize(tracker);
        const reorderedTracker = new LogseqReversibleTransactionTracker();
        reorderedTracker.addCommand(insertBlockCommand);
        reorderedTracker.addCommand(createPageCommand);

        const reorderedSerialized =
            LogseqReversibleTransactionTrackerSerializer.serialize(reorderedTracker);

        expect(reorderedSerialized.commands[0]).toEqual(originalSerialized.commands[1]);
        expect(reorderedSerialized.commands[1]).toEqual(originalSerialized.commands[0]);
    });
});
