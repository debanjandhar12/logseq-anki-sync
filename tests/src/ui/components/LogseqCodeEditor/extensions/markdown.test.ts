import {CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {afterEach, describe, expect, test} from "vitest";
import {createMarkdownCompletionSource} from "../../../../../../src/ui/components/LogseqCodeEditor";

const source = createMarkdownCompletionSource({mustacheTags: ["<%", "%>"]});
const views: EditorView[] = [];

async function complete(document: string, explicit = false): Promise<CompletionResult | null> {
    const marker = document.indexOf("|");
    const doc = document.replace("|", "");
    const state = EditorState.create({doc});
    const position = marker >= 0 ? Math.min(marker, state.doc.length) : state.doc.length;
    return source(new CompletionContext(state, position, explicit));
}

describe("Markdown CodeMirror extension", () => {
    afterEach(() => {
        for (const view of views.splice(0)) view.destroy();
    });

    test("offers Markdown snippets", async () => {
        const explicit = await complete("Text", true);
        const heading = await complete("#");

        expect(explicit?.options.map((option) => option.label)).toContain("[text](url)");
        expect(heading?.options[0].label).toBe("# heading");
    });

    test("fenced code snippet places language directly after the fence", async () => {
        const result = await complete("```");
        const option = result?.options[0];
        const view = new EditorView({
            state: EditorState.create({doc: "```"}),
            parent: document.body.appendChild(document.createElement("div"))
        });
        views.push(view);

        expect(typeof option?.apply).toBe("function");
        if (typeof option?.apply === "function") option.apply(view, option, 0, 3);

        expect(view.state.doc.toString()).toBe("```language\nCode\n```");
    });

    test("suppresses snippets in CRLF frontmatter, code, and Mustache tags", async () => {
        await expect(complete("---\r\nname: [")).resolves.toBeNull();
        await expect(complete("Some `unfinished [", true)).resolves.toBeNull();
        await expect(complete("Some ``unfinished [", true)).resolves.toBeNull();
        await expect(complete("~~~typescript\n[", true)).resolves.toBeNull();
        await expect(complete("<% [")).resolves.toBeNull();
    });
});
