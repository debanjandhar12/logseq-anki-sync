import {splitFrontmatter} from "../template-engine/parser/splitFrontmatter";
import type {MustacheTemplateView} from "../template-engine/renderer/MustacheView";
import {parseTemplateString} from "../template-engine/renderer/parseTemplateString";

export async function renderSkillFileTemplate(
    content: string,
    view?: MustacheTemplateView
): Promise<string> {
    const {prefix, body} = splitFrontmatter(content);
    return prefix + (await parseTemplateString(body, view));
}
