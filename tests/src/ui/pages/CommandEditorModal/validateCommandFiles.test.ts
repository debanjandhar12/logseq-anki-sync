import matter from "gray-matter";
import {MustacheView} from "src/core/template-engine";
import {validateCommandFilesForSave} from "src/ui/pages/CommandEditorModal";
import {beforeEach, describe, expect, test, vi} from "vitest";

function createCommandContent(
    overrides: {
        name?: string;
        locations?: string[];
        body?: string;
        builtIn?: boolean;
        controllable?: boolean;
        enabled?: boolean;
    } = {}
): string {
    const {
        name = "My command",
        locations = ["Block Context Menu/Other Blocks"],
        body = "Summarize this block.",
        builtIn,
        controllable,
        enabled = true
    } = overrides;
    return matter.stringify(body, {
        name,
        "invoke-location": locations,
        "user-invocable": enabled,
        ...(builtIn === undefined ? {} : {"built-in-command": builtIn}),
        ...(controllable === undefined ? {} : {"built-in-command-user-controllable": controllable})
    });
}

beforeEach(() => {
    vi.spyOn(MustacheView, "getVariableNames").mockResolvedValue(["today"]);
});

describe("validateCommandFilesForSave", () => {
    test("returns parsed command files in order", async () => {
        const first = createCommandContent({name: "First"});
        const second = createCommandContent({name: "Second"});
        const result = await validateCommandFilesForSave([
            {id: "first", content: first},
            {id: "second", content: second}
        ]);

        expect(result.issue).toBeNull();
        expect(result.parsedFiles.map(({name}) => name)).toEqual(["First", "Second"]);
    });

    test("rejects invalid templates before command metadata errors", async () => {
        const result = await validateCommandFilesForSave([
            {id: "broken", content: "---\nname: 42\ninvoke-location: []\n---\n<% unknown %>"}
        ]);

        expect(result.issue).toMatchObject({kind: "invalid-template", fileId: "broken"});
    });

    test("rejects empty invoke locations", async () => {
        const result = await validateCommandFilesForSave([
            {id: "empty", content: createCommandContent({locations: []})}
        ]);

        expect(result.issue).toMatchObject({kind: "parse-error", fileId: "empty"});
        expect(result.issue?.message).toContain("invoke-location must contain at least one value");
    });

    test("rejects duplicate names case-insensitively", async () => {
        const result = await validateCommandFilesForSave([
            {id: "first", content: createCommandContent({name: "My Command"})},
            {id: "second", content: createCommandContent({name: "my command"})}
        ]);

        expect(result.issue).toMatchObject({kind: "duplicate-name", fileId: "second"});
    });

    test("rejects an edited locked built-in command", async () => {
        const original = createCommandContent({builtIn: true, controllable: false});
        const edited = createCommandContent({builtIn: true, controllable: false, enabled: false});
        const result = await validateCommandFilesForSave([
            {
                id: "built-in",
                content: edited,
                originalContent: original,
                originalFileName: "My command.md"
            }
        ]);

        expect(result.issue).toMatchObject({kind: "built-in-modified", fileId: "built-in"});
    });

    test("allows only the enabled state to change for a controllable built-in", async () => {
        const original = createCommandContent({builtIn: true, controllable: true});
        const edited = createCommandContent({
            builtIn: true,
            controllable: true,
            enabled: false
        });
        const result = await validateCommandFilesForSave([
            {
                id: "built-in",
                content: edited,
                originalContent: original,
                originalFileName: "My command.md"
            }
        ]);

        expect(result.issue).toBeNull();
        expect(result.parsedFiles[0].userInvocable).toBe(false);
    });

    test("rejects deletion of a loaded built-in command", async () => {
        const original = createCommandContent({builtIn: true});
        const result = await validateCommandFilesForSave(
            [],
            [{fileName: "My command.md", content: original}]
        );

        expect(result.issue).toMatchObject({
            kind: "built-in-deleted",
            fileName: "My command.md"
        });
    });
});
