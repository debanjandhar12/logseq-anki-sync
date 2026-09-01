import matter from "gray-matter";
import {
    updateCommandInvokeLocations,
    updateCommandUserInvocable
} from "src/ui/pages/CommandEditorModal/utils/updateCommandMetadata";
import {describe, expect, test} from "vitest";

const source = `---
name: Test command
invoke-location:
  - Block Context Menu/Other Blocks
user-invocable: true
custom-field: retained
---

Prompt body
`;

describe("command metadata updates", () => {
    test("updates enabled state while preserving body and unrelated metadata", () => {
        const updated = matter(updateCommandUserInvocable(source, false));

        expect(updated.data).toMatchObject({
            name: "Test command",
            "user-invocable": false,
            "custom-field": "retained"
        });
        expect(updated.content).toBe("\nPrompt body\n");
    });

    test("writes invoke locations in the supplied canonical order", () => {
        const updated = matter(
            updateCommandInvokeLocations(source, [
                "Block Context Menu/Image",
                "Logseq Command Center"
            ])
        );

        expect(updated.data["invoke-location"]).toEqual([
            "Block Context Menu/Image",
            "Logseq Command Center"
        ]);
        expect(updated.content).toBe("\nPrompt body\n");
    });
});
