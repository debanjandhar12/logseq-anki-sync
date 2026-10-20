import type {Node} from "@tiptap/pm/model";

export function editorRangeToTextRange(doc: Node, from: number, to: number) {
    let currentPos = 0;
    let start = -1;
    let end = -1;
    doc.descendants((node, pos) => {
        if (node.isText) {
            const length = node.text?.length || 0;
            if (start === -1 && from <= pos + length) {
                start = currentPos + Math.max(0, from - pos);
            }
            if (to >= pos) end = currentPos + Math.min(length, Math.max(0, to - pos));
            currentPos += length;
        } else if (node.isBlock && currentPos > 0) {
            currentPos += 1;
        }
    });
    return {start: start === -1 ? 0 : start, end: end === -1 ? currentPos : end};
}
