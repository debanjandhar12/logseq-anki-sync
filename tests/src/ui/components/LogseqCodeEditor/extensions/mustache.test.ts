import {CompletionContext, type CompletionResult} from "@codemirror/autocomplete";
import {forceLinting, forEachDiagnostic} from "@codemirror/lint";
import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {describe, expect, test} from "vitest";
import {
    createMustacheCompletionSource,
    createMustacheLinter
} from "../../../../../../src/ui/components/LogseqCodeEditor";

const source = createMustacheCompletionSource({
    tags: ["<%", "%>"],
    getVariableNames: () => ["currentPage", "current page", "today"]
});

async function complete(document: string): Promise<CompletionResult | null> {
    const marker = document.indexOf("|");
    const doc = document.replace("|", "");
    const position = marker >= 0 ? marker : doc.length;
    return source(new CompletionContext(EditorState.create({doc}), position, false));
}

describe("Mustache CodeMirror extension", () => {
    test("completes variables as full tags and tolerates trailing query whitespace", async () => {
        const result = await complete("<% cur ");

        expect(result?.options.map((option) => option.label)).toEqual([
            "<% currentPage %>",
            "<% current page %>"
        ]);
        expect(result?.options[0].apply).toBe("<% currentPage %>");
    });

    test("consumes a closing delimiter after the cursor", async () => {
        const result = await complete("<% cur| %>");

        expect(result?.from).toBe(0);
        expect(result?.to).toBe("<% cur %>".length);
    });

    test("rejects completed and control tags", async () => {
        await expect(complete("<% cur %>|")).resolves.toBeNull();
        await expect(complete("<% #cur")).resolves.toBeNull();
    });

    test("suppresses completion in disabled regions", async () => {
        const disabledSource = createMustacheCompletionSource({
            tags: ["<%", "%>"],
            getVariableNames: () => ["today"],
            isDisabledAt: () => true
        });
        const state = EditorState.create({doc: "<% to"});

        await expect(
            disabledSource(new CompletionContext(state, state.doc.length, false))
        ).resolves.toBeNull();
    });

    test("maps validation issues to Mustache error diagnostics", async () => {
        const view = new EditorView({
            state: EditorState.create({
                doc: "<% unknown %>",
                extensions: [
                    createMustacheLinter(
                        () => [{from: 3, to: 10, message: "Unknown Mustache variable: unknown"}],
                        0
                    )
                ]
            })
        });

        forceLinting(view);
        await new Promise((resolve) => setTimeout(resolve, 0));
        const diagnostics: Array<{source?: string; severity: string; message: string}> = [];
        forEachDiagnostic(view.state, (diagnostic) => diagnostics.push(diagnostic));

        expect(diagnostics).toEqual([
            {
                from: 3,
                to: 10,
                source: "Mustache",
                severity: "error",
                message: "Unknown Mustache variable: unknown"
            }
        ]);
        view.destroy();
    });
});
