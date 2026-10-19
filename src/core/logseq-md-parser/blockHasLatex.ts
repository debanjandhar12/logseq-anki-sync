import type {BlockEntity} from "@logseq/libs/dist/LSPlugin";
import {Mldoc} from "mldoc";

const MLDOC_OPTIONS = {
    toc: false,
    heading_number: false,
    keep_line_break: false,
    heading_to_list: false,
    exporting_keep_properties: false,
    inline_type_with_pos: true,
    parse_outline_only: false,
    export_md_remove_options: [],
    hiccup_in_block: true
};

function containsLatex(node: unknown): boolean {
    if (Array.isArray(node)) {
        if (node[0] === "Displayed_Math") {
            return typeof node[1] === "string" && node[1].trim().length > 0;
        }

        if (node[0] === "Latex_Fragment") {
            const fragment = node[1];
            return (
                Array.isArray(fragment) &&
                (fragment[0] === "Inline" || fragment[0] === "Displayed") &&
                typeof fragment[1] === "string" &&
                fragment[1].trim().length > 0
            );
        }

        return node.some(containsLatex);
    }

    if (typeof node === "object" && node !== null) {
        return Object.values(node).some(containsLatex);
    }

    return false;
}

export function blockHasLatex(block: Pick<BlockEntity, "content" | "format">): boolean {
    if (typeof block.content !== "string" || block.content.length === 0) return false;

    try {
        const ast = JSON.parse(
            Mldoc.parseJson(
                block.content,
                JSON.stringify({
                    ...MLDOC_OPTIONS,
                    format: block.format === "org" ? "Org" : "Markdown"
                }),
                JSON.stringify({})
            )
        ) as unknown;
        return containsLatex(ast);
    } catch {
        return false;
    }
}
