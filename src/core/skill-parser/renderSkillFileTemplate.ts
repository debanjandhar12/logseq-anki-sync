import {splitFrontmatter} from "../frontmatter-parser";
import type {MustacheTemplateView} from "../template-engine/MustacheView";
import {parseTemplateString} from "../template-engine/parseTemplateString";

export async function renderSkillFileTemplate(
    content: string,
    view?: MustacheTemplateView
): Promise<string> {
    const {prefix, body} = splitFrontmatter(content);
    return prefix + (await parseTemplateString(body, view));
}
