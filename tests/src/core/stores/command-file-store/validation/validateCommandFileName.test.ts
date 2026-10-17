import matter from "gray-matter";
import {beforeEach, describe, expect, test, vi} from "vitest";
import {commandNameSchema as formatSchema} from "../../../../../../src/core/command-parser";
import {CommandFileStore} from "../../../../../../src/core/stores/command-file-store/CommandFileStore";
import {
    commandNameSchema,
    storageSafeCommandNameSchema
} from "../../../../../../src/core/stores/command-file-store/validation/commandNameSchema";
import {validateCommandFileForSave} from "../../../../../../src/core/stores/command-file-store/validation/validateCommandFileForSave";
import {commandFileNameSchema} from "../../../../../../src/core/stores/command-file-store/validation/validateCommandFileName";
import {MustacheView} from "../../../../../../src/core/template-engine";

beforeEach(() => {
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today"]);
});

describe("command storage filename policy", () => {
    test("retains the storage-safe compatibility alias", () => {
        expect(commandNameSchema).toBe(storageSafeCommandNameSchema);
        expect(commandNameSchema).not.toBe(formatSchema);
    });

    test.each([
        "My Command",
        "你好",
        "a--B",
        "example.md",
        "CON",
        "a".repeat(100)
    ])("preserves allowed identity %s", (name) => {
        expect(storageSafeCommandNameSchema.parse(name)).toBe(name);
        expect(commandFileNameSchema.parse(CommandFileStore.getCommandFileName({name}))).toBe(
            `${name}.md`
        );
    });

    test.each([
        "",
        " ",
        ".",
        "..",
        "../name",
        "folder/name",
        "folder\\name",
        "<name",
        "name>",
        'name"',
        "name:",
        "name|",
        "name?",
        "name*",
        "name\u0000",
        "name\u001f",
        "name\u007f",
        " leading",
        "trailing ",
        "\tname",
        "name\n",
        "name\u00a0",
        "trailing."
    ])("rejects identity %j even after appending .md", async (name) => {
        expect(storageSafeCommandNameSchema.safeParse(name).success).toBe(false);
        expect(
            commandFileNameSchema.safeParse(CommandFileStore.getCommandFileName({name})).success
        ).toBe(false);
        const content = matter.stringify("Prompt", {
            name,
            "invoke-location": ["Logseq Command Center"]
        });
        if (name.trim() && storageSafeCommandNameSchema.safeParse(name.trim()).success) {
            // Preserve frontmatter-reader normalization, unlike raw transaction arguments.
            expect((await validateCommandFileForSave(content)).name).toBe(name.trim());
        } else {
            await expect(validateCommandFileForSave(content)).rejects.toThrow();
        }
    });

    test.each([
        "",
        "Command",
        "Command.MD",
        "Command.md/other.md"
    ])("requires a complete generated filename: %j", (fileName) => {
        expect(commandFileNameSchema.safeParse(fileName).success).toBe(false);
    });

    test("save validation composes parsing, filename policy, and template validation", async () => {
        const content = matter.stringify("Prompt", {
            name: "My Command",
            "invoke-location": ["Logseq Command Center"]
        });
        expect((await validateCommandFileForSave(content)).name).toBe("My Command");
        await expect(validateCommandFileForSave("not frontmatter")).rejects.toThrow("frontmatter");
        await expect(validateCommandFileForSave(`${content}\n<% unknown %>`)).rejects.toThrow();
    });
});
