import {CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
import {EditorState} from "@codemirror/state";
import {describe, expect, test} from "vitest";
import {
    markdownSyntaxCompletionSource,
    mustacheVariableCompletionSource
} from "../../../../../src/ui/pages/skill-editor/skillEditorExtensions";

async function complete(
    source: typeof mustacheVariableCompletionSource,
    document: string,
    position = document.indexOf("|") >= 0 ? document.indexOf("|") : document.length,
    explicit = false
): Promise<CompletionResult | null> {
    const doc = document.replace("|", "");
    return source(new CompletionContext(EditorState.create({doc}), position, explicit));
}

describe("skillEditorExtensions", () => {
    test("completes partial Mustache variables as full tags", async () => {
        const result = await complete(mustacheVariableCompletionSource, "<% cur");

        expect(result?.from).toBe(0);
        expect(result?.to).toBe(6);
        expect(result?.options.map((option) => option.label)).toContain("<% currentPage %>");
        expect(result?.options.find((option) => option.label === "<% currentPage %>")?.apply).toBe(
            "<% currentPage %>"
        );
    });

    test("replaces a closing delimiter after the cursor but rejects completed tags", async () => {
        const beforeClose = await complete(mustacheVariableCompletionSource, "<% cur| %>");
        const afterClose = await complete(mustacheVariableCompletionSource, "<% cur %>|");

        expect(beforeClose?.to).toBe("<% cur %>".length);
        expect(afterClose).toBeNull();
    });

    test("does not complete Mustache control tags", async () => {
        expect(await complete(mustacheVariableCompletionSource, "<% #cur")).toBeNull();
    });

    test("offers Markdown snippets explicitly and for recognized prefixes", async () => {
        const explicit = await complete(markdownSyntaxCompletionSource, "text ", undefined, true);
        const heading = await complete(markdownSyntaxCompletionSource, "#");
        const fencedCode = await complete(markdownSyntaxCompletionSource, "```");

        expect(explicit?.options.map((option) => option.label)).toContain("[text](url)");
        expect(heading?.options[0].label).toBe("# heading");
        expect(fencedCode?.options[0].label).toBe("``` fenced code block");
    });

    test("suppresses Markdown snippets in frontmatter and Mustache tags", async () => {
        expect(
            await complete(markdownSyntaxCompletionSource, "---\nname: [", undefined, false)
        ).toBeNull();
        expect(await complete(markdownSyntaxCompletionSource, "<% [", undefined, false)).toBeNull();
    });
});
