import {Schema} from "@tiptap/pm/model";
import {expect, test} from "vitest";
import {editorRangeToTextRange} from "../../../../../src/ui/pages/HighlightMaskEditor/utils/editorRangeToTextRange";
import {textRangeToEditorRange} from "../../../../../src/ui/pages/HighlightMaskEditor/utils/textRangeToEditorRange";

const schema = new Schema({
    nodes: {
        doc: {content: "block+"},
        paragraph: {content: "text*", group: "block"},
        text: {group: "inline"}
    }
});

test("converts first/last positions and multiline code text without dropping boundaries", () => {
    const doc = schema.node("doc", null, [
        schema.node("paragraph", null, schema.text("first\nlast"))
    ]);
    expect(textRangeToEditorRange(doc, 0, 10)).toEqual({from: 1, to: 11});
    expect(editorRangeToTextRange(doc, 1, 11)).toEqual({start: 0, end: 10});
    expect(textRangeToEditorRange(doc, 6, 10)).toEqual({from: 7, to: 11});
    expect(editorRangeToTextRange(doc, 7, 11)).toEqual({start: 6, end: 10});
});

test("preserves block separators and unmatched-range sentinel behavior", () => {
    const doc = schema.node("doc", null, [
        schema.node("paragraph", null, schema.text("abc")),
        schema.node("paragraph", null, schema.text("def"))
    ]);
    expect(textRangeToEditorRange(doc, 4, 7)).toEqual({from: 6, to: 9});
    expect(editorRangeToTextRange(doc, 6, 9)).toEqual({start: 4, end: 7});
    expect(textRangeToEditorRange(doc, 20, 30)).toEqual({from: -1, to: -1});
});
