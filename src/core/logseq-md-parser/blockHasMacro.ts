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

type MldocMacro = {
    name?: unknown;
    arguments?: unknown;
};

function containsMacro(node: unknown, macroName: string): boolean {
    if (!Array.isArray(node)) return false;

    if (node[0] === "Macro") {
        const macro = node[1] as MldocMacro | undefined;
        return (
            typeof macro?.name === "string" &&
            macro.name.toLocaleLowerCase() === macroName &&
            Array.isArray(macro.arguments) &&
            macro.arguments.length > 0
        );
    }

    return node.some((child) => containsMacro(child, macroName));
}

export function blockHasMacro(
    block: Pick<BlockEntity, "content" | "format">,
    name: string
): boolean {
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
        return containsMacro(ast, name.toLocaleLowerCase());
    } catch {
        return false;
    }
}
