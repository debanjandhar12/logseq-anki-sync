import {CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
import {forceLinting, forEachDiagnostic, lintGutter} from "@codemirror/lint";
import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {SKILL_EDITOR_FRONTMATTER_FIELDS} from "src/ui/pages/SkillEditorModal/createSkillEditorExtensions";
import {describe, expect, test} from "vitest";
import {
    createFrontmatterCompletionSource,
    createFrontmatterLinter,
    createMustacheLinter
} from "../../../../../../src/ui/components/LogseqCodeEditor";

const source = createFrontmatterCompletionSource({
    fields: SKILL_EDITOR_FRONTMATTER_FIELDS,
    mustacheTags: ["<%", "%>"]
});

async function complete(document: string): Promise<CompletionResult | null> {
    const marker = document.indexOf("|");
    const doc = document.replace("|", "");
    const state = EditorState.create({doc});
    const position = marker >= 0 ? Math.min(marker, state.doc.length) : state.doc.length;
    return source(new CompletionContext(state, position, false));
}

describe("YAML frontmatter CodeMirror extension", () => {
    test("does not complete built-in skill fields", async () => {
        const result = await complete("---\nname: Existing\nb|");

        expect(result).toBeNull();
    });

    test("offers all user-editable skill fields in empty frontmatter", async () => {
        const result = await complete("---\n|");

        expect(result?.options.map((option) => option.label)).toEqual([
            "name",
            "description",
            "disable-model-invocation"
        ]);
    });

    test("completes boolean values", async () => {
        const result = await complete("---\r\ndisable-model-invocation: f|");

        expect(result?.options.map((option) => option.label)).toEqual(["true", "false"]);
    });

    test("does not complete outside frontmatter or inside Mustache", async () => {
        await expect(complete("---\nname: Test\n---\nname|")).resolves.toBeNull();
        await expect(complete("---\nname: Test\n---Body|")).resolves.toBeNull();
        await expect(complete("---\nname: Test\n--- trailing|")).resolves.toBeNull();
        await expect(complete("---\nname: <% to|")).resolves.toBeNull();
    });

    test("combines frontmatter and Mustache diagnostics in one lint gutter", async () => {
        const parent = document.createElement("div");
        document.body.append(parent);
        const view = new EditorView({
            parent,
            state: EditorState.create({
                doc: "---\nname: 42\n---\n<% unknown %>",
                extensions: [
                    createFrontmatterLinter(() => [{from: 4, to: 12, message: "Invalid name"}], 0),
                    createMustacheLinter(
                        () => [{from: 17, to: 30, message: "Unknown variable"}],
                        0
                    ),
                    lintGutter()
                ]
            })
        });

        forceLinting(view);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const sources: Array<string | undefined> = [];
        forEachDiagnostic(view.state, (diagnostic) => sources.push(diagnostic.source));

        expect(sources).toEqual(["Frontmatter", "Mustache"]);
        expect(parent.querySelectorAll(".cm-gutter-lint")).toHaveLength(1);
        view.destroy();
        parent.remove();
    });
});
