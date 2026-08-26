import type {MustacheTemplateView} from "../template-engine/MustacheView";
import {parseTemplateString} from "../template-engine/parseTemplateString";
import {splitSkillFileFrontmatter} from "./skillFileFrontmatter";

export async function renderSkillFileTemplate(
    content: string,
    view?: MustacheTemplateView
): Promise<string> {
    const {prefix, body} = splitSkillFileFrontmatter(content);
    return prefix + (await parseTemplateString(body, view));
}
