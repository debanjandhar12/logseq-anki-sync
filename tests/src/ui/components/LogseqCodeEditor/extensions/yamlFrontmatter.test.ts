import {CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
import {EditorState} from "@codemirror/state";
import {describe, expect, test} from "vitest";
import {
    createFrontmatterCompletionSource,
    type FrontmatterFieldDefinition
} from "../../../../../../src/ui/components/LogseqCodeEditor";

const fields: readonly FrontmatterFieldDefinition[] = [
    {key: "name", valueType: "string", required: true},
    {key: "description", valueType: "string", required: true},
    {key: "disable-model-invocation", valueType: "boolean"},
    {key: "built-in-skill", valueType: "boolean"},
    {key: "built-in-skill-user-controllable", valueType: "boolean"}
];
const source = createFrontmatterCompletionSource({fields, mustacheTags: ["<%", "%>"]});

async function complete(document: string): Promise<CompletionResult | null> {
    const marker = document.indexOf("|");
    const doc = document.replace("|", "");
    const state = EditorState.create({doc});
    const position = marker >= 0 ? Math.min(marker, state.doc.length) : state.doc.length;
    return source(new CompletionContext(state, position, false));
}

describe("YAML frontmatter CodeMirror extension", () => {
    test("completes all missing skill fields and suppresses duplicates", async () => {
        const result = await complete("---\nname: Existing\nb|");

        expect(result?.options.map((option) => option.label)).toEqual([
            "built-in-skill",
            "built-in-skill-user-controllable"
        ]);
        expect(result?.options.map((option) => option.label)).not.toContain("name");
    });

    test("offers all five skill fields in empty frontmatter", async () => {
        const result = await complete("---\n|");

        expect(result?.options.map((option) => option.label)).toEqual([
            "name",
            "description",
            "disable-model-invocation",
            "built-in-skill",
            "built-in-skill-user-controllable"
        ]);
    });

    test("completes boolean values", async () => {
        const result = await complete("---\r\ndisable-model-invocation: f|");

        expect(result?.options.map((option) => option.label)).toEqual(["true", "false"]);
    });

    test("does not complete outside frontmatter or inside Mustache", async () => {
        await expect(complete("---\nname: Test\n---\nname|")).resolves.toBeNull();
        await expect(complete("---\nname: <% to|")).resolves.toBeNull();
    });
});
