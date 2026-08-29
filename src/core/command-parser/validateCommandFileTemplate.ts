import {splitFrontmatter} from "../frontmatter-parser";
import {MUSTACHE_TEMPLATE_TAGS} from "../template-engine/constants";
import type {MustacheTemplateIssue} from "../template-engine/validateMustacheTemplate";
import {validateMustacheTemplate} from "../template-engine/validateMustacheTemplate";
import {COMMAND_FRONTMATTER_MUSTACHE_MESSAGE} from "./constants";

export async function validateCommandFileTemplate(
    content: string
): Promise<MustacheTemplateIssue[]> {
    const {prefix} = splitFrontmatter(content);
    if (!prefix) return validateMustacheTemplate(content);

    return [
        ...collectFrontmatterTagIssues(prefix),
        ...(await validateMustacheTemplate(maskPrefix(content, prefix.length)))
    ];
}

function collectFrontmatterTagIssues(prefix: string): MustacheTemplateIssue[] {
    const [openingTag, closingTag] = MUSTACHE_TEMPLATE_TAGS;
    const issues: MustacheTemplateIssue[] = [];
    let searchFrom = 0;
    while (searchFrom < prefix.length) {
        const from = prefix.indexOf(openingTag, searchFrom);
        if (from < 0) break;
        const closingFrom = prefix.indexOf(closingTag, from + openingTag.length);
        const lineBreak = prefix.indexOf("\n", from);
        let to =
            closingFrom >= 0
                ? closingFrom + closingTag.length
                : lineBreak >= 0
                  ? lineBreak
                  : prefix.length;
        if (to > from && prefix[to - 1] === "\r") to -= 1;
        if (to <= from) to = Math.min(prefix.length, from + openingTag.length);
        issues.push({from, to, message: COMMAND_FRONTMATTER_MUSTACHE_MESSAGE});
        searchFrom = Math.max(to, from + openingTag.length);
    }
    return issues;
}

function maskPrefix(content: string, prefixLength: number): string {
    return content.slice(0, prefixLength).replace(/[^\n]/g, " ") + content.slice(prefixLength);
}
