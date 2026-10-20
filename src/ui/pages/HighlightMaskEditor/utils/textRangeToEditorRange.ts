import type {Node} from "@tiptap/pm/model";

/** Keep raw quote offsets aligned with the editor's block separators. */
export function textRangeToEditorRange(doc: Node, start: number, end: number) {
    let currentPos = 0;
    let from = -1;
    let to = -1;
    doc.descendants((node, pos) => {
        if (node.isText) {
            const length = node.text?.length || 0;
            if (from === -1 && start >= currentPos && start < currentPos + length) {
                from = pos + start - currentPos;
            }
            if (to === -1 && end > currentPos && end <= currentPos + length) {
                to = pos + end - currentPos;
            }
            currentPos += length;
        } else if (node.isBlock && currentPos > 0) {
            currentPos += 1;
        }
        return from === -1 || to === -1;
    });
    return {from, to};
}
